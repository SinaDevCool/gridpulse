import unittest
from unittest.mock import patch

import apply_public_milp as apply


class MigrationGuards(unittest.TestCase):
    def test_source_is_digest_pinned_and_transaction_owned_by_caller(self):
        source=apply.source()
        self.assertNotIn('\nbegin;\n',source)
        self.assertNotIn('\ncommit;\n',source)
        self.assertIn("create role gridpulse_public_visitor",source)
        self.assertIn("pg_advisory_xact_lock",source)
        self.assertNotIn('alter role authenticated',source.lower())
        self.assertNotIn('drop table',source.lower())

    def test_digest_change_is_rejected(self):
        with patch.object(apply,'DIGEST','wrong'):
            with self.assertRaisesRegex(ValueError,'digest'):
                apply.source()

    def test_missing_role_boundary_fails_closed(self):
        from unittest.mock import Mock
        api=Mock()
        api.query.return_value=[]
        with self.assertRaises(ValueError):
            apply.verify(api)


if __name__=='__main__':
    unittest.main()
