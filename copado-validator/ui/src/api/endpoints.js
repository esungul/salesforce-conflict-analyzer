// ui/src/api/endpoints.js
import { postForm, postJson, validateAnalysisShape, normalizeAnalysis } from './client.js';
import { API_URL, FEATURES } from '../config.js';

export async function analyzeFromSalesforce({ repo, branch, filters }) {
  const rn = filters?.releaseNames ?? [];
  const us = filters?.userStoryNames ?? [];

  // Build payload that matches your examples exactly
  const payload = {
    ...(repo ? { repo } : {}),
    ...(branch ? { branch } : {}),
    ...(rn.length === 1 ? { releaseNames: rn[0] } : {}),     // single string only
    ...(us.length > 0 ? { userStoryNames: us } : {}),        // array
  };

  if (!payload.releaseNames && !payload.userStoryNames) {
    throw new Error('Provide releaseNames (single string) or userStoryNames (array).');
  }

  const data = await postJson('/api/analyze-sf', payload);
  validateAnalysisShape(data);
  return normalizeAnalysis(data);
}

/**
 * CSV upload analysis
 * Matches: curl -X POST /api/analyze -F file=@/path/to/export.csv
 */
export async function analyzeFromCsv({ file }) {
  if (!file) throw new Error('Please select a CSV file.');
  const fd = new FormData();
  fd.append('file', file);

  const data = await postForm('/api/analyze', fd);
  validateAnalysisShape(data);
  return normalizeAnalysis(data);
}

// --- Enforcement: compare components vs production branch ---
export async function checkProductionState({ components, branch = 'master' }) {
  const payload = {
    branch,
    components: (components || []).map(c => ({ type: c.type, name: c.name }))
  };

  // FIX: Use API_URL in both logging AND the actual fetch call
  const apiUrl = `${API_URL}/api/production-state`;
  console.log('🔍 Frontend API Call Details:', {
    fullUrl: apiUrl,
    apiUrl: apiUrl,
    payload: payload,
    componentsCount: components?.length || 0
  });

  // FIX: Use the full URL with API_URL in the fetch call
  const res = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  console.log('🔍 Response Status:', res.status, res.statusText);

  // Try to parse JSON; capture raw text if not JSON
  let body = null;
  let text = '';
  try { body = await res.json(); } catch { try { text = await res.text(); } catch {} }

  if (!res.ok) {
    const msg = body?.message || text || `HTTP ${res.status}`;
    throw new Error(`Production state error ${res.status}: ${msg}`);
  }

  // Normalize your backend shape -> { components: [...] , meta: {...} }
  const items = Array.isArray(body?.production_state) ? body.production_state : [];
  const norm = items.map(p => ({
    type: p.component_type || p.type || '',
    name: p.component_name || p.name || '',
    exists: !!(p.exists_in_prod ?? (p.last_commit_hash || p.last_commit_date)),
    commit_date: p.last_commit_date || '',
    commit_sha: p.last_commit_hash || '',
    author: p.last_author || '',
    branch: body.branch || branch
  }));

  return {
    components: norm,
    meta: {
      branch: body.branch || branch,
      checked_at: body.checked_at || null,
      total: body.total_components ?? norm.length,
      existing: body.existing ?? null,
      missing: body.missing ?? null,
      success: body.success ?? true
    }
  };
}

// Unified Analyze Stories API
export async function analyzeStories({ userStoryNames, releaseNames, configJsonPath } = {}) {
  const payload = {};
  if (typeof userStoryNames !== 'undefined') {
    payload.userStoryNames = Array.isArray(userStoryNames) ? userStoryNames : String(userStoryNames);
  }
  if (typeof releaseNames !== 'undefined') {
    payload.releaseNames = Array.isArray(releaseNames) ? releaseNames : String(releaseNames);
  }
  if (typeof configJsonPath !== 'undefined') {
    payload.configJsonPath = configJsonPath;
  }

  const res = await fetch(`${API_URL}/api/analyze-stories`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  let body, text = '';
  try { body = await res.json(); } catch { try { text = await res.text(); } catch {} }

  if (!res.ok) {
    const msg = (body && (body.error || body.message)) || text || `HTTP ${res.status}`;
    throw new Error(msg);
  }

  // Normalize a bit for downstream callers
  const component_conflicts = Array.isArray(body?.component_conflicts) ? body.component_conflicts
                               : Array.isArray(body?.conflicts) ? body.conflicts
                               : [];
  const story_conflicts     = Array.isArray(body?.story_conflicts) ? body.story_conflicts : [];
  const summary             = body?.summary || {};

  return { summary, component_conflicts, story_conflicts, raw: body };
}

