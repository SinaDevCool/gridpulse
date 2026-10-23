import unittest
from unittest.mock import patch
import apply_scoped_claim as migration


class GuardedMigrationTests(unittest.TestCase):
    def test_exact_approved_source_and_signatures(self):
        source = migration.migration_source()
        self.assertEqual(len(migration.function_bodies(source)), 2)
        self.assertNotIn("\ncommit;", source)
        self.assertNotIn("\nbegin;", source)

    def test_changed_source_is_rejected(self):
        with patch.object(migration, "SOURCE_SHA256", "0" * 64), self.assertRaises(ValueError):
            migration.migration_source()

    def test_verified_bodies_and_acl(self):
        source = migration.migration_source()
        bodies = migration.function_bodies(source)
        rows = [{"arity": arity, "body": body, "security_definer": True,
                 "anon_execute": False, "authenticated_execute": False, "service_execute": True}
                for arity, body in [(3, bodies[0]), (2, bodies[1])]]
        migration.verify_deployed(rows, source)
        rows[0]["anon_execute"] = True
        with self.assertRaises(ValueError):
            migration.verify_deployed(rows, source)

    def test_single_transaction_and_only_one_history_version(self):
        sql = migration.apply_sql(migration.migration_source(), "old 'body'")
        self.assertEqual(sql.count("\ncommit;"), 1)
        self.assertIn("old ''body''", sql)
        self.assertIn("pg_advisory_xact_lock", sql)
        self.assertNotIn("create table", sql.lower())
        self.assertNotIn("drop table", sql.lower())

    @patch.dict("os.environ", {}, clear=True)
    def test_missing_credentials_refuse_network(self):
        with self.assertRaises(ValueError):
            migration.Management()


if __name__ == "__main__":
    unittest.main()
