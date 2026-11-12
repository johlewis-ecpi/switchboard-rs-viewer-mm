const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
const {parseMindMap,parseXml,htmlToText,limits}=require('../src/format.js');
const sample=name=>fs.readFileSync(path.join(__dirname,'../samples',name+'.mm'),'utf8');
const wrap=body=>`<map version="1.0.1">${body}</map>`;
test('parses a Freeplane map: notes, details, icons, attributes, links, folding, colors',()=>{
  const map=parseMindMap(sample('welcome'));assert.equal(map.generator,'Freeplane');assert.equal(map.title,'Project Plan');assert.equal(map.nodeCount,8);assert(Object.isFrozen(map.root));
  assert.equal(map.root.note,'Top-level notes.\nSecond paragraph.');assert.equal(map.root.color,'#2a6fdb');
  const [research,build,ship]=map.root.children;assert.deepEqual([...research.icons],['idea']);assert.equal(research.children[0].link,'https://example.com/spec');
  assert.equal(research.children[1].background,'#ffff99');assert.equal(build.folded,true);assert.equal(build.details,'Due in Q3');assert.deepEqual({...build.attributes[0]},{name:'owner',value:'Alex'});assert.equal(ship.children.length,0);
});
test('parses legacy FreeMind rich-text nodes, loose <br>, and NodeNote hooks',()=>{
  const map=parseMindMap(sample('freemind'));assert.equal(map.generator,'FreeMind');
  assert.equal(map.root.children[0].text,'Rich text node\nsecond line');assert.equal(map.root.children[1].note,'Legacy note text');
});
test('keeps hostile text literal, rejects unsafe colors, tolerates DTD/entities/CDATA',()=>{
  const map=parseMindMap(sample('edge-cases'));const kids=map.root.children;
  assert(map.root.text.includes('&')&&map.root.text.includes('<b>literal</b>'));assert(kids[0].text.includes('<img'));assert(kids[1].text.includes('</script>'));
  assert.equal(kids[2].color,'');assert.equal(kids[2].background,'');assert(kids[3].text.includes('©')&&kids[3].text.includes('\u{1F600}')&&kids[3].text.includes('&unknown;')&&kids[3].text.includes('&lol;'));
  assert.equal(kids[4].text,'');assert.equal(kids[5].note,'• one\n• two\n<raw>');
  assert.equal(parseMindMap('﻿'+sample('empty')).title,'Just a root');
});
test('rejects malformed, non-map and rootless input with useful errors',()=>{
  assert.throws(()=>parseMindMap(sample('invalid')),/not valid XML.*Mismatched end tag/);
  for(const text of ['','not xml','<a>','<a/><b/>','<a x="1></a>','<!-- x','text<a/>'])assert.throws(()=>parseMindMap(text),/not valid XML/);
  assert.throws(()=>parseMindMap('<other/>'),/expected a <map>/);assert.throws(()=>parseMindMap(wrap('')),/no root node/);
  assert.throws(()=>parseMindMap(42),/text limit/);
});
test('enforces resource limits',()=>{
  assert.throws(()=>parseMindMap('x'.repeat(limits.characters+1)),/limit/);
  assert.throws(()=>parseMindMap(wrap('<node TEXT="a">'.repeat(limits.depth+1)+'</node>'.repeat(limits.depth+1))),/deeper/);
  assert.throws(()=>parseXml('<a>'.repeat(limits.xmlDepth+1)),/too deeply/);
  assert.throws(()=>parseMindMap(wrap('<node TEXT="r">'+'<node/>'.repeat(limits.nodes)+'</node>')),/more than/);
  const big=parseMindMap(wrap(`<node TEXT="${'x'.repeat(limits.text+10)}"/>`));assert.equal(big.root.text.length,limits.text+1);
});
test('htmlToText flattens markup to text only',()=>{
  assert.equal(htmlToText(parseXml('<html><head><title>t</title></head><body><p>a &amp; b</p><script>x()</script><p>c</p></body></html>')),'a & b\nc');
});
