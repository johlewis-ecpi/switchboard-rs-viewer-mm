const {test}=require('node:test');const assert=require('node:assert/strict');
const {createReader}=require('../src/bridge.js');const {environment,open,settle}=require('./helpers.cjs');
function create(env,options={}){return createReader({window:env,extensions:['mm'],parse:text=>text,render:value=>value,mount(){},...options});}
test('binds before readiness; requires parent, API version, read-only text and supported extensions',async()=>{
  const env=environment();let mounted='';create(env,{mount:value=>mounted=value});
  assert(env.listeners.has('message'));assert.equal(env.messages[0].type,'switchboard:ready');assert.equal(env.messages[0].request,undefined);
  env.spoof(open(1,'spoof'));env.dispatch({...open(1),apiVersion:99});await settle();assert.equal(mounted,'');
  env.dispatch(open(1,'first'));await settle();assert.equal(mounted,'first');assert.equal(env.messages.at(-1).type,'switchboard:rendered');
  env.dispatch(open(1,'duplicate'));env.dispatch(open(0,'old'));await settle();assert.equal(mounted,'first');
  const writeable=open(2);writeable.document.readOnly=false;env.dispatch(writeable);await settle();assert.match(env.messages.at(-1).message,/read-only/);
  env.dispatch(open(3,'text','other'));await settle();assert.match(env.messages.at(-1).message,/extension/);
});
test('aborts old async work and never mounts or acknowledges stale output',async()=>{
  const env=environment();let completeOld,mounted,oldSignal;
  create(env,{parse:(text,{signal})=>text==='old'?(oldSignal=signal,new Promise(resolve=>completeOld=resolve)):text,mount:value=>mounted=value});
  env.dispatch(open(1,'old'));env.dispatch(open(2,'new'));await settle();assert(oldSignal.aborted);assert.equal(mounted,'new');
  completeOld('late');await settle();assert.equal(mounted,'new');assert.deepEqual(env.messages.filter(m=>m.type==='switchboard:rendered').map(m=>m.request),[2]);
});
test('reports parse/render/mount errors, clips messages, and survives failing error UI',async()=>{
  for(const callback of ['parse','render','mount']){
    const env=environment();create(env,{[callback]:()=>{throw Error('x'.repeat(2100));},onError:()=>{throw Error('error UI failure');}});
    env.dispatch(open());await settle();const result=env.messages.at(-1);assert.equal(result.type,'switchboard:error');assert.equal(result.request,1);assert.equal(result.message.length,2000);
  }
});
test('disposal cancels work and removes the listener; invalid request IDs are ignored',async()=>{
  const env=environment();let count=0;const reader=create(env,{mount:()=>count++});
  for(const request of [-1,NaN,1.2,Number.MAX_SAFE_INTEGER+1,'1'])env.dispatch(open(request));await settle();assert.equal(count,0);
  reader.dispose();assert(!env.listeners.has('message'));env.dispatch(open());await settle();assert.equal(count,0);
});
test('suppresses stale async render results and errors after disposal',async()=>{
  const env=environment();let resolveOld,rejectDisposed,mounted;
  const reader=create(env,{render:value=>value==='old'?new Promise(resolve=>resolveOld=resolve):value==='dispose'?new Promise((_,reject)=>rejectDisposed=reject):value,mount:value=>mounted=value});
  env.dispatch(open(1,'old'));await settle();env.dispatch(open(2,'new'));await settle();resolveOld('obsolete view');await settle();
  assert.equal(mounted,'new');assert.deepEqual(env.messages.filter(m=>m.type==='switchboard:rendered').map(m=>m.request),[2]);
  env.dispatch(open(3,'dispose'));await settle();reader.dispose();rejectDisposed(Error('late failure'));await settle();
  assert(!env.messages.some(m=>m.request===3));
});
