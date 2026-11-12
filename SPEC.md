# Switchboard viewer starter specification

Specification version: **1.0.0**. Host protocol: **Switchboard viewer API v1**.
Document format: **FreeMind / Freeplane mind map**, extension `.mm`.

This specification describes the current Switchboard implementation and the
standalone starter delivered with it. **MUST** identifies an interoperability or
starter requirement; **SHOULD** identifies a recommended practice. Rules explicitly
marked *starter convention* are stronger than the host's minimum validation.
The host implementations in `src/viewer.rs`, `src/viewer_registry.rs`, and
`src/viewer.js` in the Switchboard repository remain the source of truth for
host behavior. This file travels with the copied starter and requires no access
to that repository to build a reader.

## 1. Goals and boundaries

A reader displays one supplied document, read-only, inside Switchboard. Its
format parser and view component MUST remain separable from its host bridge so
other applications can reuse them. The starter MUST build without an account,
external service, downloaded dependencies, Node runtime in the installed app,
or changes to Switchboard's library UI.

The starter demonstrates document parsing, safe table rendering, local filtering,
wrapping, loading/empty/error states, API messaging, cancellation, packaging,
validation, tests and a preview harness. It is not a Markdown, FreeMind,
GanttProject, Draw.io, Office or PDF implementation. Replacing its format modules
is the expected customization path.

API v1 has no editing/saving, filesystem traversal, catalog mutation, external
navigation, network API, binary document payload, theme message, printing/export,
configuration persistence, host-driven zoom, or explicit close message. A format
needing those capabilities requires a separately specified host/API extension;
a manifest cannot grant additional capabilities.

## 2. Responsibility split

| Layer | Owns | Does not own |
| --- | --- | --- |
| Switchboard host | File selection/access/decoding; registry; native adapters; iframe lifetime; loading/errors; install/disable/remove; sample test history and user verdicts | Format-specific parsers and web renderers |
| Reusable bridge | Message source/version/payload checks; readiness; request ordering; asynchronous result isolation; rendering/error reports | File IO, format semantics, catalog access |
| Format parser | Input validation and resource limits; immutable display model; supported/unsupported format features | Host protocol, DOM or application state |
| Renderer | Display model to read-only view; accessibility; local display interactions | Transport, source mutations, file picking |
| Composition layer | Wires modules and loading/error/mount callbacks | New format semantics or host privileges |
| Development harness | Emulates host messages and sandbox on loopback; sample/file controls; protocol diagnostics | Native Quick Look, catalog behavior or production test-history persistence |

Existing shared parsers/components SHOULD be imported from their owning project
at build time. Reader projects MUST NOT silently fork them by copying application
internals without a maintenance/versioning plan. The deployed reader consumes a
published, self-contained build; Switchboard never imports the owning app's source.

## 3. Source and distributable layouts

The source project contains the files listed in `README.md`. The distributable is
a folder, not an application executable or a ZIP installed directly:

```text
dist/<reader-id>/
  reader.json
  index.html
  LICENSE
```

Only the manifest and its HTML entry are required by the host. Installation
copies those two files, normalizes the copied entry to `index.html`, and rewrites
the copied manifest's `entry` accordingly. Other sibling assets are not copied.
The build also embeds license notices in the HTML so they survive installation.

The HTML MUST be UTF-8 and self-contained: inline JavaScript and CSS, with data
URLs for necessary fonts/images. Blob URLs created in memory may be used for
images. Neighboring JS/CSS files, remote CDNs, network libraries and dynamic
module imports MUST NOT be runtime dependencies. The starter emits classic
scripts; no module loader is present. Using a bundler in a derived project is
permitted if its final output obeys these constraints.

## 4. Manifest contract

`reader.json` is a UTF-8 JSON object. Unknown properties are rejected by the host.

