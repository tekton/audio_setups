/**
 * Build-time settings, loaded before the app scripts. `npm run build:local` flips localOnly to true
 * for the published build: no backend calls, no server storage options, everything in browser storage.
 */
window.APP_CONFIG = { localOnly: false };

// Backend requests go through here so a local-only build never touches the network
window.apiFetch = (url, options) => (window.APP_CONFIG.localOnly
  ? Promise.reject(new Error('Local-only build: no backend'))
  : fetch(url, options));

if (window.APP_CONFIG.localOnly) document.documentElement.dataset.localOnly = 'true';
