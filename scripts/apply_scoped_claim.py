"""Apply only the explicitly approved scoped-claim migration via Management API.

Never uses the PostgREST data credential, changes billing, executes a claim,
or pushes any other pending migration. Network errors are not blindly retried.
"""
import argparse
import hashlib
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

from check_milp_storage import NoRedirect

VERSION = "20261023180000"
NAME = "scoped_analytics_job_claim"
SOURCE_SHA256 = "f3842cb9a41df26beae36695d7ecb60fc24e42bd981a44edb4e781a89abd145b"
ROOT = Path(__file__).resolve().parent.parent
FUNCTIONS = """select p.pronargs as arity, p.prosrc as body,
  p.prosecdef as security_definer,
  has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute,
  has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_execute,
  has_function_privilege('service_role',p.oid,'EXECUTE') as service_execute
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname='claim_analytics_job' order by p.pronargs"""


def literal(value):
    return "'" + value.replace("'", "''") + "'"


def normalized(value):
    return re.sub(r"\s+", "", value)


def function_bodies(sql):
    return re.findall(r"create or replace function public\.claim_analytics_job\(.*?as \$\$(.*?)\$\$;", sql, re.S | re.I)


def migration_source():
    source = (ROOT / "supabase/migrations" / (VERSION + "_" + NAME + ".sql")).read_text(encoding="utf-8")
    if hashlib.sha256(source.encode()).hexdigest() != SOURCE_SHA256:
        raise ValueError("Approved migration digest differs; application refused")
    # The management query below owns the single transaction and ledger insert.
    source = re.sub(r"(?m)^begin;\s*$", "", source, count=1)
    return re.sub(r"(?m)^commit;\s*$", "", source, count=1)


def verify_deployed(rows, source):
    expected = function_bodies(source)
    by_arity = {row["arity"]: row for row in rows}
    if len(rows) != 2 or set(by_arity) != {2, 3}:
        raise ValueError("Deployed claim signatures differ from the approved migration")
    for arity, body in [(3, expected[0]), (2, expected[1])]:
        row = by_arity[arity]
        if (normalized(row["body"]) != normalized(body) or not row["security_definer"]
                or row["anon_execute"] or row["authenticated_execute"] or not row["service_execute"]):
            raise ValueError("Deployed claim body or permissions do not match the approved migration")


def apply_sql(source, previous_body):
    # Recheck under a transaction lock so a concurrent function change cannot be
    # overwritten between the read-only probe and migration application.
    return """begin;
set local lock_timeout='5s';
set local statement_timeout='20s';
select pg_advisory_xact_lock(hashtextextended('gridpulse-scoped-claim-migration',0));
do $guard$ begin
  if exists (select 1 from supabase_migrations.schema_migrations where version=""" + literal(VERSION) + """) then
    raise exception 'Scoped claim migration already recorded; recheck before applying';
  end if;
  if (select prosrc from pg_proc where oid='public.claim_analytics_job(text,integer)'::regprocedure)
       is distinct from """ + literal(previous_body) + """ then
    raise exception 'Legacy claim function changed during migration';
  end if;
  if to_regprocedure('public.claim_analytics_job(text,integer,text[])') is not null then
    raise exception 'Unexpected existing scoped claim function';
  end if;
end $guard$;
""" + source + "\ninsert into supabase_migrations.schema_migrations(version,name,statements) values (" + literal(VERSION) + "," + literal(NAME) + ",array[" + literal(source) + "]::text[]);\ncommit;"


class Management:
    def __init__(self):
        self.token = os.environ.get("SUPABASE_ACCESS_TOKEN", "")
        origin = urllib.parse.urlsplit(os.environ.get("SUPABASE_URL", ""))
        if not self.token or origin.scheme != "https" or not re.fullmatch(r"[a-z0-9]+\.supabase\.co", origin.hostname or ""):
            raise ValueError("Management credential and hosted Supabase origin are required")
        self.base = "https://api.supabase.com/v1/projects/" + origin.hostname.split(".")[0]
        self.opener = urllib.request.build_opener(NoRedirect())

    def query(self, query, *, write=False):
        path = "/database/query" if write else "/database/query/read-only"
        print("Management phase: " + ("approved migration transaction" if write else "read-only schema verification"), flush=True)
        request = urllib.request.Request(self.base + path, method="POST",
            headers={"Authorization": "Bearer " + self.token, "Content-Type": "application/json"},
            data=json.dumps({"query": query, "read_only": not write}).encode())
        with self.opener.open(request, timeout=45) as response:
            raw = response.read(4_000_001)
        if len(raw) > 4_000_000:
            raise ValueError("Management response exceeds the bounded metadata limit")
        return json.loads(raw)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    try:
        source = migration_source()
        api = Management()
        rows = api.query(FUNCTIONS)
        ledger = api.query("select version,name from supabase_migrations.schema_migrations where version=" + literal(VERSION))
        if ledger:
            if len(ledger) != 1 or ledger[0]["name"] != NAME:
                raise ValueError("Existing migration identity differs; history repair is out of scope")
            verify_deployed(rows, source)
            print(json.dumps({"migration": VERSION, "already_applied": True, "verified": True}))
            return 0
        legacy = (ROOT / "supabase/migrations/20261010130000_operations_worker_integrity.sql").read_text(encoding="utf-8")
        expected = function_bodies(legacy)[0]
        if len(rows) != 1 or rows[0]["arity"] != 2 or normalized(rows[0]["body"]) != normalized(expected):
            raise ValueError("Live legacy claim differs from reviewed baseline; application refused")
        if rows[0]["anon_execute"] or rows[0]["authenticated_execute"] or not rows[0]["service_execute"]:
            raise ValueError("Live legacy claim permissions differ from the reviewed baseline")
        if not args.apply:
            print(json.dumps({"migration": VERSION, "ready_to_apply": True, "changes_made": False}))
            return 0
        # Only function metadata is retained. No customer rows or credentials.
        Path("scoped-claim-before.json").write_text(json.dumps(rows, indent=2), encoding="utf-8")
        api.query(apply_sql(source, rows[0]["body"]), write=True)
        verify_deployed(api.query(FUNCTIONS), source)
        ledger = api.query("select version,name from supabase_migrations.schema_migrations where version=" + literal(VERSION))
        if len(ledger) != 1 or ledger[0]["name"] != NAME:
            raise ValueError("Applied migration history could not be verified")
        print(json.dumps({"migration": VERSION, "applied": True, "verified": True,
                          "tables_added": 0, "customer_jobs_claimed": 0, "production_milp_enabled": False}))
        return 0
    except urllib.error.HTTPError as error:
        print("BLOCKED: management request returned HTTP " + str(error.code) + "; no automatic retry")
        try:
            payload = json.loads(error.read(4096))
            detail = str(payload.get("message", payload.get("error", "No structured detail")))
            for value in [os.environ.get("SUPABASE_ACCESS_TOKEN", ""), os.environ.get("SUPABASE_URL", "")]:
                if value:
                    detail = detail.replace(value, "[redacted]")
            print("Management diagnostic: " + detail[:500])
        except (ValueError, TypeError, AttributeError):
            print("Management diagnostic unavailable")
    except (OSError, ValueError, KeyError, TypeError, IndexError):
        print("BLOCKED: management verification failed; inspect metadata before any retry")
    return 1


if __name__ == "__main__":
    sys.exit(main())
