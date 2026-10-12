import fs from 'node:fs';
import ts from 'typescript';
const path='src/routes/assessments.$id.tsx';const text=fs.readFileSync(path,'utf8');
const ast=ts.createSourceFile(path,text,ts.ScriptTarget.Latest,true);let query;
function visit(n){if(ts.isPropertyAssignment(n)&&n.name.getText(ast)==='queryFn')query=n.initializer;ts.forEachChild(n,visit);}
visit(ast);if(!query||!ts.isArrowFunction(query))throw new Error('Missing assessment query');
const target='src/features/assessments/repository.ts';if(fs.existsSync(target))throw new Error('Refusing overwrite');
const imports=ast.statements.filter(ts.isImportDeclaration).map(n=>n.getText(ast));
fs.writeFileSync(target,imports.join('\n')+`\nexport async function loadAssessment(id: string) ${query.body.getText(ast)}\n`);
let result=text.slice(0,query.getStart(ast))+'() => loadAssessment(id)'+text.slice(query.end);
result=`import { loadAssessment, archiveAssessment, deleteAssessment } from '@/features/assessments/repository';\n`+result;
result=result.replace(/supabase\s*\.from\("candidate_sites"\)\s*\.update\(\{ assessment_status: "archived" \}\)\s*\.eq\("id", id\)/,'archiveAssessment(id)');
result=result.replace(/supabase\.from\("candidate_sites"\)\.delete\(\)\.eq\("id", id\)/,'deleteAssessment(id)');
fs.appendFileSync(target,`\nexport function archiveAssessment(id: string) { return supabase.from('candidate_sites').update({ assessment_status: 'archived' }).eq('id', id); }\nexport function deleteAssessment(id: string) { return supabase.from('candidate_sites').delete().eq('id', id); }\n`);
fs.writeFileSync(path,result);
