import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {root} from './build.mjs';
import {readManifest} from './manifest.mjs';
const manifest = await readManifest(root);
const files = new Map([
  ['/', ['preview/index.html','text/html; charset=utf-8']],
  ['/harness.js', ['preview/harness.js','text/javascript; charset=utf-8']],
  ['/style.css', ['preview/style.css','text/css; charset=utf-8']],
  ['/package/reader.json',[`dist/${manifest.id}/reader.json`,'application/json']],
  ['/package/index.html',[`dist/${manifest.id}/index.html`,'text/html; charset=utf-8']],
  ...['welcome','freemind','edge-cases','empty','invalid'].map(name=>[`/samples/${name}.mm`,[`samples/${name}.mm`,'text/plain; charset=utf-8']])
]);
const server = http.createServer(async(req,res)=>{
  const resource = files.get((req.url||'').split('?')[0]);
  if (req.method!=='GET' || !resource) { res.writeHead(404);res.end('Not found');return; }
  try {
    const content = await readFile(path.join(root,resource[0]));
    res.writeHead(200,{'Content-Type':resource[1],'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',
      'Content-Security-Policy':"default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src data:; font-src data:; frame-src about:; base-uri 'none'; form-action 'none'"});
    res.end(content);
  } catch { res.writeHead(500);res.end('Build the package before previewing'); }
});
const port = Number(process.env.PORT ?? 4173);
if (!Number.isInteger(port) || port<0 || port>65535) throw Error('PORT must be an integer from 0 to 65535');
server.on('error',error=>{console.error(error.message);process.exitCode=1;});
server.listen(port,'127.0.0.1',()=>console.log(`Viewer preview: http://127.0.0.1:${server.address().port}`));
for (const signal of ['SIGINT','SIGTERM']) process.on(signal,()=>server.close());
