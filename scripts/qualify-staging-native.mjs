// Native PostgreSQL qualification. Refuses hosted databases and non-CI runs.
import {spawnSync} from 'node:child_process';
import {readFileSync,readdirSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
const dsn=process.env.TEST_DATABASE_URL;
if(process.env.GITHUB_ACTIONS!=='true' || !dsn) throw new Error('Disposable CI database required');
const target=new URL(dsn);
if(!['127.0.0.1','localhost'].includes(target.hostname) || target.pathname!=='/gridpulse_staging_replay' || target.port!=='55439') {
 throw new Error('Refusing any database except localhost:55439/gridpulse_staging_replay');
}
const output=resolve('.codex-tmp/native-staging-qualification');mkdirSync(output,{recursive:true});
const report={status:'started',applied:[],limitations:['Supabase Auth and Storage are shims','Native PostGIS image version may differ from production','Hosted JWT and cross-project isolation remain untested']};
function sql(text){
 const result=spawnSync('psql',[dsn,'-X','--no-psqlrc','-v','ON_ERROR_STOP=1','-At'],{input:text.replace(/\r\n/g,'\n'),encoding:'utf8',maxBuffer:32*1024*1024});
 if(result.status!==0) throw new Error(result.error?.message || result.stderr?.slice(-4000) || 'psql failed');
 return result.stdout.trim();
}
let current='preflight';
try {
 const version=Number(sql("select current_setting('server_version_num')"));
 if(version<170000 || version>=180000) throw new Error('PostgreSQL 17 required');
 if(sql("select count(*) from pg_tables where schemaname='public' and tablename not in ('spatial_ref_sys')")!=='0') throw new Error('Database is not empty');
 report.databaseVersion=sql('select version()');report.postgisVersion=sql('select postgis_full_version()');
 current='bootstrap';sql(readFileSync('deployment/supabase/native-replay-bootstrap.sql','utf8'));
 const forbidden=['20261018120000','20261018130000','20261018140000','20261018150000','20261018160000'];
 for(const filename of readdirSync('supabase/migrations').filter(f=>f.endsWith('.sql')).sort()) {
  current=filename;
  if(forbidden.includes(filename.split('_')[0])) throw new Error('Parked PR37 migration encountered');
  sql(readFileSync(resolve('supabase/migrations',filename),'utf8'));report.applied.push(filename);
 }
 current='boundary-checks';
 sql(`do $$ begin
 if pg_has_role('gridpulse_public_visitor','authenticated','USAGE') then raise exception 'Visitor inherits private role'; end if;
 if has_function_privilege('gridpulse_public_visitor','public.claim_analytics_job(text,integer,text[],text)','EXECUTE') then raise exception 'Visitor can claim jobs'; end if;
 if has_function_privilege('gridpulse_public_visitor','public.gridpulse_public_access_token(jsonb)','EXECUTE') then raise exception 'Visitor can invoke token hook'; end if;
 if not has_function_privilege('supabase_auth_admin','public.gridpulse_public_access_token(jsonb)','EXECUTE') then raise exception 'Auth hook not callable by auth admin'; end if;
 end $$;
 alter default privileges in schema public revoke all on tables from anon,authenticated,service_role;
 alter default privileges in schema public revoke all on sequences from anon,authenticated,service_role;
 alter default privileges in schema public revoke all on functions from public,anon,authenticated,service_role;`);
 current='capture';
 const snapshot=sql('set search_path=public,extensions;\n'+readFileSync('deployment/supabase/capture-production-schema.sql','utf8'));
 // SET is a separate command tag; the JSON SELECT is the final output line.
 writeFileSync(resolve(output,'schema-inventory.json'),JSON.stringify(JSON.parse(snapshot.split('\n').at(-1)),null,2)+'\n');
 report.status='native_replay_passed_not_installation_approval';
 console.log(JSON.stringify({status:report.status,applied:report.applied.length}));
}catch(error){report.status='failed';report.failure={stage:current,message:error.message};console.error(JSON.stringify(report.failure));process.exitCode=1;}
finally{writeFileSync(resolve(output,'result.json'),JSON.stringify(report,null,2)+'\n');}
