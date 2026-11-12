/* Reusable host adapter. It does not know the document format or render UI. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SwitchboardViewer = api;
})(globalThis, function () {
  'use strict';
  function createReader({parse, render, mount, onLoading = () => {}, onError = () => {}, extensions, window: env = globalThis}) {
    if (![parse, render, mount].every(fn => typeof fn === 'function')) throw new Error('parse, render and mount callbacks are required');
    if (!Array.isArray(extensions) || !extensions.length) throw new Error('Declare supported extensions');
    let latest = -1, controller = null, disposed = false;
    const send = message => env.parent.postMessage({apiVersion: 1, ...message}, '*');
    function isCurrent(request) { return !disposed && request === latest && !controller.signal.aborted; }
    async function open(event) {
      const message = event.data;
      if (disposed || event.source !== env.parent || !message || message.apiVersion !== 1 || message.type !== 'switchboard:open') return;
      const {request, document: doc} = message;
      if (!Number.isSafeInteger(request) || request < 0 || request <= latest) return;
      controller?.abort(); controller = new env.AbortController(); latest = request;
      const signal = controller.signal;
      try {
        if (!doc || typeof doc.name !== 'string' || typeof doc.text !== 'string' || typeof doc.extension !== 'string' || doc.readOnly !== true) {
          throw new Error('Expected a read-only text document from the host');
        }
        if (!extensions.some(ext => ext.toLowerCase() === doc.extension.toLowerCase())) throw new Error('Unsupported document extension');
        onLoading(doc);
        const model = await parse(doc.text, {signal, document: doc});
        if (!isCurrent(request)) return;
        const view = await render(model, {signal, document: doc});
        if (!isCurrent(request)) return;
        mount(view);
        await new Promise(resolve => env.requestAnimationFrame(resolve));
        if (isCurrent(request)) send({type: 'switchboard:rendered', request});
      } catch (error) {
        if (!isCurrent(request)) return;
        const message = String(error?.message || 'Could not display document').slice(0, 2000);
        // Error UI must not prevent the host from learning about a failure.
        try { onError(message); } catch { /* Preserve the original failure if error UI also fails. */ }
        send({type: 'switchboard:error', request, message});
      }
    }
    // Bind first, announce readiness second. No parent DOM access or host IPC.
    env.addEventListener('message', open);
    send({type: 'switchboard:ready'});
    return Object.freeze({dispose() {
      disposed = true; controller?.abort(); env.removeEventListener('message', open);
    }});
  }
  return Object.freeze({createReader});
});
