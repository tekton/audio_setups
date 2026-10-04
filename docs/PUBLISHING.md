# Publishing the local-only build

The published site is static files with no backend. Everything a visitor saves (layouts, custom device types, custom port types) lives in their own browser's localStorage.

## Build

```sh
npm run build:local     # writes dist/
npm run preview:local   # builds, then serves dist/ at http://localhost:4174
```

`build:local` copies `frontend/` into `dist/` (leaving out `tests/`, `test-touch.html`, the Dockerfile and nginx config) and sets `localOnly: true` in `dist/js/config.js`. The source `frontend/js/config.js` stays `localOnly: false`, which is what the dev setup (docker-compose with the FastAPI backend) uses.

## What local-only changes

- No requests to the backend: every call goes through `apiFetch` (`js/config.js`), which rejects immediately in a local-only build.
- The "Save/Load From" Server/Device selector and the "Save to server" buttons are hidden (anything marked `.server-only`).
- The app always uses device storage, even if an old "server" preference is in localStorage.

When adding a feature that talks to the backend, send it through `apiFetch` and mark any server-only UI with `class="server-only"` so the published build stays clean.

## Hosting

`dist/` is plain static files, so any static host works (GitHub Pages, Netlify, Cloudflare Pages, an S3 bucket). All links are relative, so it also works from a sub-path such as `https://<user>.github.io/<repo>/`. I haven't set up a deploy workflow yet.

## Things testers should know

- Layouts are per browser and per device: clearing site data erases them, and they don't follow you to another machine.
- Device types and port types have Export/Import JSON buttons for moving them between browsers; layouts don't yet.

## Tests

`e2e/local-only.spec.js` serves the local-only config to the real pages and asserts there are no `:7001` requests, the server controls are hidden, and save/load still works on all four pages.

## Phones and tablets

The app works on iPhone and iPad (Safari and Chrome on iOS both use WebKit): the toolbars wrap, controls are at least 44px with 16px text, ports get a larger invisible touch target, and tapping an output port then an input port draws a cable. This is covered by the `iphone` and `ipad` Playwright projects ([E2E_TESTS.md](E2E_TESTS.md)).

Things to tell testers:
- Layouts are stored per browser and per device. Chrome and Safari, or a phone and a tablet, don't share them. Use **Save & load > Export** to download a JSON file and **Import** on the other device.
- iOS can clear a site's storage after a while without visits, and private tabs lose it when closed. Export layouts that matter.
- If the browser blocks storage entirely, the app still runs but Save reports "Save failed".
