"""Exercise actual PostgreSQL locks and ACLs in a disposable CI database only."""
import os
import threading
import unittest
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from uuid import uuid4
from urllib.parse import urlsplit

import psycopg
from psycopg.rows import dict_row


DSN = os.environ.get("TEST_DATABASE_URL", "")
MIGRATION = "20261023180000_scoped_analytics_job_claim.sql"


@unittest.skipUnless(DSN, "Disposable PostgreSQL CI database required")
class ScopedClaimPostgresTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        parsed = urlsplit(DSN)
        if parsed.hostname not in {"localhost", "127.0.0.1"} or parsed.path != "/gridpulse_scoped_claim_ci":
            raise RuntimeError("Tests refuse any database except the disposable localhost CI database")
        cls.db = psycopg.connect(DSN, autocommit=True, row_factory=dict_row)
        cls.db.execute("""
            create role anon; create role authenticated; create role service_role bypassrls;
            create schema auth; create table auth.users(id uuid primary key);
            create function auth.uid() returns uuid language sql as
              $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
            create function auth.role() returns text language sql as
              $$ select current_setting('request.jwt.claim.role',true) $$;
            create table public.pilot_datasets(id uuid, evidence_class text, is_synthetic boolean);
        """)
        root = Path(__file__).resolve().parent.parent / "supabase/migrations"
        for name in ["20260724050000_analytics_job_foundation.sql",
                     "20260809710000_durable_jobs_and_evidence_origin.sql",
                     "20260901010000_canonical_analytics_idempotency.sql",
                     "20261010130000_operations_worker_integrity.sql", MIGRATION]:
            cls.db.execute((root / name).read_text(encoding="utf-8"))
        cls.owner = uuid4()
        cls.db.execute("insert into auth.users values (%s)", (cls.owner,))

    @classmethod
    def tearDownClass(cls):
        cls.db.close()

    def setUp(self):
        self.db.execute("delete from public.analytics_jobs")

    def job(self, kind="facility_plan", **values):
        result = self.db.execute(
            "insert into public.analytics_jobs(owner_id,job_type) values (%s,%s) returning id",
            (self.owner, kind),
        ).fetchone()["id"]
        for field, value in values.items():
            if field not in {"status", "attempt_count", "lease_expires_at", "cancellation_requested"}:
                raise ValueError("Unexpected test fixture field")
            self.db.execute(psycopg.sql.SQL("update public.analytics_jobs set {}=%s where id=%s").format(
                psycopg.sql.Identifier(field)), (value, result))
        return result

    def claim(self, scope=("facility_plan",), worker="operations", conn=None):
        return (conn or self.db).execute(
            "select * from public.claim_analytics_job(%s,120,%s::text[])", (worker, list(scope))
        ).fetchall()

    def test_scope_and_legacy_default(self):
        other = self.job("reference_topology")
        target = self.job()
        self.assertEqual(self.claim()[0]["id"], target)
        self.assertEqual(self.claim(), [])
        self.assertEqual(self.db.execute("select * from public.claim_analytics_job('legacy')").fetchone()["id"], other)

    def test_scoped_cleanup_cannot_fail_other_job_types(self):
        expired = self.db.execute("select now()-interval '1 minute' as value").fetchone()["value"]
        other = self.job("reference_topology", status="running", attempt_count=3, lease_expires_at=expired)
        target = self.job(status="running", attempt_count=3, lease_expires_at=expired)
        self.assertEqual(self.claim(), [])
        rows = {r["id"]: r for r in self.db.execute("select * from public.analytics_jobs")}
        self.assertEqual(rows[other]["status"], "running")
        self.assertEqual(rows[target]["status"], "failed")

    def test_cancelled_and_active_jobs_are_not_claimed(self):
        self.job(cancellation_requested=True)
        future = self.db.execute("select now()+interval '1 minute' as value").fetchone()["value"]
        self.job(status="running", attempt_count=1, lease_expires_at=future)
        self.assertEqual(self.claim(), [])

    def test_expired_job_reclaims_and_rejects_old_generation(self):
        target = self.job()
        first = self.claim()[0]
        self.db.execute("update public.analytics_jobs set lease_expires_at=now()-interval '1 second' where id=%s", (target,))
        second = self.claim(worker="replacement")[0]
        self.assertEqual(second["attempt_count"], first["attempt_count"] + 1)
        late = self.db.execute("select * from public.update_leased_analytics_job(%s,%s,%s,%s::jsonb)",
            (target, "operations", first["attempt_count"], '{"status":"succeeded","completed_at":"2026-10-23T00:00:00Z"}')).fetchall()
        self.assertEqual(late, [])

    def test_cancel_wins_over_scoped_worker_completion(self):
        target = self.job()
        self.claim()
        self.db.execute("select * from public.cancel_analytics_job(%s,%s)", (target, self.owner))
        late = self.db.execute("select * from public.update_leased_analytics_job(%s,'operations',1,%s::jsonb)",
            (target, '{"status":"succeeded","completed_at":"2026-10-23T00:00:00Z"}')).fetchall()
        self.assertEqual(late, [])

    def test_acl_denies_public_roles_and_allows_service_role(self):
        for role in ["anon", "authenticated"]:
            with self.assertRaises(psycopg.errors.InsufficientPrivilege):
                with self.db.transaction():
                    self.db.execute(psycopg.sql.SQL("set local role {}").format(psycopg.sql.Identifier(role)))
                    self.claim()
        target = self.job()
        with self.db.transaction():
            self.db.execute("set local role service_role")
            self.assertEqual(self.claim()[0]["id"], target)

    def test_invalid_scopes_fail_closed(self):
        for scope in [[], [""], [None], ["facility_plan"] * 21, [["facility_plan"]]]:
            with self.assertRaises(psycopg.errors.InvalidParameterValue):
                self.claim(scope=scope)

    def test_real_concurrent_claim_skips_locked_job(self):
        self.job()
        locked = threading.Event()
        release = threading.Event()

        def first_worker():
            with psycopg.connect(DSN, row_factory=dict_row) as conn:
                rows = self.claim(worker="first", conn=conn)
                locked.set()
                if not release.wait(8):
                    raise RuntimeError("Concurrent test deadline")
                return rows

        with ThreadPoolExecutor(max_workers=1) as pool:
            first = pool.submit(first_worker)
            try:
                self.assertTrue(locked.wait(8))
                self.db.execute("set statement_timeout='3s'")
                self.assertEqual(self.claim(worker="second"), [])
            finally:
                release.set()
            self.assertEqual(len(first.result(timeout=8)), 1)
        self.db.execute("set statement_timeout=0")


if __name__ == "__main__":
    unittest.main()
