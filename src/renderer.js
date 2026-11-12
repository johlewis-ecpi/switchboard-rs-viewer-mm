/* Outline view of a mind map. Independent of Switchboard's transport and catalog. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MindMapRenderer = api;
})(globalThis, function () {
  'use strict';
  function renderMindMap(model, {document: metadata, signal, dom = globalThis.document}) {
    const node = (tag, text, className) => {
      const element = dom.createElement(tag);
      if (text !== undefined) element.textContent = text;
      if (className) element.className = className;
      return element;
    };
    const article = node('article');
    article.append(node('p', `${metadata.name} · ${model.generator}${model.version ? ' ' + model.version : ''}`, 'filename'), node('h1', model.title));
    const toolbar = node('div', undefined, 'toolbar');
    const searchLabel = node('label', 'Find nodes ');
    const search = node('input'); search.type = 'search'; search.placeholder = 'Search this map';
    searchLabel.append(search);
    const expand = node('button', 'Expand all'), collapse = node('button', 'Collapse all');
    expand.type = collapse.type = 'button';
    toolbar.append(searchLabel, expand, collapse); article.append(toolbar);
    const count = node('p', undefined, 'count'); count.setAttribute('role', 'status'); count.setAttribute('aria-live', 'polite');
    article.append(count);
    const empty = node('p', '', 'empty');
    const records = [];

    function build(item, parent) {
      const li = node('li', undefined, 'item');
      const label = node('span', undefined, 'label');
      if (item.color) li.style.setProperty('--node-color', item.color);
      if (item.background) label.style.setProperty('--node-background', item.background);
      if (item.color) li.classList.toggle('colored', true);
      if (item.background) label.classList.toggle('filled', true);
      label.append(node('span', item.text || '(empty)', item.text ? 'text' : 'text blank'));
      for (const icon of item.icons) label.append(node('span', icon, 'badge'));
      if (item.link) label.append(node('span', '↗ ' + item.link, 'link'));
      const extras = node('div', undefined, 'extras');
      if (item.details) extras.append(node('p', item.details, 'details'));
      if (item.note) { const note = node('p', item.note, 'note'); note.setAttribute('aria-label', 'Note'); extras.append(note); }
      if (item.attributes.length) {
        const list = node('dl', undefined, 'attributes');
        for (const attribute of item.attributes) list.append(node('dt', attribute.name), node('dd', attribute.value));
        extras.append(list);
      }
      const record = {li, parent, details: null, kids: [], visible: true,
        text: [item.text, item.note, item.details, item.link, ...item.icons, ...item.attributes.flatMap(a => [a.name, a.value])].join('\n').toLocaleLowerCase(), folded: item.folded};
      records.push(record);
      const head = item.children.length ? node('summary') : node('div', undefined, 'leaf');
      head.append(label);
      if (item.children.length) {
        const details = node('details'); details.open = !item.folded; record.details = details;
        const list = node('ul'); list.setAttribute('role', 'group');
        for (const child of item.children) { const childRecord = build(child, record); record.kids.push(childRecord); list.append(childRecord.li); }
        details.append(head, extras, list); li.append(details);
      } else li.append(head, extras);
      return record;
    }
    const top = build(model.root, null);
    const tree = node('ul', undefined, 'tree'); tree.setAttribute('role', 'tree'); tree.setAttribute('aria-label', 'Mind map outline');
    tree.append(top.li); article.append(tree, empty);

    function filter() {
      const query = search.value.trim().toLocaleLowerCase(); let matches = 0;
      (function visit(record) {
        const self = !query || record.text.includes(query);
        let below = false;
        for (const kid of record.kids) if (visit(kid)) below = true;
        record.visible = self || below;
        if (query && self) matches++;
        record.li.hidden = !record.visible;
        if (record.details) record.details.open = query ? below : !record.folded;
        return record.visible;
      })(top);
      count.textContent = query ? `${matches} of ${records.length} nodes match` : `${records.length} nodes`;
      empty.textContent = query && !matches ? 'No nodes match your search.' : '';
      empty.hidden = !empty.textContent;
    }
    const setAll = open => { for (const record of records) if (record.details && record.visible) record.details.open = open || record === top; };
    search.addEventListener('input', filter, {signal});
    expand.addEventListener('click', () => setAll(true), {signal});
    collapse.addEventListener('click', () => setAll(false), {signal});
    filter();
    return article;
  }
  return Object.freeze({renderMindMap});
});
