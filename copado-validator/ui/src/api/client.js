// ui/src/api/client.js
import { API_URL, FEATURES } from '../config.js';

/**
 * Fetch with sensible defaults:
 * - base URL from config
 * - timeout (AbortController)
 * - JSON parsing w/ normalization ({success,data} or raw)
 * - detailed Error on non-2xx or backend-declared failure
 */
export async function apiFetch(path, { method='GET', headers={}, body, timeoutMs=60000 } = {}) {
  const url = `${API_URL || ''}${path}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort('Request timed out'), timeoutMs);

  let res;
  try {
    res = await fetch(url, { method, headers, body, signal: ctrl.signal, credentials: 'same-origin' });
  } catch (err) {
    clearTimeout(timer);
    // Network/abort errors
    throw enrichError(err, { url, method, hint: 'Network error or CORS/timeout.' });
  } finally {
    clearTimeout(timer);
  }

  const contentType = res.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');

  // Try to parse JSON (backend should always return JSON)
  let payload = null;
  if (isJson) {
    try { payload = await res.json(); }
    catch (err) {
      throw enrichError(err, { url, method, status: res.status, hint: 'Invalid JSON from server.' });
    }
  } else {
    // Non-JSON fallback (shouldn’t happen in our API)
    const text = await res.text();
    if (!res.ok) {
      throw makeHttpError({ url, method, status: res.status, body: text, hint: 'Non-JSON error response.' });
    }
    return text;
  }

  // Normalize common shapes:
  // 1) { success: true, data: {...} }
  // 2) { success: false, error: '...' }
  // 3) { ...raw payload... }
  if (!res.ok) {
    const message = payload?.error || payload?.message || `HTTP ${res.status}`;
    throw makeHttpError({ url, method, status: res.status, body: payload, hint: message });
  }
  if (payload && typeof payload === 'object') {
    if (payload.success === false) {
      const message = payload?.error || payload?.message || 'Request failed';
      throw makeHttpError({ url, method, status: res.status, body: payload, hint: message });
    }
    // prefer payload.data when present
    return payload.data !== undefined ? payload.data : payload;
  }
  return payload;
}

/**
 * Helper for POSTing FormData (file uploads or simple fields)
 */
export function postForm(path, formData, opts = {}) {
  // Let the browser set multipart boundaries; do not set Content-Type manually
  return apiFetch(path, { method: 'POST', body: formData, ...opts });
}

/**
 * Helper for POSTing JSON
 */
export function postJson(path, json, opts = {}) {
  return apiFetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    body: JSON.stringify(json ?? {}),
    ...opts,
  });
}

/* ===== Error helpers ===== */
function makeHttpError({ url, method, status, body, hint }) {
  const err = new Error(hint || `HTTP ${status} on ${method} ${url}`);
  err.name = 'HttpError';
  err.status = status;
  err.url = url;
  err.method = method;
  err.body = body;
  return err;
}

function enrichError(err, extra = {}) {
  const e = err instanceof Error ? err : new Error(String(err));
  Object.assign(e, extra);
  return e;
}

/* ===== Compatibility checks (light validators) ===== */

/**
 * Validate the core analysis response shape expected by the UI.
 * New API contract (both CSV and Online) should return:
 * {
 *   summary: { totalStories:number, conflicts:number, regressions:number, blocked:number, ... },
 *   conflicts: Array,
 *   regressions: Array,
 *   all_stories: Array
 * }
 * We keep it permissive but surface warnings in dev.
 */


export function validateAnalysisShape(data) {
  if (!data || typeof data !== 'object') return false;

  const conflicts = Array.isArray(data.conflicts)
    ? data.conflicts
    : Array.isArray(data.component_conflicts)
    ? data.component_conflicts
    : null;

  // regressions optional
  const regressions =
    Array.isArray(data.regressions) ? data.regressions :
    Array.isArray(data.production_regressions) ? data.production_regressions : [];

  // all_stories optional (we can derive)
  const allStories = Array.isArray(data.all_stories) ? data.all_stories : null;

  const ok = !!conflicts;
  if (!ok && FEATURES?.telemetry) {
    console.warn('[API] Unexpected analysis shape', {
      hasSummary: !!data?.summary,
      hasConflicts: Array.isArray(data?.conflicts),
      hasComponentConflicts: Array.isArray(data?.component_conflicts),
      hasRegressions: Array.isArray(data?.regressions) || Array.isArray(data?.production_regressions),
      hasAllStories: Array.isArray(data?.all_stories),
      sample: data,
    });
  }
  return ok;
}


/**
 * Normalize optional fields the UI depends on (non-destructive).
 */

export function normalizeAnalysis(data) {
  const safe = data && typeof data === 'object' ? data : {};

  // Prefer standard keys; fallback to backend-specific
  const conflicts = Array.isArray(safe.conflicts)
    ? safe.conflicts
    : Array.isArray(safe.component_conflicts)
    ? safe.component_conflicts
    : [];

  const regressions = Array.isArray(safe.regressions)
    ? safe.regressions
    : Array.isArray(safe.production_regressions)
    ? safe.production_regressions
    : [];

  // Derive all_stories if missing
  let all_stories = Array.isArray(safe.all_stories) ? safe.all_stories : [];
  if (!all_stories.length && conflicts.length) {
    const set = new Set();
    for (const c of conflicts) {
      const inv = Array.isArray(c?.involved_stories) ? c.involved_stories : [];
      inv.forEach(s => set.add(s));
    }
    all_stories = Array.from(set);
  }

  // Build summary from backend if available; otherwise derive
  const bs = (safe.summary && typeof safe.summary === 'object') ? safe.summary : {};
  const summary = {
    // Prefer backend counts when present
    totalStories:
      typeof bs.totalStories === 'number' ? bs.totalStories :
      typeof bs.stories === 'number'      ? bs.stories      :
      all_stories.length,

    conflicts:
      typeof bs.conflicts === 'number'            ? bs.conflicts :
      typeof bs.component_conflicts === 'number'  ? bs.component_conflicts :
      conflicts.length,

    regressions:
      typeof bs.regressions === 'number' ? bs.regressions :
      regressions.length,

    blocked:
      typeof bs.blocked === 'number' ? bs.blocked :
      (safe.blocked || 0),
  };

  return {
    summary,
    conflicts,
    regressions,
    all_stories,
    // keep original fields too for advanced tabs
    ...safe,
  };
}