| Property | Required | Type and rule |
| --- | --- | --- |
| `apiVersion` | Yes | Integer `1`. Other versions are unsupported. |
| `id` | Yes | Nonempty string. The installer requires 1–120 ASCII letters, digits, dots, underscores or hyphens; it cannot begin with a dot. Choose a stable unique ID such as `org.example.viewer`. |
| `name` | Yes | Nonempty display string; starter convention also rejects whitespace-only names. |
| `version` | No | String displayed by the manager. A semantic version is recommended; the host does not enforce semver. |
| `extensions` | Yes | Nonempty array for installed readers. Strings omit the leading dot and contain ASCII letters/digits, hyphens or underscores. Matching ignores case. Starter convention rejects duplicate extensions ignoring case. |
| `entry` | Yes | HTML file path contained within the package after canonicalization. The starter requires `index.html` and rejects absolute/traversal paths. |

The installer rejects already installed IDs, including reserved bundled/system
IDs. Duplicate active installed format handlers are rejected on install/enable;
manually introduced conflicts appear in the manager and prevent ambiguous
routing. Disabling a conflicting installed reader permits installing another.
System/native adapters and the bundled text fallback have different precedence:
a valid enabled installed extension handler takes precedence over them.

Package directory symlinks are rejected. Entry symlinks cannot escape the package.
File/path containment and byte-size limits are checked independently of schemas.
The starter's `schemas/reader.schema.json` and executable manifest checker encode
these requirements; filesystem and case-insensitive rules need extra checks.

## 5. Input transport and limits

| Input | Host limit / behavior |
| --- | --- |
| Manifest file | 64 KiB (`65,536` bytes) maximum |
| Reader HTML | 16 MiB (`16,777,216` bytes) maximum |
| Source document for web readers | 4 MiB (`4,194,304` bytes) maximum before decoding |
| Source encoding | Valid UTF-8 without NUL bytes, or BOM-marked UTF-16 LE/BE; malformed input is rejected |
| UTF-8 BOM | May reach the reader as leading U+FEFF; the sample parser accepts it |
| Metadata | Display `name` and extension without a dot; no file path, directory URL, bookmark or catalog record |
| Cloud/remote source files | The host's local-file availability rules apply; the reader cannot materialize/download files |

`document.text` is decoded text, not base64, an ArrayBuffer or an archive. A web
reader claiming `docx`, `pptx` or another binary format does not gain binary
access; decoding fails. Native Office/PDF preview adapters are a separate host
mechanism. No WebAssembly compilation permission is declared in the current
reader CSP, so a WASM-based parser needs an explicit host capability design.

The source filename extension is not proof of valid contents. Parsers MUST
validate actual structure/schema/version and give a useful error on unsupported
or malformed data. Samples and filenames MUST be treated as untrusted display
content and MUST NOT be interpreted as HTML or executable code.

## 6. Runtime sandbox and capability contract

The host creates an iframe with exactly `sandbox="allow-scripts"` and an opaque
origin, uses `srcdoc`, and sets `referrerpolicy="no-referrer"`. Reader frames do not
have `allow-same-origin`, form, popup, top-navigation or download capabilities.

The current child CSP is:

```text
default-src 'none';
script-src 'unsafe-inline';
style-src 'unsafe-inline';
img-src data: blob:;
font-src data:;
connect-src 'none';
frame-src 'none';
base-uri 'none';
form-action 'none'
```

The host may impose an additional inherited policy. A reader cannot loosen
policies by adding its own CSP. It MUST NOT read `parent.document`, invoke
Switchboard IPC/native handlers, request arbitrary files, fetch network resources,
rely on a persistent origin/storage, or require a nested iframe. Only the
`postMessage` protocol below is a supported connection to the host.

The sandbox is not a performance guarantee: synchronous parsing can block the
reader's web content thread. Derived readers SHOULD set input/model limits,
avoid unbounded recursion, and use cooperative cancellation where possible.

## 7. Message protocol

Messages are structured-cloneable plain objects. All messages MUST contain
`apiVersion: 1` and the exact `type`. Request-specific messages MUST echo the
current numeric `request` unchanged. This starter accepts nonnegative safe JS
integers (`0` through `9,007,199,254,740,991`). The current host normally creates
a new frame per document; the starter additionally supports newer requests in
one frame to make reuse safe.

Reader receivers MUST check `event.source === parent` before trusting a payload.
The host checks that the sender is its current iframe and, where applicable,
that the request matches. Because the iframe origin is opaque, checking for a
specific `event.origin` string is insufficient; `"null"` is not an identity.
`postMessage(..., '*')` is intentional and necessary for opaque-origin frames.
Unknown message types/API versions are ignored. Unknown object fields may be
ignored for forward compatibility; the sample manifest has stricter rules.

