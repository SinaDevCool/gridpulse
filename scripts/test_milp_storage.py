import unittest
from unittest.mock import patch

from check_milp_storage import NoRedirect, inspect_metadata, read_json, store_contract


SOURCE = '''
class SupabaseJobStore:
    def claim(self):
        return self._publisher.request("POST", "/rpc/claim_analytics_job", {"p_worker_id": "worker"})
def _job_row(job):
    return {"id": job.id, "lease_owner": job.lease_owner}
'''


class StoragePreflightTests(unittest.TestCase):
    def document(self):
        return {"definitions": {"analytics_jobs": {"properties": {"id": {}, "lease_owner": {}}}},
                "paths": {"/analytics_jobs": {"get": {}}, "/rpc/claim_analytics_job": {
                    "post": {"parameters": [{"in": "body", "schema": {
                        "properties": {"p_worker_id": {}}}}]}}}}

    def test_contract_is_derived_from_existing_store(self):
        self.assertEqual(store_contract(SOURCE), (["id", "lease_owner"], {"/rpc/claim_analytics_job": ["p_worker_id"]}))

    def test_matching_metadata(self):
        self.assertEqual(inspect_metadata(self.document(), *store_contract(SOURCE)), [])

    def test_missing_column(self):
        doc = self.document()
        del doc["definitions"]["analytics_jobs"]["properties"]["lease_owner"]
        self.assertIn("lease_owner", inspect_metadata(doc, *store_contract(SOURCE))[0])

    def test_missing_rpc(self):
        doc = self.document()
        del doc["paths"]["/rpc/claim_analytics_job"]
        self.assertTrue(any("Missing service RPC" in issue for issue in inspect_metadata(doc, *store_contract(SOURCE))))

    def test_wrong_parameters(self):
        doc = self.document()
        doc["paths"]["/rpc/claim_analytics_job"]["post"]["parameters"] = []
        self.assertTrue(any("parameter metadata mismatch" in issue for issue in inspect_metadata(doc, *store_contract(SOURCE))))

    def test_referenced_body(self):
        doc = self.document()
        doc["definitions"]["claim_body"] = {"properties": {"p_worker_id": {}}}
        doc["paths"]["/rpc/claim_analytics_job"]["post"]["parameters"][0]["schema"] = {"$ref": "#/definitions/claim_body"}
        self.assertEqual(inspect_metadata(doc, *store_contract(SOURCE)), [])

    @patch("check_milp_storage.urllib.request.build_opener")
    def test_no_rpc_can_be_called(self, network):
        with self.assertRaises(ValueError):
            read_json("https://example.invalid/rest/v1", "secret", "/rpc/claim_analytics_job", "application/json")
        network.assert_not_called()

    @patch("check_milp_storage.urllib.request.build_opener")
    def test_no_customer_rows_can_be_read(self, network):
        with self.assertRaises(ValueError):
            read_json("https://example.invalid/rest/v1", "secret", "/analytics_jobs?select=id&limit=1", "application/json")
        network.assert_not_called()

    @patch("check_milp_storage.urllib.request.build_opener")
    def test_probe_uses_get_and_zero_rows(self, network):
        network.return_value.open.return_value.__enter__.return_value.read.return_value = b"[]"
        self.assertEqual(read_json("https://example.invalid/rest/v1", "secret", "/analytics_jobs?select=id&limit=0", "application/json"), [])
        request = network.return_value.open.call_args.args[0]
        self.assertEqual(request.get_method(), "GET")

    def test_credentials_are_not_redirected(self):
        with self.assertRaises(ValueError):
            NoRedirect().redirect_request(None, None, 302, "redirect", {}, "https://other.invalid")


if __name__ == "__main__":
    unittest.main()
