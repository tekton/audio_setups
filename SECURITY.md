# Security

## What this project is
A static web app (vanilla JS) that keeps everything in the visitor's own browser (`localStorage`), plus an optional local development backend (FastAPI + Postgres) that the published site does not use. There are no accounts, no server-side user data and no secrets in the repository.

## Reporting a problem
Please open a private report through GitHub: **Security > Report a vulnerability** on this repository. If that isn't available, open an issue that says you have a security concern without including exploit details, and I'll follow up.

## What is covered
- The published site (`npm run build:local`): imported files (layouts, backups, device and port types), share links (`#share=`), Library packs and anything shown from `localStorage` are treated as untrusted. Pages carry a Content-Security-Policy; see [docs/PUBLISHING.md](docs/PUBLISHING.md#security-of-the-published-build).
- Dependencies: `npm audit` and `pip-audit` run in CI, and Dependabot proposes updates weekly.
- Secrets: GitHub secret scanning and push protection are on for the repository. Don't commit `.env` files or keys; the only credentials in the repo are the throwaway development database values in `docker-compose.yml`.

## What is not covered
- The development backend (`backend/`, `docker-compose.yml`) has no authentication, allows any origin and uses default credentials. It is meant to run on your own machine (ports are bound to 127.0.0.1). Don't expose it to a network or the internet.
- Data in `localStorage` is readable by anyone using the same browser profile; don't put anything sensitive in layouts.

## For contributors
- Build DOM with `createElement`/`textContent`, never `innerHTML` with data; no inline scripts or styles (they would break the Content-Security-Policy; `e2e/csp.spec.js` checks).
- Validate anything that comes from a file or a link before storing it (`frontend/js/library-core.js`).
