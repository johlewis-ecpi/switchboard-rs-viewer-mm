/* Composition root. Connects the .mm parser/renderer to the Switchboard host adapter. */
(function () {
  'use strict';
  const content = document.getElementById('content');
  const status = document.getElementById('status');
  const error = document.getElementById('error');
  SwitchboardViewer.createReader({
    extensions: /* SUPPORTED_EXTENSIONS */,
    parse: MindMapFormat.parseMindMap,
    render: MindMapRenderer.renderMindMap,
    onLoading() { error.hidden = true; content.replaceChildren(); status.textContent = 'Reading mind map…'; },
    mount(view) { content.replaceChildren(view); status.textContent = ''; },
    onError(message) { content.replaceChildren(); status.textContent = ''; error.textContent = message; error.hidden = false; }
  });
})();
