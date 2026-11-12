# FreeMind / Freeplane viewer for Switchboard

A read-only, offline Switchboard API v1 reader for FreeMind and Freeplane `.mm`
mind maps, built from the Switchboard viewer template. It shows the map as a
collapsible, searchable outline with notes, details, icons, attributes, links
(as text) and node colors. No npm dependencies; Node.js 20+ is only needed for
development. See [SPEC.md](SPEC.md) for the format subset and limits.

## Build and preview

Run these commands from this directory:

```sh
npm run check
npm run preview
```

Open the localhost address printed by `preview`. The default is
[http://127.0.0.1:4173](http://127.0.0.1:4173); use `PORT=0 npm run preview` to choose
an available port. Stop the preview with Control–C. No `npm install` is required.

The harness loads the reader inside an opaque-origin sandbox using Switchboard's
reader CSP. Select the Freeplane, legacy FreeMind, Unicode/markup, root-only, or invalid sample, or choose
a local file. The startup status, rendering report, manual verdict and protocol
log are distinct. No document contents are written to the protocol log.
The harness is a development tool; the final acceptance check runs in Switchboard.

## Install the sample in Switchboard

1. Run `npm run build`.
2. Open Switchboard **Settings → Viewers → Install…**.
3. Select `dist/switchboard.freemind-viewer/` (the package folder, not `dist/`).
4. Click its **Test with Sample…** and select `samples/welcome.mm`.
5. Inspect the report and click **Confirm Rendering**, or **Report Problem**.

The starter does not install itself or modify your existing reader registry.
Switchboard copies the built package; rebuilding this source directory does not
change the installed copy. To update it, remove the old installed reader and
install the newly built folder. Source samples remain in place.

## Project layout

| Path | Purpose |
| --- | --- |
| `SPEC.md` | Normative API v1 contract, sample format and acceptance criteria |
| `reader.json` | Source manifest; extensions are the build-time source of truth |
| `src/bridge.js` | Parent-message validation, readiness, cancellation, results |
| `src/format.js` | Pure `.mm` XML parser and model |
| `src/renderer.js` | Outline renderer, independent of the bridge |
| `src/main.js` | Small composition layer |
| `src/index.html`, `src/style.css` | Reader shell, accessible states and styling |
| `scripts/` | Build, package validation and loopback preview server |
| `preview/` | Host simulation with the same sandbox/CSP and protocol log |
| `schemas/` | Manifest and API-message JSON schemas |
| `samples/` | Normal, Unicode/markup, empty, and invalid documents |
| `test/` | Unit and built-package integration tests |
| `dist/<reader-id>/` | Generated installable package; excluded from source control |

## Verification

`npm run check` builds and validates the package, then tests message boundaries,
read-only payloads, duplicate/stale requests, async cancellation, parser/resource
limits, error reporting, safe DOM output, filtering/wrapping, and reproducibility.
JSON schemas are supplied for editor/tooling integration; no schema-validation
library is installed. The executable parser and manifest checker enforce runtime
rules, including constraints that JSON Schema alone cannot express.

Before releasing, follow the browser/native acceptance matrix in `SPEC.md`.
A valid manifest is not a successful startup; a reader's rendering report is
not visual confirmation. Tests and the harness do not prove every real-world
file in the declared format will render correctly.

## License

MIT; see `LICENSE`. The build embeds this notice in the HTML so the notice remains
with the installed entry. Preserve licenses for any parser, renderer or assets
you add, and include their required notices in your distributable build.
