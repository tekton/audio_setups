# End-to-end tests (Playwright)

Browser tests that drive the real app in headless browsers: desktop Chromium with real mouse events, plus iPhone and iPad emulation on WebKit (the engine behind Safari and every iOS browser, Chrome included), then assert on what's on the page. They complement the unit tests (Jest for the frontend, pytest for the backend), which can't see drag and drop or the rendered canvas.

## Running

```sh
npm install                       # once; also installs @playwright/test
npx playwright install chromium webkit   # once; downloads the browsers (~200 MB)
npm run test:e2e                  # run everything (desktop, iphone and ipad projects)
npx playwright test --project=iphone   # one project: desktop | iphone | ipad
```

Useful variations:

| Command | What it does |
| --- | --- |
| `npx playwright test e2e/rack.spec.js` | One spec file |
| `npx playwright test -g "asterisk"` | Tests whose name matches |
| `npx playwright test --headed` | Watch the browser while it runs |
| `npx playwright test --ui` | Interactive runner: step through, time-travel, re-run on save |
| `npx playwright test --debug` | Pause in the Playwright inspector |
| `npx playwright show-trace test-results/<test>/trace.zip` | Replay a failed test (traces are kept on failure) |
| `npx playwright show-report` | Open the HTML report (written in CI mode) |

The config (`playwright.config.js`) starts a static server for `frontend/` on port 4173 automatically, and reuses one if it's already running. Python 3 must be on your PATH for that. No backend is needed: the helpers stub the API at `localhost:7001`, so the app uses device (localStorage) storage. Each test gets a fresh browser context, so saved layouts never leak between tests.

## What's covered

- `e2e/rack.spec.js` — snapping a device into a rack, refusing wide or overlapping drops, side-by-side devices and the shared-row asterisk, moving a rack with its devices, dragging a device out, deleting a rack.
- `e2e/ports.spec.js` — ports on top/bottom vs sides: the default, the canvas-wide switch, the per-device override, and the classic view default.
- `e2e/classic-and-storage.spec.js` — the classic view hides rack controls and keeps free-form device size; each view lists only its own saved layouts; a rack layout round-trips through save and load.

- `e2e/mobile.spec.js` — iPhone and iPad projects only: no sideways scrolling, buttons and fields at least 44px tall with 16px text (smaller text makes iOS zoom in), tap to select, dragging a device into a rack with touch events, connecting ports by tapping output then input, saving and reloading.
- `e2e/portability.spec.js` — iPhone, iPad and desktop: Export downloads a JSON file and Import loads it back, Import rejects the wrong page's layouts and non-layouts, and the app keeps working (saving reports the failure) when `localStorage` throws, as in some private or restricted browsers.

Not covered yet: drawing cables with shift-drag on desktop, the Device types and Port types pages, and saving to the server.

### How the mobile projects work

They are emulation: WebKit with a phone or tablet viewport, touch enabled and a mobile user agent. They catch layout, touch-event and storage problems but are not a real iOS device, so still try the published site on one before announcing it. Playwright's `touchscreen` can only tap, and desktop WebKit has no `Touch` constructor, so `mobile.spec.js` builds drags from `touchstart`/`touchmove`/`touchend` events carrying `touches` lists (`touchDrag`). The desktop-only specs (mouse drags) are not run on the mobile projects; add a spec to `MOBILE_SPECS` in `playwright.config.js` to include it.

## Writing tests

Shared helpers are in `e2e/helpers.js`: `openApp` (fresh page, API stubbed, dialogs accepted), `addRack`, `addDevice`, `setDeviceSize`, `dropInRack`, `drag`, `saveLayout`, `loadOptions`.

- Drag with `page.mouse` (via `drag`), not `locator.dragTo`: the app listens for `mousedown` on the canvas and `mousemove`/`mouseup` on the document.
- Grab a device near its top-left corner (`grabPoint`) so you don't hit a port circle. Shift-dragging from an output port starts a cable.
- Selecting a device opens the ports panel above the canvas and shifts everything down the page. Compare positions with `relBox` (relative to the canvas), not raw `boundingBox()`, whenever a selection may happen in between.
- SVG strokes add a few pixels to measured boxes. Use `expectNear` / `expectBoxNear` rather than exact equality.
- Prefer asserting on visible results (a device's box, `.rack-shared-mark` count, `#canvas-message` text) over internal state; the app's state lives in a module and isn't exposed.
- Put layout math you want to assert exactly in `frontend/js/rack-geometry.js` and unit test it in Jest instead; use e2e for wiring and interaction.

## CI

`.github/workflows/test.yml` has an `e2e` job that installs Chromium and WebKit and runs `npm run test:e2e` on every push and pull request. On failure it uploads `test-results/` (traces) and `playwright-report/` as the `playwright-traces` artifact; download it from the run's page and open a trace with `npx playwright show-trace`.
