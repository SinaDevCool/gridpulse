"""Read-only anonymous-access prerequisite audit; never prints credentials or user rows."""
import json
import urllib.request

from apply_scoped_claim import Management


def main():
    api = Management()
    request = urllib.request.Request(
        api.base + "/config/auth",
        headers={"Authorization": "Bearer " + api.token},
    )
    with api.opener.open(request, timeout=25) as response:
        raw = response.read(2_000_001)
    if len(raw) > 2_000_000:
        raise ValueError("Auth configuration exceeds metadata budget")
    config = json.loads(raw)
    auth = {key: config.get(key) for key in (
        "external_anonymous_users_enabled", "security_captcha_enabled",
        "security_captcha_provider", "rate_limit_anonymous_users",
    )}
    policies = api.query("""select schemaname,tablename,policyname,roles,cmd,qual,with_check
        from pg_policies where schemaname='public'
        and ('authenticated'=any(roles) or 'public'=any(roles))
        order by tablename,policyname""", write=False)
    exposed = api.query("""select c.relname as relation,c.relkind,c.relrowsecurity,
        has_table_privilege('anon',c.oid,'SELECT') as anon_select,
        has_table_privilege('authenticated',c.oid,'SELECT') as authenticated_select
        from pg_class c join pg_namespace n on n.oid=c.relnamespace
        where n.nspname='public' and c.relkind in ('r','p','v','m')
        and has_table_privilege('authenticated',c.oid,'SELECT')
        order by c.relname""", write=False)
    functions = api.query("""select p.proname,pg_get_function_identity_arguments(p.oid) as arguments,
        has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute,
        has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_execute,
        md5(p.prosrc) as body_digest from pg_proc p join pg_namespace n on n.oid=p.pronamespace
        where n.nspname='public' and p.prosecdef
        and has_function_privilege('authenticated',p.oid,'EXECUTE') order by p.proname""", write=False)
    report = {"auth": auth, "policies": policies, "relations": exposed,
              "security_definer_functions": functions, "changes_made": False}
    print(json.dumps(report))


if __name__ == "__main__":
    main()
