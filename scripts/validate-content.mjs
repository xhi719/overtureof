import ts from 'typescript';
import fs from 'node:fs';
import path from 'node:path';
const locales = ['ko','en','zh-CN','zh-TW'];
const resources = Object.fromEntries(locales.map(l => [l, JSON.parse(fs.readFileSync(`content/${l}.json`, 'utf8').replace(/^\uFEFF/, ''))]));
const keys = new Set(Object.keys(resources.ko));
let errors = [];
for (const locale of locales) {
  for (const key of keys) if (typeof resources[locale][key] !== 'string' || !resources[locale][key].trim()) errors.push(`${locale}: missing ${key}`);
  for (const key of Object.keys(resources[locale])) if (!keys.has(key)) errors.push(`${locale}: unexpected ${key}`);
}
function walkDir(dir) { return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e => e.isDirectory() ? walkDir(path.join(dir,e.name)) : [path.join(dir,e.name)]); }
const files = ['app','components'].flatMap(walkDir);
const technical = new Set(['className','id','type','name','role','href','src','decoding','rel','target','method','autoComplete','htmlFor','viewBox','fill','stroke','xmlns','d','width','height','min','max','aria-hidden','aria-live','scope','lang','preserveAspectRatio','strokeWidth','vectorEffect','r','cx','cy','value','focusable','transform','offset','stopColor','stopOpacity','patternUnits','strokeOpacity','fillOpacity','points','x','y','x1','y1','x2','y2','rx','ry','opacity']);
for (const file of files) {
  const text = fs.readFileSync(file,'utf8').replace(/^\uFEFF/,'');
  if (file.endsWith('.css')) { for (const m of text.matchAll(/content\s*:\s*(['"])(.*?)\1/g)) if (m[2].trim()) errors.push(`${file}: nonempty CSS content`); continue; }
  if (!file.endsWith('.tsx')) continue;
  const source = ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  function visit(node) {
    if (ts.isJsxText(node) && /[\p{L}\p{N}]/u.test(node.text)) errors.push(`${file}:${source.getLineAndCharacterOfPosition(node.pos).line+1}: JSX text`);
    if (ts.isJsxAttribute(node) && node.initializer && ts.isStringLiteral(node.initializer) && !technical.has(node.name.getText(source)) && /[\p{L}\p{N}]/u.test(node.initializer.text)) errors.push(`${file}:${source.getLineAndCharacterOfPosition(node.pos).line+1}: literal attribute ${node.name.getText(source)}`);
    if (ts.isJsxExpression(node) && node.expression && ts.isStringLiteral(node.expression) && /[\p{L}\p{N}]/u.test(node.expression.text)) errors.push(`${file}:${source.getLineAndCharacterOfPosition(node.pos).line+1}: literal JSX expression`);
    if (ts.isElementAccessExpression(node) && node.argumentExpression && ts.isStringLiteral(node.argumentExpression) && ['c','copy'].includes(node.expression.getText(source)) && !keys.has(node.argumentExpression.text)) errors.push(`${file}: missing resource key ${node.argumentExpression.text}`);
    ts.forEachChild(node,visit);
  }
  visit(source);
}
if (errors.length) { console.error(errors.join('\n')); process.exitCode=1; } else console.log('Content resources and JSX literal checks passed.');