### 7.1 Reader → host: readiness

```js
{ type: 'switchboard:ready', apiVersion: 1 }
```

Register the message listener and initialize callbacks before sending readiness.
Send it once per frame, after the reader can accept an open message. There is no
request ID yet. The host fails startup if readiness is absent after 15 seconds.
Readiness MUST NOT be used as a document rendering or visual success signal.

### 7.2 Host → reader: open

```js
{
  type: 'switchboard:open', apiVersion: 1, request: 42,
  document: {
    name: 'sample.mm', extension: 'mm',
    text: '{"schemaVersion":1,...}', readOnly: true
  }
}
```

`name`, `extension` and `text` MUST be strings, and `readOnly` MUST be exactly
`true`. The starter checks that the extension belongs to the manifest's formats,
ignoring case. A valid new request aborts prior work and clears old content via
`onLoading`. Wrong-source/version/type messages and invalid/duplicate/older IDs
are ignored; errors in a valid new request's document are reported with its ID.

### 7.3 Reader → host: rendering completed

```js
{ type: 'switchboard:rendered', apiVersion: 1, request: 42 }
```

This message is optional for legacy API v1 readers and required by this starter.
Send it only after parsing, creating the view, mounting current output, and
reaching the next animation frame. Async resources that affect rendering SHOULD
be awaited by the renderer before it returns. There is no general host rendering
timeout after readiness in the current API.

This means **the reader reports completion**. It is not a screenshot comparison,
user verdict or promise of correct pagination/appearance. Only the user can mark
rendering visually confirmed in the manager.

### 7.4 Reader → host: error

```js
{
  type: 'switchboard:error', apiVersion: 1, request: 42,
  message: 'Unsupported sample report schemaVersion; expected 1'
}
```

The starter sends a human-readable message clipped to 2,000 UTF-16 code units.
It MUST NOT dump the document text, credentials, stack traces or private paths
into an error. The host replaces reader content with an error view; the reader
SHOULD also expose an accessible local error for standalone development.

A bootstrap failure before any open message has no valid request to report. It
is detected by the host's startup deadline. A stale request's failure MUST NOT
replace the current document or emit an acknowledgement for the wrong request.
The host may remove the frame at any time; no close message is guaranteed.

## 8. Reusable bridge interface and lifecycle

`src/bridge.js` exports `SwitchboardViewer.createReader(options)` in the browser
and the same API through CommonJS for tests. Its callbacks are:

| Option | Contract |
| --- | --- |
| `extensions` | Supported extensions; injected from the manifest in this starter |
| `parse(text, context)` | Pure/cooperatively cancellable parser; may return a value or Promise |
| `render(model, context)` | Produces an unattached view; may return a value or Promise |
| `mount(view)` | Synchronously installs the current output |
| `onLoading(document)` | Clears old output/errors and exposes a loading state |
| `onError(message)` | Shows an accessible error; a failing error UI does not suppress the host error report |
| `window` | Optional browser environment override for automated tests |

Parser/renderer context contains `{document, signal}`. The signal is an
`AbortSignal`, cancelled when a newer request arrives or `dispose()` is called.
The returned object's `dispose()` removes the message listener and aborts work.
The bridge checks current-request identity after every await and before result
messages. A synchronous parser cannot be interrupted mid-call; async libraries
that ignore cancellation can finish, but their stale output is discarded.

Derived renderers MUST avoid modifying live host/reader DOM before returning a
view. Otherwise an obsolete asynchronous renderer could cause visible changes
before the bridge can reject its result. Attach per-view event listeners with
the supplied signal, and release owned resources when work is aborted.

## 9. FreeMind / Freeplane `.mm` format

`.mm` files are XML with a `<map version="…">` root containing one root `<node>`.
Freeplane (`version="freeplane …"`) and FreeMind (`version="0.9.0"`, `1.0.1`) maps
are both accepted. The parser (`src/format.js`) is a small non-validating XML
reader with no DOM dependency; DTDs are skipped and never expanded.

