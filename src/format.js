/* Pure FreeMind/Freeplane (.mm) parser. No DOM or DOMParser dependency, so it runs in tests and the reader. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MindMapFormat = api;
})(globalThis, function () {
  'use strict';
  const limits = Object.freeze({characters: 4 * 1024 * 1024, xmlDepth: 512, elements: 400000, nodes: 50000, depth: 256, text: 20000});
  const VOID = new Set(['br', 'hr', 'img', 'meta', 'link', 'input', 'wbr', 'col', 'area', 'base']);
  const ENTITIES = {lt: '<', gt: '>', amp: '&', quot: '"', apos: "'", nbsp: ' ', copy: '©', reg: '®', hellip: '…', mdash: '—', ndash: '–', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', bull: '•', euro: '€'};
  const decode = text => text.indexOf('&') < 0 ? text : text.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z][a-z0-9]*);/gi, (all, name) => {
    if (name[0] === '#') {
      const code = name[1] === 'x' || name[1] === 'X' ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
      return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff) ? String.fromCodePoint(code) : '�';
    }
    return Object.hasOwn(ENTITIES, name) ? ENTITIES[name] : all;
  });
  const NAME = /^[A-Za-z_:][A-Za-z0-9_:.-]*$/;
  const TAG_NAME = /[^\s/>]+/y, ATTR_NAME = /[^\s=/>]+/y, UNQUOTED = /[^\s>]*/y, SPACE = /\s*/y;

  /* Minimal, non-validating XML reader. DTDs are skipped (never expanded), so entity bombs are impossible.
     HTML void tags (<br>) are tolerated because FreeMind embeds loose HTML in notes. */
  function parseXml(text) {
    const stack = [], length = text.length;
    let root = null, i = 0, buffer = '', elements = 0;
    const fail = (message, at = i) => {
      let line = 1;
      for (let k = text.indexOf('\n'); k >= 0 && k < at; k = text.indexOf('\n', k + 1)) line++;
      throw new Error(`${message} (line ${line})`);
    };
    const skipTo = (marker, label, from) => { const end = text.indexOf(marker, from); if (end < 0) fail(`Unterminated ${label}`); return end; };
    const flush = () => {
      if (!buffer) return;
      if (stack.length) stack[stack.length - 1].content.push(buffer);
      else if (buffer.trim()) fail('Text outside the root element');
      buffer = '';
    };
    const regex = (re, at) => { re.lastIndex = at; const m = re.exec(text); return m ? m[0] : null; };
    while (i < length) {
      const lt = text.indexOf('<', i);
      if (lt < 0) { buffer += decode(text.slice(i)); break; }
      if (lt > i) { buffer += decode(text.slice(i, lt)); i = lt; }
      if (text.startsWith('<!--', i)) i = skipTo('-->', 'comment', i + 4) + 3;
      else if (text.startsWith('<![CDATA[', i)) { const end = skipTo(']]>', 'CDATA section', i + 9); buffer += text.slice(i + 9, end); i = end + 3; }
      else if (text.startsWith('<?', i)) i = skipTo('?>', 'processing instruction', i + 2) + 2;
      else if (text.startsWith('<!', i)) {
        let depth = 0, j = i + 2;
        for (; j < length; j++) { const c = text[j]; if (c === '[') depth++; else if (c === ']') depth--; else if (c === '>' && depth <= 0) break; }
        if (j >= length) fail('Unterminated declaration');
        i = j + 1;
      } else if (text[i + 1] === '/') {
        const end = skipTo('>', 'end tag', i), name = text.slice(i + 2, end).trim();
        flush();
        const top = stack[stack.length - 1];
        if (top && top.name === name) stack.pop();
        else if (!VOID.has(name.toLowerCase())) fail(top ? `Mismatched end tag </${name}>; expected </${top.name}>` : `Unexpected end tag </${name}>`);
        i = end + 1;
      } else {
        const name = regex(TAG_NAME, i + 1);
        if (!name || !NAME.test(name)) fail('Invalid element name');
        if (++elements > limits.elements) fail('Document has too many elements');
        const attrs = Object.create(null), start = i;
        let j = i + 1 + name.length, selfClosed = false;
        for (;;) {
          j += regex(SPACE, j).length;
          if (j >= length) fail('Unterminated start tag', start);
          if (text[j] === '>') { j++; break; }
          if (text[j] === '/' && text[j + 1] === '>') { selfClosed = true; j += 2; break; }
          const attr = regex(ATTR_NAME, j);
          if (!attr) fail('Malformed attribute', j);
          j += attr.length; j += regex(SPACE, j).length;
          let value = '';
          if (text[j] === '=') {
            j++; j += regex(SPACE, j).length;
            const quote = text[j];
            if (quote === '"' || quote === "'") { const end = text.indexOf(quote, j + 1); if (end < 0) fail('Unterminated attribute value', j); value = decode(text.slice(j + 1, end)); j = end + 1; }
            else { const raw = regex(UNQUOTED, j); value = decode(raw); j += raw.length; }
          }
          attrs[attr] = value;
        }
        flush();
        const element = {name, attrs, content: []};
        if (stack.length) stack[stack.length - 1].content.push(element);
        else if (root) fail('More than one root element', start);
        else root = element;
        if (!selfClosed && !VOID.has(name.toLowerCase())) {
          if (stack.length >= limits.xmlDepth) fail('Document is nested too deeply', start);
          stack.push(element);
        }
        i = j;
      }
    }
    flush();
    if (stack.length) fail(`Unclosed element <${stack[stack.length - 1].name}>`, length);
    if (!root) fail('No XML element found', 0);
    return root;
  }

  const BLOCK = new Set(['p', 'div', 'br', 'li', 'ul', 'ol', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'tr', 'table', 'pre', 'blockquote', 'hr', 'body']);
  const SKIP = new Set(['head', 'style', 'script', 'title']);
  /* Flatten embedded HTML (rich text, notes) to plain text. Never produces markup. */
  function htmlToText(element) {
    let out = '';
    const walk = node => {
      if (typeof node === 'string') { out += node.replace(/\s+/g, ' '); return; }
      const name = node.name.toLowerCase();
      if (SKIP.has(name)) return;
      const block = BLOCK.has(name);
      if (block) out += '\n';
      if (name === 'li') out += '• ';
      for (const child of node.content) walk(child);
      if (block) out += '\n';
    };
    walk(element);
    return out.split('\n').map(line => line.replace(/[  ]+/g, ' ').trim()).join('\n').replace(/\n{2,}/g, '\n').trim();
  }

  const clip = value => value.length > limits.text ? value.slice(0, limits.text) + '…' : value;
  const color = value => /^#[0-9A-Fa-f]{6}$/.test(value || '') ? value : '';
  const elementsOf = element => element.content.filter(child => typeof child !== 'string');

  function convert(element, depth, state) {
    if (depth > limits.depth) throw new Error(`Map is nested deeper than ${limits.depth} levels`);
    if (++state.count > limits.nodes) throw new Error(`Map has more than ${limits.nodes} nodes`);
    const a = element.attrs;
    let text = a.TEXT ?? a.LOCALIZED_TEXT, note = '', details = '';
    const icons = [], attributes = [], children = [];
    for (const child of elementsOf(element)) {
      const tag = child.name;
      if (tag === 'node') children.push(convert(child, depth + 1, state));
      else if (tag === 'richcontent') {
        const rich = htmlToText(child), type = (child.attrs.TYPE || '').toUpperCase();
        if (type === 'NODE') { if (text === undefined) text = rich; }
        else if (type === 'NOTE') note = rich;
        else if (type === 'DETAILS') details = rich;
      } else if (tag === 'icon' && child.attrs.BUILTIN) icons.push(clip(child.attrs.BUILTIN));
      else if (tag === 'attribute' && child.attrs.NAME !== undefined) attributes.push(Object.freeze({name: clip(child.attrs.NAME), value: clip(child.attrs.VALUE ?? '')}));
      else if (tag === 'hook' && /NodeNote/.test(child.attrs.NAME || '') && !note) {
        const legacy = elementsOf(child).find(item => item.name === 'text');
        if (legacy) note = htmlToText(legacy);
      }
    }
    return Object.freeze({
      text: clip(text ?? ''), note: clip(note), details: clip(details), link: clip(a.LINK ?? ''),
      color: color(a.COLOR), background: color(a.BACKGROUND_COLOR), folded: a.FOLDED === 'true',
      icons: Object.freeze(icons), attributes: Object.freeze(attributes), children: Object.freeze(children)
    });
  }

  function parseMindMap(text) {
    if (typeof text !== 'string' || text.length > limits.characters) throw new Error('Mind map exceeds the text limit');
    let map;
    try { map = parseXml(text.replace(/^﻿/, '')); }
    catch (error) { throw new Error('Mind map is not valid XML: ' + error.message); }
    if (map.name !== 'map') throw new Error('Not a FreeMind/Freeplane map: expected a <map> root element');
    const top = elementsOf(map).find(child => child.name === 'node');
    if (!top) throw new Error('Mind map contains no root node');
    const state = {count: 0}, version = map.attrs.version || '';
    const root = convert(top, 1, state);
    return Object.freeze({
      title: root.text.replace(/\s+/g, ' ').trim() || 'Untitled mind map',
      generator: /freeplane/i.test(version) ? 'Freeplane' : 'FreeMind',
      version, nodeCount: state.count, root
    });
  }
  return Object.freeze({parseMindMap, parseXml, htmlToText, limits});
});
