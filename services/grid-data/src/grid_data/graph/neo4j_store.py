from __future__ import annotations

import os
from dataclasses import asdict
from typing import Any

from .contracts import GraphProjection
from .incremental import validate_delta

SCHEMA_QUERIES = (
    "CREATE CONSTRAINT grid_model_key IF NOT EXISTS FOR (n:GridModel) REQUIRE n.key IS UNIQUE",
    "CREATE CONSTRAINT grid_asset_key IF NOT EXISTS FOR (n:GridAsset) REQUIRE n.key IS UNIQUE",
    "CREATE INDEX grid_edge_key IF NOT EXISTS FOR ()-[r:GRID_LINK]-() ON (r.key)",
    "CREATE CONSTRAINT grid_physics_result_key IF NOT EXISTS FOR (n:GridPhysicsResult) REQUIRE n.key IS UNIQUE",
)


class Neo4jGraphStore:
    def __init__(
        self,
        *,
        uri: str | None = None,
        username: str | None = None,
        password: str | None = None,
        database: str | None = None,
    ) -> None:
        try:
            from neo4j import GraphDatabase
        except ImportError as error:
            raise RuntimeError("Install the production extra to use Neo4j.") from error
        self.database = database or os.getenv("NEO4J_DATABASE", "neo4j")
        self.driver = GraphDatabase.driver(
            uri or os.getenv("NEO4J_URI", "neo4j://localhost:7687"),
            auth=(
                username or os.getenv("NEO4J_USERNAME", "neo4j"),
                password or os.environ["NEO4J_PASSWORD"],
            ),
        )

    def close(self) -> None:
        self.driver.close()

    def capabilities(self) -> dict[str, Any]:
        self.driver.verify_connectivity()
        records, _, _ = self.driver.execute_query(
            "RETURN gds.version() AS gds_version",
            database_=self.database,
            routing_="r",
        )
        return {"connected": True, "gds_version": records[0]["gds_version"]}

    def ensure_schema(self) -> None:
        for query in SCHEMA_QUERIES:
            self.driver.execute_query(query, database_=self.database)

    def publish(self, projection: GraphProjection) -> dict[str, Any]:
        self.ensure_schema()
        model_key = f"{projection.model_id}@{projection.model_version}"
        node_rows = [
            {**asdict(row), "key": f"{model_key}:{row.external_id}", "model_key": model_key}
            for row in projection.nodes
        ]
        edge_rows = [
            {
                **asdict(row),
                "key": f"{model_key}:{row.external_id}",
                "source_key": f"{model_key}:{row.source}",
                "target_key": f"{model_key}:{row.target}",
            }
            for row in projection.edges
        ]
        self.driver.execute_query(
            "MERGE (m:GridModel {key:$key}) SET m.model_id=$model_id, "
            "m.model_version=$model_version, m.validation_class=$validation_class, "
            "m.source_sha256=$source_sha256, m.projection_sha256=$projection_sha256",
            key=model_key,
            model_id=projection.model_id,
            model_version=projection.model_version,
            validation_class=projection.validation_class,
            source_sha256=projection.source_sha256,
            projection_sha256=projection.projection_sha256,
            database_=self.database,
        )
        self.driver.execute_query(
            "UNWIND $rows AS row MERGE (n:GridAsset {key:row.key}) "
            "SET n.external_id=row.external_id, n.kind=row.kind, n.model_key=row.model_key, "
            "n.properties_json=row.properties_json, n.latitude=row.latitude, "
            "n.longitude=row.longitude WITH n MATCH (m:GridModel {key:$model_key}) "
            "MERGE (m)-[:CONTAINS]->(n)",
            rows=[
                {
                    **row,
                    "properties_json": __import__("json").dumps(row["properties"], sort_keys=True),
                    "latitude": row["properties"].get("latitude", row["properties"].get("lat")),
                    "longitude": row["properties"].get("longitude", row["properties"].get("lon")),
                }
                for row in node_rows
            ],
            model_key=model_key,
            database_=self.database,
        )
        self.driver.execute_query(
            "UNWIND $rows AS row MATCH (a:GridAsset {key:row.source_key}), "
            "(b:GridAsset {key:row.target_key}) MERGE (a)-[r:GRID_LINK {key:row.key}]->(b) "
            "SET r.kind=row.kind, r.properties_json=row.properties_json, r.weight=row.weight",
            rows=[
                {
                    **row,
                    "properties_json": __import__("json").dumps(row["properties"], sort_keys=True),
                    "weight": float(row["properties"].get("topology_weight", 0.5)),
                }
                for row in edge_rows
            ],
            database_=self.database,
        )
        records, _, _ = self.driver.execute_query(
            "MATCH (m:GridModel {key:$key})-[:CONTAINS]->(n) RETURN count(n) AS nodes",
            key=model_key,
            database_=self.database,
            routing_="r",
        )
        return {
            "model_key": model_key,
            "node_count": records[0]["nodes"],
            "edge_count": len(edge_rows),
            "projection_sha256": projection.projection_sha256,
            "display_as_capacity": False,
        }

    def project_gds(self, projection: GraphProjection) -> str:
        """Create an ephemeral GDS projection in an operator-isolated database."""
        graph_name = f"gp_{projection.projection_sha256[:20]}"
        model_key = f"{projection.model_id}@{projection.model_version}"
        model_label = f"GP_{projection.projection_sha256[:20]}"
        existing, _, _ = self.driver.execute_query(
            "CALL gds.graph.exists($name) YIELD exists RETURN exists",
            name=graph_name,
            database_=self.database,
        )
        if existing[0]["exists"]:
            return graph_name
        self.driver.execute_query(
            "MATCH (n:GridAsset {model_key:$model_key}) SET n:$($model_label)",
            model_key=model_key,
            model_label=model_label,
            database_=self.database,
        )
        self.driver.execute_query(
            "CALL gds.graph.project($name, $model_label, "
            "{GRID_LINK:{orientation:'UNDIRECTED', properties:['weight']}}) YIELD graphName",
            name=graph_name,
            model_label=model_label,
            database_=self.database,
        )
        return graph_name

    def gds_astar(
        self,
        graph_name: str,
        *,
        model_key: str,
        source_id: str,
        target_id: str,
        latitude_property: str = "latitude",
        longitude_property: str = "longitude",
    ) -> dict[str, Any]:
        """Run A* only where verified geographic properties exist on projected nodes."""
        records, _, _ = self.driver.execute_query(
            "MATCH (s:GridAsset {key:$source}), (t:GridAsset {key:$target}) "
            "CALL gds.shortestPath.astar.stream($graph,{sourceNode:s,targetNode:t,"
            "relationshipWeightProperty:'weight',latitudeProperty:$latitude,longitudeProperty:$longitude}) "
            "YIELD totalCost,nodeIds RETURN totalCost,"
            "[id IN nodeIds | gds.util.asNode(id).external_id] AS asset_ids",
            source=f"{model_key}:{source_id}",
            target=f"{model_key}:{target_id}",
            graph=graph_name,
            latitude=latitude_property,
            longitude=longitude_property,
            database_=self.database,
        )
        return {
            "total_graph_cost": records[0]["totalCost"],
            "asset_ids": records[0]["asset_ids"],
            "display_as_capacity": False,
        }

    def gds_memory_estimate(self) -> dict[str, Any]:
        records, _, _ = self.driver.execute_query(
            "CALL gds.graph.project.estimate('GridAsset', {GRID_LINK:{orientation:'UNDIRECTED', properties:['weight']}}) "
            "YIELD requiredMemory,bytesMin,bytesMax,nodeCount,relationshipCount RETURN *",
            database_=self.database,
        )
        return dict(records[0])

    def gds_dijkstra(
        self, graph_name: str, *, model_key: str, source_id: str, target_id: str
    ) -> dict[str, Any]:
        records, _, _ = self.driver.execute_query(
            "MATCH (s:GridAsset {key:$source}), (t:GridAsset {key:$target}) "
            "CALL gds.shortestPath.dijkstra.stream($graph,{sourceNode:s,targetNode:t,relationshipWeightProperty:'weight'}) "
            "YIELD totalCost,nodeIds RETURN totalCost,[id IN nodeIds | gds.util.asNode(id).external_id] AS asset_ids",
            source=f"{model_key}:{source_id}",
            target=f"{model_key}:{target_id}",
            graph=graph_name,
            database_=self.database,
        )
        return {
            "total_graph_cost": records[0]["totalCost"],
            "asset_ids": records[0]["asset_ids"],
            "display_as_capacity": False,
        }

    def gds_topology_metrics(self, graph_name: str) -> dict[str, Any]:
        wcc, _, _ = self.driver.execute_query(
            "CALL gds.wcc.stream($graph) YIELD componentId RETURN count(DISTINCT componentId) AS components",
            graph=graph_name,
            database_=self.database,
        )
        centrality, _, _ = self.driver.execute_query(
            "CALL gds.betweenness.stream($graph) YIELD nodeId,score RETURN gds.util.asNode(nodeId).external_id AS asset_id,score ORDER BY score DESC LIMIT 10",
            graph=graph_name,
            database_=self.database,
        )
        bridges, _, _ = self.driver.execute_query(
            "CALL gds.bridges.stream($graph) YIELD from,to RETURN "
            "gds.util.asNode(from).external_id AS source,gds.util.asNode(to).external_id AS target",
            graph=graph_name,
            database_=self.database,
        )
        articulation, _, _ = self.driver.execute_query(
            "CALL gds.articulationPoints.stream($graph) YIELD nodeId RETURN "
            "gds.util.asNode(nodeId).external_id AS asset_id",
            graph=graph_name,
            database_=self.database,
        )
        return {
            "connected_components": wcc[0]["components"],
            "topological_centrality": [dict(row) for row in centrality],
            "bridges": [dict(row) for row in bridges],
            "articulation_assets": [row["asset_id"] for row in articulation],
            "interpretation": "topology only; not loading, capacity, or N-1 compliance",
        }

    def drop_gds(self, graph_name: str) -> None:
        self.driver.execute_query(
            "CALL gds.graph.drop($graph,false) YIELD graphName RETURN graphName",
            graph=graph_name,
            database_=self.database,
        )

    def gds_yens(
        self, graph_name: str, *, model_key: str, source_id: str, target_id: str, k: int = 3
    ) -> list[dict[str, Any]]:
        records, _, _ = self.driver.execute_query(
            "MATCH (source:GridAsset {key:$source}), (target:GridAsset {key:$target}) "
            "CALL gds.shortestPath.yens.stream($graph, {sourceNode:source, targetNode:target, "
            "k:$k, relationshipWeightProperty:'weight'}) "
            "YIELD index,totalCost,nodeIds RETURN index,totalCost, "
            "[id IN nodeIds | gds.util.asNode(id).external_id] AS asset_ids ORDER BY index",
            source=f"{model_key}:{source_id}",
            target=f"{model_key}:{target_id}",
            graph=graph_name,
            k=k,
            database_=self.database,
        )
        return [
            {
                "rank": row["index"] + 1,
                "total_graph_cost": row["totalCost"],
                "asset_ids": row["asset_ids"],
                "display_as_capacity": False,
            }
            for row in records
        ]

    def delete_projection(self, model_key: str) -> None:
        self.driver.execute_query(
            "MATCH (m:GridModel {key:$key}) OPTIONAL MATCH (m)-[:CONTAINS]->(n) "
            "OPTIONAL MATCH (m)-[:HAS_PHYSICS_RESULT]->(r) DETACH DELETE n, r, m",
            key=model_key,
            database_=self.database,
        )

    def publish_physics_attachment(
        self, *, model_key: str, attachment: dict[str, Any]
    ) -> dict[str, Any]:
        models, _, _ = self.driver.execute_query(
            "MATCH (m:GridModel {key:$key}) RETURN m.projection_sha256 AS projection_sha256",
            key=model_key,
            database_=self.database,
            routing_="r",
        )
        if not models or models[0]["projection_sha256"] != attachment["projection_sha256"]:
            raise ValueError("Physics attachment does not match the published graph projection.")
        rows = attachment["result_nodes"]
        relationships = attachment["constraint_relationships"]
        self.driver.execute_query(
            "UNWIND $rows AS row MATCH (m:GridModel {key:$model_key}) "
            "MERGE (r:GridPhysicsResult {key:$model_key + ':' + row.external_id}) "
            "SET r.external_id=row.external_id,r.projection_sha256=$projection_sha256,"
            "r.properties_json=row.properties_json,r.stale=false MERGE (m)-[:HAS_PHYSICS_RESULT]->(r)",
            rows=[
                {
                    **row,
                    "properties_json": __import__("json").dumps(row["properties"], sort_keys=True),
                }
                for row in rows
            ],
            model_key=model_key,
            projection_sha256=attachment["projection_sha256"],
            database_=self.database,
        )
        self.driver.execute_query(
            "UNWIND $rows AS row MATCH (r:GridPhysicsResult "
            "{key:$model_key + ':' + row.source}),"
            "(a:GridAsset {key:$model_key + ':' + row.target}) "
            "MERGE (r)-[b:BOUND_BY {key:row.external_id}]->(a) "
            "SET b.physics_verified=true",
            rows=relationships,
            model_key=model_key,
            database_=self.database,
        )
        return {
            "model_key": model_key,
            "attachment_sha256": attachment["attachment_sha256"],
            "result_count": len(rows),
            "physics_verified": True,
            "operator_confirmed": False,
        }

    def mark_stale_physics_results(self, model_key: str, current_projection_sha256: str) -> int:
        records, _, _ = self.driver.execute_query(
            "MATCH (:GridModel {key:$model_key})-[:HAS_PHYSICS_RESULT]->(r:GridPhysicsResult) "
            "WHERE r.projection_sha256 <> $projection_sha256 SET r.stale=true RETURN count(r) AS count",
            model_key=model_key,
            projection_sha256=current_projection_sha256,
            database_=self.database,
        )
        return records[0]["count"]

    def publish_delta_snapshot(
        self,
        *,
        base_model_key: str,
        next_projection: GraphProjection,
        delta: dict[str, Any],
    ) -> dict[str, Any]:
        """Atomically materialise an immutable next version using an optimistic base hash."""
        next_model_key = f"{next_projection.model_id}@{next_projection.model_version}"
        if next_model_key == base_model_key:
            raise ValueError("A delta snapshot requires a new model version.")
        node_rows = [
            {
                **asdict(row),
                "properties_json": __import__("json").dumps(row.properties, sort_keys=True),
            }
            for row in next_projection.nodes
        ]
        edge_rows = [
            {
                **asdict(row),
                "properties_json": __import__("json").dumps(row.properties, sort_keys=True),
                "weight": float(row.properties.get("topology_weight", 0.5)),
            }
            for row in next_projection.edges
        ]

        def write(tx):
            base = tx.run(
                "MATCH (m:GridModel {key:$key}) RETURN m.projection_sha256 AS hash",
                key=base_model_key,
            ).single()
            if not base:
                raise ValueError("Base graph model does not exist.")
            validate_delta(delta, base["hash"])
            if delta["next_projection_sha256"] != next_projection.projection_sha256:
                raise ValueError("Delta target does not match the supplied next projection.")
            if tx.run(
                "MATCH (m:GridModel {key:$key}) RETURN count(m) AS count", key=next_model_key
            ).single()["count"]:
                raise ValueError("Next graph model version already exists.")
            tx.run(
                "CREATE (m:GridModel {key:$key,model_id:$model_id,model_version:$version,"
                "validation_class:$validation_class,source_sha256:$source_sha256,"
                "projection_sha256:$projection_sha256,base_model_key:$base,delta_sha256:$delta})",
                key=next_model_key,
                model_id=next_projection.model_id,
                version=next_projection.model_version,
                validation_class=next_projection.validation_class,
                source_sha256=next_projection.source_sha256,
                projection_sha256=next_projection.projection_sha256,
                base=base_model_key,
                delta=delta["delta_sha256"],
            )
            tx.run(
                "UNWIND $rows AS row MATCH (m:GridModel {key:$model_key}) "
                "CREATE (n:GridAsset {key:$model_key + ':' + row.external_id,external_id:row.external_id,"
                "kind:row.kind,model_key:$model_key,properties_json:row.properties_json}) "
                "CREATE (m)-[:CONTAINS]->(n)",
                rows=node_rows,
                model_key=next_model_key,
            )
            tx.run(
                "UNWIND $rows AS row MATCH (a:GridAsset {key:$model_key + ':' + row.source}),"
                "(b:GridAsset {key:$model_key + ':' + row.target}) "
                "CREATE (a)-[:GRID_LINK {key:$model_key + ':' + row.external_id,kind:row.kind,"
                "properties_json:row.properties_json,weight:row.weight}]->(b)",
                rows=edge_rows,
                model_key=next_model_key,
            )
            return len(node_rows), len(edge_rows)

        with self.driver.session(database=self.database) as session:
            node_count, edge_count = session.execute_write(write)
        return {
            "base_model_key": base_model_key,
            "model_key": next_model_key,
            "projection_sha256": next_projection.projection_sha256,
            "delta_sha256": delta["delta_sha256"],
            "node_count": node_count,
            "edge_count": edge_count,
            "atomic": True,
            "rollback": delta["rollback"],
            "display_as_capacity": False,
        }
