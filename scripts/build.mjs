import {mkdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {readManifest, validatePackage} from './manifest.mjs';
export const root = fileURLToPath(new URL('../',import.meta.url));
export async function build() {
  const manifest = await readManifest(root);
  if (manifest.entry !== 'index.html') throw Error('The starter builder emits index.html; keep entry set to index.html');
  const scripts = [];
  for (const name of ['bridge.js','format.js','renderer.js','main.js']) scripts.push(await readFile(path.join(root,'src',name),'utf8'));
  const javascript = scripts.join('\n;\n').replace('/* SUPPORTED_EXTENSIONS */',JSON.stringify(manifest.extensions));
  // These files are trusted source code, not user documents. Refuse syntax that
  // could terminate the inline HTML containers; use escaped literals instead.
  if (/<\/script/i.test(javascript)) throw Error('Escape closing script tags in JavaScript source');
  const css = await readFile(path.join(root,'src/style.css'),'utf8');
  if (/<\/style/i.test(css)) throw Error('Escape closing style tags in CSS source');
  const license = await readFile(path.join(root,'LICENSE'),'utf8');
  const template = await readFile(path.join(root,'src/index.html'),'utf8');
  if (template.split('/* VIEWER_STYLES */').length!==2 || template.split('/* VIEWER_SCRIPTS */').length!==2) throw Error('HTML must contain one style and one script placeholder');
  const html = '<!--\n'+license.replaceAll('--','—')+'\n-->\n'+template.replace('/* VIEWER_STYLES */',()=>css).replace('/* VIEWER_SCRIPTS */',()=>javascript);
  const destination = path.join(root,'dist',manifest.id);
  await mkdir(destination,{recursive:true});
  await writeFile(path.join(destination,'index.html'),html);
  await writeFile(path.join(destination,'reader.json'),JSON.stringify(manifest,null,2)+'\n');
  await writeFile(path.join(destination,'LICENSE'),license);
  await validatePackage(destination);
  return destination;
}
if (process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) console.log('Built reader package: '+await build());
