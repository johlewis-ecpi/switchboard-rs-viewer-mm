const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
const {dom,find,environment,open,settle,executeBundle}=require('./helpers.cjs');
test('manifest and package validation enforce installer constraints and reproducible builds',async()=>{
  const {build}=await import('../scripts/build.mjs');const {validateManifest,validatePackage}=await import('../scripts/manifest.mjs');
  const manifest=JSON.parse(fs.readFileSync(path.join(__dirname,'../reader.json'),'utf8'));
  for(const patch of [{apiVersion:2},{id:'../escape'},{extensions:['.txt']},{extensions:['txt','TXT']},{extensions:[]},{entry:'../outside.html'},{unknown:true}])assert.throws(()=>validateManifest({...manifest,...patch}));
  const directory=await build();const before=fs.readFileSync(path.join(directory,'index.html'),'utf8');await build();assert.equal(fs.readFileSync(path.join(directory,'index.html'),'utf8'),before);
  const checked=await validatePackage(directory);assert.equal(checked.manifest.id,manifest.id);assert(checked.html.includes('MIT License'));assert(checked.bytes<16*1024*1024);
});
test('validator permits embedded images but rejects external assets and escaping entries',async()=>{
  const os=require('node:os');const {validatePackage}=await import('../scripts/manifest.mjs');
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'viewer-package-'));
  try {
    const manifest=JSON.parse(fs.readFileSync(path.join(__dirname,'../reader.json'),'utf8'));
    fs.writeFileSync(path.join(temporary,'reader.json'),JSON.stringify(manifest));
    fs.writeFileSync(path.join(temporary,'index.html'),'<html><img src="data:image/png;base64,AA=="></html>');
    await validatePackage(temporary);
    fs.writeFileSync(path.join(temporary,'index.html'),'<html><img src="https://example.invalid/image.png"></html>');
    await assert.rejects(validatePackage(temporary),/Image assets/);
    fs.writeFileSync(path.join(temporary,'index.html'),'<script src="reader.js"></script>');
    await assert.rejects(validatePackage(temporary),/self-contained/);
    if(process.platform!=='win32'){
      const alias=temporary+'-link';fs.symlinkSync(temporary,alias);
      try{await assert.rejects(validatePackage(alias),/symlink/);}finally{fs.unlinkSync(alias);}
    }
  } finally {fs.rmSync(temporary,{recursive:true,force:true});}
});