| Source | Model field |
| --- | --- |
| `node/@TEXT`, `@LOCALIZED_TEXT`, or `richcontent[@TYPE=NODE]` | `text` (rich HTML flattened to plain text) |
| `richcontent[@TYPE=NOTE]`, legacy `hook` NodeNote `<text>` | `note` |
| `richcontent[@TYPE=DETAILS]` | `details` |
| `node/@LINK` | `link` (shown as text, never clickable) |
| `icon/@BUILTIN` | `icons` (shown as badges) |
| `attribute/@NAME,@VALUE` | `attributes` |
| `@COLOR`, `@BACKGROUND_COLOR` | `color`, `background` only if `#RRGGBB`, else dropped |
| `@FOLDED="true"` | initial collapsed state |
| child `node` elements | `children`, in document order |

Errors: not well-formed XML (with line number), root element not `map`, or no
root `node`. Limits: 4,194,304 text units, 400,000 XML elements, 512 XML depth,
50,000 map nodes, 256 map depth; text fields longer than 20,000 characters are
truncated with an ellipsis. HTML void tags (`<br>`) are tolerated inside notes.

Intentionally omitted: left/right layout (`POSITION`), fonts, edges, clouds,
arrow links, images, embedded `hook` data other than notes, and relative-resource
resolution (no files other than the document are available to API v1). The
outline view preserves hierarchy and order only. The model is deeply frozen.

## 10. Rendering and accessibility

The view shows the source display name, generator and version, the root title,
a labeled search field, Expand all / Collapse all buttons, a live node count, and
a nested outline of `<details>`/`<summary>` elements. All source values MUST
reach the DOM through `textContent`; colors are applied only as validated
`#RRGGBB` CSS custom properties. Normal, empty, no-search-matches, loading and
error states MUST be distinguishable.

Search is a case-insensitive substring match across a node's text, note,
details, link, icons and attributes. Matching nodes and their ancestors stay
visible and ancestors open; clearing the search restores each node's `FOLDED`
state. Expand/Collapse affect only visible nodes of the current view. Nothing
modifies the source document.

The view MUST support keyboard access (native `summary` toggling), visible focus,
text selection, small widths, Unicode, and light/dark system appearance.
Transitions respect `prefers-reduced-motion`.

## 11. Build and validation

Node.js 20+ is a development prerequisite. `npm run check` MUST run without
`npm install` or network access. `npm run build` reads `reader.json`, injects
supported extensions, concatenates the four explicitly ordered IIFE scripts,
inlines CSS, embeds the license and emits the installable folder. It does not
resolve `require`, npm packages, ES imports or dynamic imports. Derived projects
may replace this builder while preserving the output contract.

The builder rejects script/style closing-container literals in trusted source,
missing/multiple template placeholders, invalid manifests and oversized entries.
Untrusted source documents are never interpolated into the HTML build. Builds
are deterministic for unchanged inputs. `npm run validate` checks the built
package; `node scripts/validate.mjs <package-folder>` checks another folder with
the starter's rules.

Validation checks structure, encoding, known placeholders and some obvious
external-resource references. It is not a JavaScript audit or proof that code
cannot try a forbidden operation. The CSP is the runtime authority. JSON schemas
are supplied for tools/editors, not executed through a third-party validator by
this project; executable validators and tests enforce the runtime rules.

## 12. Preview harness

`npm run preview` builds and serves a local harness on `127.0.0.1`, default port
4173. `PORT=0` selects a free port. The server exposes an exact file allowlist;
it is not a general file server and has no upload/write endpoints. Control–C
stops it. Sample/local file contents are read in-browser and sent only to the
sandboxed frame; logs include names and lifecycle messages, not document text.

The parent harness may fetch its own local assets; the child's stricter CSP
forbids fetches. Each open creates a new iframe before sending the document.
The harness MUST reject events from obsolete frames, show a startup deadline,
and keep reader reports separate from the manual visual verdict. It includes
normal, Unicode/literal-markup, empty, and invalid samples. A local file picker
supports the same UTF-8/BOM-marked UTF-16 text family and 4 MiB byte bound.

It does not reproduce native file/bookmark access, registry conflicts, installer
copying, macOS window focus, or persistent manager test history. Final acceptance
MUST include the actual packaged Switchboard host.

