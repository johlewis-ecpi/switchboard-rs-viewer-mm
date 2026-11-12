'use strict';
let frame = document.getElementById('reader');
const status = document.getElementById('status');
const log = document.getElementById('log');
const confirmButton = document.getElementById('confirm');
const failButton = document.getElementById('fail');
const verdict = document.getElementById('verdict');
// Keep this policy aligned with src/viewer.js in the host app. The child cannot
// inherit the harness's localhost fetch permission because this tightens it.
const policy = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; connect-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'";
let html = '', request = 0, selection = 0, timer, expectedWindow = null, ready = false, pending = null;
function record(message) { log.textContent += JSON.stringify(message)+'\n'; }
function fail(message) { clearTimeout(timer);status.textContent='Error: '+message;confirmButton.disabled=true;record({event:'failure',message}); }
async function openDocument(name,text) {
  const current = ++request; ready=false;
  pending={type:'switchboard:open',apiVersion:1,request:current,document:{name,text,extension:name.split('.').pop().toLowerCase(),readOnly:true}};
  clearTimeout(timer);log.textContent='';status.textContent='Waiting for startup…';verdict.textContent='Rendering not visually verified.';
  confirmButton.disabled=true;failButton.disabled=true;
  // Replace the frame so a late event from the previous reader has a different source.
  const replacement=document.createElement('iframe');
  replacement.id='reader';replacement.title='Reader preview';replacement.setAttribute('sandbox','allow-scripts');replacement.referrerPolicy='no-referrer';
  replacement.srcdoc='<!doctype html><meta http-equiv="Content-Security-Policy" content="'+policy+'">'+html;
  frame.replaceWith(replacement);frame=replacement;
  expectedWindow=replacement.contentWindow;
  timer=setTimeout(()=>{if(request===current&&!ready)fail('Reader did not signal readiness within 15 seconds');},15000);
}
window.addEventListener('message',event=>{
  const message=event.data;
  if(event.source!==expectedWindow||!message||message.apiVersion!==1)return;
  if(message.type==='switchboard:ready'&&!ready){
    ready=true;clearTimeout(timer);record(message);status.textContent='Startup passed. Waiting for reader rendering report…';
    confirmButton.disabled=false;failButton.disabled=false;record({type:'switchboard:open',request,document:pending.document.name});
    expectedWindow.postMessage(pending,'*');
  } else if(message.request===request&&message.type==='switchboard:rendered'){
    record(message);status.textContent='Reader reports rendering completed. Check the document visually.';
  } else if(message.request===request&&message.type==='switchboard:error'){
    record(message);fail(message.message||'Reader error');
  }
});
function beginSelection() {
  const current=++selection;clearTimeout(timer);expectedWindow=null;
  status.textContent='Loading sample…';confirmButton.disabled=true;failButton.disabled=true;
  return current;
}
async function sample() {
  const current=beginSelection();
  try { const name=document.getElementById('sample').value+'.mm';const response=await fetch('/samples/'+name);if(!response.ok)throw Error('Could not load sample');const text=await response.text();if(current===selection)await openDocument(name,text); }
  catch(error){if(current===selection)fail(error.message);}
}
document.getElementById('open').addEventListener('click',sample);
document.getElementById('file').addEventListener('change',async event=>{
  const file=event.target.files[0];if(!file)return;const current=beginSelection();
  if(file.size>4*1024*1024)return fail('File exceeds the host’s 4 MiB limit');
  try {
    const bytes=await file.arrayBuffer();let encoding='utf-8';
    const head=new Uint8Array(bytes);if(head[0]===0xff&&head[1]===0xfe)encoding='utf-16le';if(head[0]===0xfe&&head[1]===0xff)encoding='utf-16be';
    if(current===selection)await openDocument(file.name,new TextDecoder(encoding,{fatal:true}).decode(bytes));
  } catch(error){if(current===selection)fail(error.message);}
});
confirmButton.addEventListener('click',()=>{verdict.textContent='Rendering visually confirmed for this sample.';record({event:'user-confirmed',request});});
failButton.addEventListener('click',()=>{verdict.textContent='User reported a rendering problem for this sample.';record({event:'user-reported-problem',request});});
(async()=>{
  try {const response=await fetch('/package/index.html');if(!response.ok)throw Error('Build the package first');html=await response.text();await sample();}
  catch(error){fail(error.message);}
})();
