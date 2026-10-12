import fs from 'node:fs';
import ts from 'typescript';
const directory='src/features/power-finder';
const names=new Set(['kindLabels','initialBounds','CandidateSort','distanceFormatter','formatScore','formatMw','withTimeout']);
for(const filename of fs.readdirSync(directory).filter(n=>/\.tsx?$/.test(n))) {
 const path=`${directory}/${filename}`;let text=fs.readFileSync(path,'utf8');
 const ast=ts.createSourceFile(path,text,ts.ScriptTarget.Latest,true);const edits=[];
 for(const node of ast.statements) {
  if(ts.isImportDeclaration(node)&&node.moduleSpecifier.text==='./page-support') {
   const bindings=node.importClause?.namedBindings;
   if(!bindings||!ts.isNamedImports(bindings))continue;
   const formatting=bindings.elements.filter(e=>names.has(e.propertyName?.text??e.name.text));
   const components=bindings.elements.filter(e=>!formatting.includes(e));
   const imports=[];
   if(formatting.length)imports.push(`import ${node.importClause.isTypeOnly?'type ':''}{ ${formatting.map(e=>e.getText(ast)).join(', ')} } from './page-formatting';`);
   if(components.length)imports.push(`import ${node.importClause.isTypeOnly?'type ':''}{ ${components.map(e=>e.getText(ast)).join(', ')} } from './page-support';`);
   edits.push({start:node.getStart(ast),end:node.end,text:imports.join('\n')});
  }
  if(filename==='page-support.tsx'&&ts.isExportDeclaration(node)&&node.moduleSpecifier?.text==='./page-formatting')edits.push({start:node.getStart(ast),end:node.end,text:''});
 }
 for(const e of edits.sort((a,b)=>b.start-a.start))text=text.slice(0,e.start)+e.text+text.slice(e.end);
 if(edits.length)fs.writeFileSync(path,text);
}
