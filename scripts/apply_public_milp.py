"""Apply only the approved, remotely-qualified public job boundary. Auth stays disabled."""
import hashlib
import json
import re
import urllib.request
from pathlib import Path

from apply_scoped_claim import FUNCTIONS, Management, literal, normalized, verify_deployed

ROOT = Path(__file__).resolve().parent.parent
VERSION = "20261023210000"
NAME = "public_milp_access"
DIGEST = "b2c25a558cc7eca1aa44fb489a922b74579d6d295943b259bcb6db8bfcc45d60"


def source():
    text = (ROOT / "supabase/migrations" / f"{VERSION}_{NAME}.sql").read_text(encoding="utf-8")
    if hashlib.sha256(text.encode()).hexdigest() != DIGEST:
        raise ValueError("Qualified migration digest changed; refused")
    text = re.sub(r"(?m)^begin;\s*$", "", text, count=1)
    return re.sub(r"(?m)^commit;\s*$", "", text, count=1)


def verify(api):
    definitions=re.findall(r"create(?: or replace)? function public\.(\w+)\((.*?)\).*?as \$\$(.*?)\$\$;",source(),re.S|re.I)
    deployed=api.query("""select p.proname,p.pronargs,p.prosrc as body,p.prosecdef from pg_proc p
      join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in
      ('claim_analytics_job','gridpulse_public_access_token','create_public_facility_job','cancel_analytics_job','update_leased_analytics_job')""",write=False)
    by_key={(row['proname'],row['pronargs']):row for row in deployed}
    for name,args,body in definitions:
        row=by_key.get((name,len(args.split(','))))
        if not row or not row['prosecdef'] or normalized(row['body'])!=normalized(body):
            raise ValueError('Deployed public boundary body differs from qualified source')
    rows = api.query("""select
      pg_has_role('gridpulse_public_visitor','authenticated','USAGE') as inherits_private,
      pg_has_role('gridpulse_public_visitor','anon','USAGE') as inherits_public,
      has_function_privilege('gridpulse_public_visitor','public.create_public_facility_job(jsonb)','EXECUTE') as browser_create,
      has_function_privilege('gridpulse_public_visitor','public.gridpulse_public_access_token(jsonb)','EXECUTE') as browser_hook,
      has_function_privilege('supabase_auth_admin','public.gridpulse_public_access_token(jsonb)','EXECUTE') as auth_hook,
      (select count(*) from pg_policies where tablename='analytics_jobs' and policyname='analytics_jobs_public_owner_select'
       and qual like '%access_scope%' and qual like '%owner_id%') as owner_policy""", write=False)
    if len(rows)!=1 or rows[0] != {"inherits_private":False,"inherits_public":True,
        "browser_create":False,"browser_hook":False,"auth_hook":True,"owner_policy":1}:
        raise ValueError("Visitor role or owner boundary differs from approved contract")
    leaks = api.query("""select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relkind in ('r','p','v','m') and c.relname<>'analytics_jobs'
      and has_table_privilege('gridpulse_public_visitor',c.oid,'SELECT')
      and not has_table_privilege('anon',c.oid,'SELECT')""", write=False)
    functions = api.query("""select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.prosecdef
      and has_function_privilege('gridpulse_public_visitor',p.oid,'EXECUTE')
      and not has_function_privilege('anon',p.oid,'EXECUTE')""", write=False)
    if leaks or functions:
        raise ValueError("Visitor acquired non-public data or privileged function access")


def main():
    api=Management()
    sql=source()
    ledger=api.query("select version,name from supabase_migrations.schema_migrations where version="+literal(VERSION),write=False)
    if ledger:
        if ledger != [{"version":VERSION,"name":NAME}]: raise ValueError("Migration identity drift")
        verify(api)
        print(json.dumps({"already_applied":True,"verified":True,"auth_enabled":False}))
        return
    request=urllib.request.Request(api.base+"/config/auth",headers={"Authorization":"Bearer "+api.token})
    with api.opener.open(request,timeout=25) as response:
        config=json.loads(response.read(2_000_000))
    if config.get("external_anonymous_users_enabled") or config.get("hook_custom_access_token_enabled"):
        raise ValueError("Existing anonymous auth or token hook requires reconciliation; not overwritten")
    old=(ROOT / "supabase/migrations/20261023180000_scoped_analytics_job_claim.sql").read_text(encoding="utf-8")
    before=api.query(FUNCTIONS,write=False)
    verify_deployed(before,old)
    extra=api.query("""select p.proname,p.prosrc as body from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname in ('cancel_analytics_job','update_leased_analytics_job')
      order by p.proname""",write=False)
    expected={}
    for file in ["20260809710000_durable_jobs_and_evidence_origin.sql","20261010130000_operations_worker_integrity.sql"]:
        text=(ROOT / "supabase/migrations" / file).read_text(encoding="utf-8")
        for name,body in re.findall(r"create(?: or replace)? function public\.(cancel_analytics_job|update_leased_analytics_job)\(.*?as \$\$(.*?)\$\$;",text,re.S|re.I):
            expected[name]=body
    if len(extra)!=2 or any(normalized(row["body"])!=normalized(expected[row["proname"]]) for row in extra):
        raise ValueError("Cancellation/publication baseline drift; refused")
    Path("public-milp-before.json").write_text(json.dumps({"claim":before,"extra":extra}),encoding="utf-8")
    guards=""
    for row in before:
        signature="text,integer"+(",text[]" if row["arity"]==3 else "")
        guards+=f"if (select prosrc from pg_proc where oid='public.claim_analytics_job({signature})'::regprocedure) is distinct from {literal(row['body'])} then raise exception 'Claim drift'; end if;\n"
    for row in extra:
        signature="uuid,uuid" if row["proname"]=="cancel_analytics_job" else "uuid,text,integer,jsonb"
        guards+=f"if (select prosrc from pg_proc where oid={literal('public.'+row['proname']+'('+signature+')')}::regprocedure) is distinct from {literal(row['body'])} then raise exception 'Worker boundary drift'; end if;\n"
    transaction="begin; set local lock_timeout='5s'; set local statement_timeout='25s'; select pg_advisory_xact_lock(hashtextextended('gridpulse-public-milp-migration',0)); do $guard$ begin "+guards+" end $guard$;\n"+sql
    transaction+="\ninsert into supabase_migrations.schema_migrations(version,name,statements) values("+literal(VERSION)+","+literal(NAME)+",array["+literal(sql)+"]::text[]); commit;"
    api.query(transaction,write=True)
    verify(api)
    print(json.dumps({"migration":VERSION,"applied":True,"verified":True,"anonymous_auth_enabled":False,
        "private_functions_rewritten":0,"customer_jobs_claimed":0,"production_milp_enabled":False}))


if __name__=="__main__":
    main()