## 13. Installation, updates and health semantics

Use **Settings → Viewers → Install…** and select the built `<reader-id>` folder.
Do not select the source root or its parent `dist`. The installed copy is isolated
from subsequent source builds. Current updates require removing the old installed
ID and installing the replacement; the installer does not overwrite existing IDs.
The original source package, source documents and development samples are not
removed when uninstalling the installed reader.

The manager displays source, version, formats, validation/conflicts, enablement
and the last sample result. Disabled readers are skipped for normal routing but
can be tested directly. **Test with Sample…** MUST use the chosen reader rather
than a fallback. Its statuses have these meanings:

| Observation | What it establishes |
| --- | --- |
| Valid package | Manifest/entry checks pass, not that code starts |
| Startup passed | Ready message received before deadline |
| Reader reports success | Current request sent rendering-completed message |
| Visually confirmed | User clicked Confirm Rendering after inspection |
| Failed/not completed | Error, user-reported problem or incomplete check; inspect detail |
| Stale test | Reader HTML/manifest fingerprint differs from the tested copy |

A test applies to its sample and reader version, not every file of that extension.
No reader message can record a user-confirmed verdict. Switchboard owns test
history, stored separately from the catalog. The preview's manual verdict is
session-only and does not update Switchboard history.

## 14. Required verification and acceptance matrix

| Case | Automated starter tests | Browser/native acceptance expectation |
| --- | --- | --- |
| Normal sample | Parser/model, built script execution, rendered message | Three rows and readable title; test manager startup passes |
| Unicode and markup | Literal DOM text, scalar normalization | Unicode legible; markup remains text; zero inserted cell scripts/images |
| Empty document | Zero rows | Explicit empty state, successful render report |
| Search/wrap | Filtering counts, no-match state, class change | Keyboard interaction and horizontal scrolling work |
| Invalid/unsupported input | Parse errors, schema/type/bound checks | Error appears; no rendering success for that request |
| Wrong parent/API/request | Spoof, unsupported API, duplicate/older/invalid IDs ignored | Unrelated frame messages do not alter reader/host |
| Async supersession | Old signal aborted; stale completion discarded | Rapid sample changes show the latest selection |
| Error UI failure | Host still receives clipped original error | Host's error view remains usable |
| Disposal | Listener removed; pending result suppressed | Closing the preview/test leaves no late document replacement |
| Resource constraints | Row/column/cell/text limits | Test representative largest supported files; bound parsing time/memory |
| Packaging | Manifest/path rules, standalone bundle, deterministic output | Install the output folder in real Switchboard |
| Sandbox | Modeled protocol tests | Parent DOM access rejected; network/assets absent; sandbox/CSP preserved |
| Health result | No self-confirmation path | Confirm Rendering/Report Problem correctly affect manager results |
| Version change | Build output changes when source changes | Old installed-copy results become stale only when that installed copy changes |
| Accessibility | Semantic DOM construction | Tab navigation, visible focus, system dark mode, narrow window, screen-reader review |

`npm run check` is necessary but not sufficient for release: VM-backed DOM tests
cannot establish browser layout, native focus, or visual correctness. Test the
browser harness and a real native-host sample for each supported format/version.
Readers wrapping another application's library SHOULD also run that library's
format fixtures and regression suite.

## 15. Release and reuse checklist

1. Replace example ID/name/extensions and customize parser, renderer and samples.
2. Document the supported subset and intentional omissions for the real format.
3. Keep source libraries reusable; bundle licenses and pin added dependencies.
4. Pass automated checks and the acceptance matrix, recording tested host/platform
   versions and representative sample files.
5. Increment reader `version` for changed releases; keep ID stable for updates.
6. Distribute the built package folder and its notices, plus source/specification
   as appropriate. Extract any archive before using the host folder installer.
7. Verify actual installation and removal without altering source documents.

For Markdown/GAN/FreeMind/Draw.io readers, document relative-resource handling,
unsupported schema features, nested structures, cycles and layout limits. If an
existing Swift/Rust core cannot run under the current web contract, design a
reusable native adapter or a new protocol capability separately; do not silently
add application-specific parsing or privileges to Switchboard's shell.
