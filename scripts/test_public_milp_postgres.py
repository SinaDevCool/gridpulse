"""Real PostgreSQL qualification. Refuses production connections via shared fixture."""
import json
import os
import unittest
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from uuid import uuid4

import psycopg
from psycopg.rows import dict_row

import test_scoped_claim_postgres as scoped


@unittest.skipUnless(os.environ.get("TEST_DATABASE_URL"), "Disposable PostgreSQL required")
class PublicMilpPostgresTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        scoped.ScopedClaimPostgresTests.setUpClass()
        cls.db = scoped.ScopedClaimPostgresTests.db
        cls.db.execute("""create role authenticator noinherit; create role supabase_auth_admin;
            alter table auth.users add column is_anonymous boolean not null default false;
            create function auth.jwt() returns jsonb language sql as
              $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
            grant usage on schema public,auth to anon,authenticated;
            grant execute on function auth.uid(),auth.role(),auth.jwt() to anon,authenticated;
            create table public.private_example(secret text);
            alter table public.private_example enable row level security;
            grant select on public.private_example to authenticated;
            create policy named_read on public.private_example to authenticated using(true);
            insert into public.private_example values('not-public');
            create function public.private_function() returns text language sql security definer
              as $$ select 'private'::text $$;
            revoke all on function public.private_function() from public,anon;
            grant execute on function public.private_function() to authenticated;
        """)
        cls.db.execute((Path(__file__).resolve().parent.parent / "supabase/migrations/20261023210000_public_milp_access.sql").read_text(encoding="utf-8"))

    @classmethod
    def tearDownClass(cls):
        cls.db.close()

    def setUp(self):
        self.db.execute("reset role; select set_config('request.jwt.claim.role','service_role',false)")
        self.db.execute("delete from public.analytics_jobs")
        self.owner = uuid4()
        self.other = uuid4()
        for owner in (self.owner,self.other):
            self.db.execute("insert into auth.users(id,is_anonymous) values(%s,true)",(owner,))

    def admit(self, owner=None, identity=None, conn=None):
        payload = {"id":str(uuid4()),"owner_id":str(owner or self.owner),"job_type":"facility_plan",
                   "input_fingerprint":identity or uuid4().hex * 2,"input_payload":{"model":"fixture"}}
        return (conn or self.db).execute("select * from public.create_public_facility_job(%s::jsonb)",(json.dumps(payload),)).fetchall()

    def claim(self, worker="public", conn=None):
        return (conn or self.db).execute("select * from public.claim_analytics_job(%s,120,array['facility_plan'],'public')",(worker,)).fetchall()

    def test_no_authenticated_inheritance_or_privileged_function_access(self):
        self.assertFalse(self.db.execute("select pg_has_role('gridpulse_public_visitor','authenticated','USAGE') as allowed").fetchone()["allowed"])
        self.assertFalse(self.db.execute("select has_function_privilege('gridpulse_public_visitor','public.private_function()','EXECUTE') as allowed").fetchone()["allowed"])
        self.db.execute("set role gridpulse_public_visitor")
        try:
            with self.assertRaises(psycopg.errors.InsufficientPrivilege):
                self.db.execute("select * from public.private_example")
        finally:
            self.db.execute("reset role")
        self.db.execute("set role authenticated")
        try:
            self.assertEqual(self.db.execute("select * from public.private_example").fetchone()["secret"],"not-public")
        finally:
            self.db.execute("reset role")

    def test_hook_uses_database_identity_not_user_metadata(self):
        event={"user_id":str(self.owner),"claims":{"role":"authenticated","user_metadata":{"role":"service_role"}}}
        out=self.db.execute("select public.gridpulse_public_access_token(%s::jsonb) as event",(json.dumps(event),)).fetchone()["event"]
        self.assertEqual(out["claims"]["role"],"gridpulse_public_visitor")
        self.assertTrue(out["claims"]["is_anonymous"])
        named=uuid4()
        self.db.execute("insert into auth.users(id) values(%s)",(named,))
        event["user_id"]=str(named)
        out=self.db.execute("select public.gridpulse_public_access_token(%s::jsonb) as event",(json.dumps(event),)).fetchone()["event"]
        self.assertEqual(out,event)
        self.assertFalse(self.db.execute("select has_function_privilege('gridpulse_public_visitor','public.gridpulse_public_access_token(jsonb)','EXECUTE') as allowed").fetchone()["allowed"])

    def test_owner_reads_cannot_see_other_visitor_or_private_job(self):
        mine=self.admit()[0]["id"]
        self.admit(self.other)
        self.db.execute("insert into public.analytics_jobs(owner_id,job_type) values(%s,'facility_plan')",(self.owner,))
        self.db.execute("select set_config('request.jwt.claim.sub',%s,false)",(str(self.owner),))
        self.db.execute("set role gridpulse_public_visitor")
        try:
            self.assertEqual([row["id"] for row in self.db.execute("select id from public.analytics_jobs")],[mine])
            with self.assertRaises(psycopg.errors.InsufficientPrivilege):
                self.db.execute("select * from public.create_public_facility_job('{}')")
        finally:
            self.db.execute("reset role")

    def test_dedup_precedes_queue_limit_and_private_workers_skip_public(self):
        first=self.admit(identity="a"*64)[0]["id"]
        self.admit(self.other)
        self.assertEqual(self.admit(identity="a"*64)[0]["id"],first)
        self.assertEqual(self.db.execute("select * from public.claim_analytics_job('private')").fetchall(),[])
        with self.assertRaises(psycopg.Error) as error:
            self.admit()
        self.assertEqual(error.exception.sqlstate,"PT429")

    def test_one_lease_and_expired_recovery(self):
        first=self.admit()[0]["id"]
        self.admit(self.other)
        self.assertEqual(self.claim()[0]["id"],first)
        self.assertEqual(self.claim("second"),[])
        self.db.execute("update public.analytics_jobs set lease_expires_at=now()-interval '1 second' where id=%s",(first,))
        self.assertEqual(self.claim("recovered")[0]["attempt_count"],2)

    def test_concurrent_admission_stays_bounded(self):
        owners=[uuid4() for _ in range(6)]
        for owner in owners:
            self.db.execute("insert into auth.users(id,is_anonymous) values(%s,true)",(owner,))
        def submit(owner):
            with psycopg.connect(scoped.DSN,autocommit=True,row_factory=dict_row) as conn:
                conn.execute("select set_config('request.jwt.claim.role','service_role',false)")
                try:
                    return bool(self.admit(owner,conn=conn))
                except psycopg.Error as error:
                    if error.sqlstate!='PT429': raise
                    return False
        with ThreadPoolExecutor(max_workers=6) as pool:
            self.assertEqual(sum(pool.map(submit,owners)),2)

    def test_hourly_limit_counts_failed_jobs(self):
        for _ in range(3):
            job=self.admit()[0]["id"]
            self.db.execute("update public.analytics_jobs set status='failed',completed_at=now() where id=%s",(job,))
        with self.assertRaises(psycopg.Error) as error:
            self.admit()
        self.assertEqual(error.exception.sqlstate,"PT429")

    def test_non_anonymous_owner_is_not_public_admitted(self):
        named=uuid4()
        self.db.execute("insert into auth.users(id) values(%s)",(named,))
        with self.assertRaises(psycopg.errors.InsufficientPrivilege):
            self.admit(named)

    def test_cancel_keeps_capacity_until_stopped_and_cannot_publish_late(self):
        first=self.admit()[0]["id"]
        self.admit(self.other)
        claimed=self.claim()[0]
        cancelled=self.db.execute("select * from public.cancel_analytics_job(%s,%s)",(first,self.owner)).fetchone()
        self.assertEqual(cancelled["status"],"running")
        self.assertTrue(cancelled["cancellation_requested"])
        self.assertEqual(self.claim("second"),[])
        self.assertEqual(self.db.execute("select * from public.update_leased_analytics_job(%s,%s,%s,%s::jsonb)",
            (first,"public",claimed["attempt_count"],json.dumps({"status":"succeeded","completed_at":"2026-10-23T00:00:00Z"}))).fetchall(),[])
        stopped=self.db.execute("select * from public.update_leased_analytics_job(%s,%s,%s,%s::jsonb)",
            (first,"public",claimed["attempt_count"],json.dumps({"status":"cancelled","completed_at":"2026-10-23T00:00:00Z"}))).fetchone()
        self.assertEqual(stopped["status"],"cancelled")
        self.assertEqual(len(self.claim("second")),1)

    def test_global_hourly_cap_and_concurrent_claims(self):
        for _ in range(20):
            owner=uuid4()
            self.db.execute("insert into auth.users(id,is_anonymous) values(%s,true)",(owner,))
            job=self.admit(owner)[0]["id"]
            self.db.execute("update public.analytics_jobs set status='failed',completed_at=now() where id=%s",(job,))
        with self.assertRaises(psycopg.Error) as error:
            self.admit()
        self.assertEqual(error.exception.sqlstate,"PT429")
        self.db.execute("delete from public.analytics_jobs")
        self.admit()
        self.admit(self.other)
        def claim(index):
            with psycopg.connect(scoped.DSN,autocommit=True,row_factory=dict_row) as conn:
                return len(self.claim(str(index),conn))
        with ThreadPoolExecutor(max_workers=4) as pool:
            self.assertEqual(sum(pool.map(claim,range(4))),1)

    def test_existing_private_claim_regressions(self):
        for name in unittest.defaultTestLoader.getTestCaseNames(scoped.ScopedClaimPostgresTests):
            with self.subTest(name=name):
                case=scoped.ScopedClaimPostgresTests(name)
                case.setUp()
                getattr(case,name)()


if __name__=="__main__":
    unittest.main()
