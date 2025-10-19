// ui/src/config.js
// Central place for environment + feature flags

// 1) Defaults (safe for local file:// or simple static hosting)
const DEFAULTS = {
  ENV: 'DEV',
  API_URL: 'http://localhost:5000', // same-origin. e.g., set to 'http://localhost:5000' if your backend runs elsewhere
  FEATURES: {
    onlineAnalyze: false,   // we'll turn this on later
    telemetry: false,       // console timings/logs
  },
};

// 2) Optional runtime override via window.__CONFIG__ (set from console or another script)
/*
  Example:
  window.__CONFIG__ = {
    ENV: 'UAT',
    API_URL: 'http://localhost:5000',
    FEATURES: { onlineAnalyze: true }
  }
*/
const RUNTIME = (typeof window !== 'undefined' && window.__CONFIG__) ? window.__CONFIG__ : {};

// 3) Merge (shallow for top-level, shallow for FEATURES)
function mergeConfig(base, override) {
  const out = { ...base, ...override };
  out.FEATURES = { ...(base.FEATURES || {}), ...(override.FEATURES || {}) };
  return out;
}

export const CONFIG = mergeConfig(DEFAULTS, RUNTIME);

// 4) Convenience named exports
export const ENV = CONFIG.ENV;
export const API_URL = CONFIG.API_URL;
export const FEATURES = CONFIG.FEATURES;

// 5) Small helper to update header badges at boot (used by main.js)
export function applyHeaderBadges() {
  const envEl = document.getElementById('env-badge');
  const sourceEl = document.getElementById('source-badge');
  if (envEl) envEl.textContent = `ENV: ${ENV}`;
  if (sourceEl) sourceEl.textContent = `Source: —`; // will change after first analyze
}

// 6) Tiny debug helper
export function debugLog(...args) {
  if (FEATURES.telemetry) console.log('[UI]', ...args);
}
