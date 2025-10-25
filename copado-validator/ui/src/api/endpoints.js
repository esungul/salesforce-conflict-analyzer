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


// In api/endpoints.js - ADD THIS
export async function getMultiOrgComponentHistory({ 
  orgA, orgB, branchA, branchB, components, limit = 5 
}) {
  const payload = { orgA, orgB, branchA, branchB, components, limit };
  
  const res = await fetch(`${API_URL}/api/component-history`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!res.ok) throw new Error(`API Error: ${res.status}`);
  
  const body = await res.json();
  
  // Transform response format
  const results = {};
  body.history?.forEach(comp => {
    const key = `${comp.component_type}/${comp.component_name}`;
    results[key] = {
      orgA: comp.orgA?.commits || [],
      orgB: comp.orgB?.commits || []
    };
  });

  return {
    orgA: body.orgA || { name: orgA, branch: branchA },
    orgB: body.orgB || { name: orgB, branch: branchB },
    results: results,
    meta: { totalComponents: components.length, limit, success: body.success }
  };
}


// Add these new functions to your existing endpoints.js

/**
 * Component History API
 * GET /api/component-history
 */
/**
 * Get component history across TWO environments for comparison
 * Uses the existing /api/component-history endpoint with multi-org parameters


/**
 * Environment Comparison API
 * POST /api/compare-orgs
 */



/**
 * Code Diff API
 * POST /api/get-code-diff
 */
export async function getCodeDiff({ component, source_branch, target_branch }) {
  const payload = {
    component,
    source_branch,
    target_branch
  };

  const apiUrl = `${API_URL}/api/get-code-diff`;
  console.log('🔍 Code Diff API Call:', {
    fullUrl: apiUrl,
    payload: payload
  });

  const res = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  let body, text = '';
  try { body = await res.json(); } catch { try { text = await res.text(); } catch {} }

  if (!res.ok) {
    const msg = body?.message || text || `HTTP ${res.status}`;
    throw new Error(`Code diff error ${res.status}: ${msg}`);
  }

  return body;
}


export async function compareOrgs({ 
  components, 
  // Original parameters
  source_branch, 
  target_branch,
  // Multi-org parameters
  orgA,
  orgB, 
  branchA,
  branchB,
  include_diffs = true, 
  changed_only = true, 
  limit = 20 
}) {
  // Build payload based on available parameters
  const payload = {
    components: Array.isArray(components) ? components : [components],
    include_diffs,
    changed_only,
    limit
  };

  console.log('🔍 compareOrgs received parameters:', {
    orgA, orgB, branchA, branchB, source_branch, target_branch
  });

  // Support both original and multi-org patterns
  if (orgA && orgB) {
    // Multi-org pattern
    payload.orgA = orgA;
    payload.orgB = orgB;
    if (branchA) payload.branchA = branchA;
    if (branchB) payload.branchB = branchB;
    console.log('✅ Using multi-org pattern');
  } else if (source_branch && target_branch) {
    // Original pattern (branch-only)
    payload.source_branch = source_branch;
    payload.target_branch = target_branch;
    console.log('✅ Using branch-only pattern');
  } else {
    console.log('❌ No valid parameters provided');
    throw new Error('Either provide orgA/orgB OR source_branch/target_branch parameters');
  }

  const apiUrl = `${API_URL}/api/compare-orgs`;
  console.log('🔍 Compare Orgs API Call:', {
    fullUrl: apiUrl,
    payload: payload
  });

  try {
    const startTime = Date.now();
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const endTime = Date.now();
    console.log('📡 Response Details:', {
      status: res.status,
      statusText: res.statusText,
      responseTime: `${endTime - startTime}ms`,
      ok: res.ok
    });

    let responseBody, responseText = '';
    
    // Try to parse as JSON first
    try { 
      responseBody = await res.json();
      console.log('✅ Response JSON parsed successfully');
      console.log('🎉 FULL RESPONSE BODY:', JSON.stringify(responseBody, null, 2));
    } catch (jsonError) { 
      console.log('❌ JSON parse failed, trying text...');
      try { 
        responseText = await res.text();
        console.log('📄 Response as text:', responseText);
      } catch (textError) {
        console.log('❌ Text parse also failed');
      }
    }

    if (!res.ok) {
      const msg = responseBody?.message || responseText || `HTTP ${res.status}`;
      console.log('❌ API Error Response:', {
        status: res.status,
        message: msg,
        body: responseBody,
        text: responseText
      });
      throw new Error(`Compare orgs error ${res.status}: ${msg}`);
    }

    // Transform the backend response to our expected format
    console.log('🔄 Transforming response format...');
    
    // The backend returns:
    // {
    //   "changes": [ { component_name, component_type, status, ... } ],
    //   "orgA": { name, branch },
    //   "orgB": { name, branch },
    //   "success": true,
    //   "summary": { changed, same, not_found, total }
    // }
    
    // We need to transform to:
    // {
    //   comparison: { components: [ { name, type, changed, ... } ] },
    //   meta: { ... }
    // }
    
   const transformedComparison = {
  components: (responseBody.changes || []).map(change => ({
    name: change.component_name,
    type: change.component_type,
    changed: change.status !== 'SAME', // Convert status to boolean
    status: change.status,
    commitA: change.commitA,
    commitB: change.commitB,
    diff_summary: change.diff_summary || null,
    details: change.details || null,
    diff: change.diff || null // Include the diff data
  }))
};

    console.log('📊 Transformed Comparison:', {
      componentCount: transformedComparison.components.length,
      changedCount: transformedComparison.components.filter(c => c.changed).length,
      sameCount: transformedComparison.components.filter(c => !c.changed).length
    });

    // Log individual component details
    if (transformedComparison.components.length > 0) {
      console.log('🔍 Component Details:');
      transformedComparison.components.forEach((comp, index) => {
        console.log(`   ${index + 1}. ${comp.type}/${comp.name}`, {
          changed: comp.changed,
          status: comp.status,
          commitA: comp.commitA,
          commitB: comp.commitB
        });
      });
    }

    // Return normalized response
    return {
      comparison: transformedComparison,
      meta: {
        orgA: orgA || null,
        orgB: orgB || null,
        branchA: branchA || source_branch,
        branchB: branchB || target_branch,
        total_components: responseBody.summary?.total || transformedComparison.components.length,
        changed_components: responseBody.summary?.changed || transformedComparison.components.filter(c => c.changed).length,
        same_components: responseBody.summary?.same || transformedComparison.components.filter(c => !c.changed).length,
        not_found_components: responseBody.summary?.not_found || 0,
        success: responseBody.success !== undefined ? responseBody.success : true,
        response_time: endTime - startTime,
        original_response: responseBody // Include original for debugging
      }
    };

  } catch (error) {
    console.log('💥 Fetch error:', error);
    console.log('💥 Error stack:', error.stack);
    throw error;
  }
}


// ===============================
// compare-orgs-v2 endpoints
// ===============================


// ===============================
// compare-orgs-v2 endpoints
// ===============================

/**
 * Base call for /api/compare-orgs-v2
 * @param {Object} body - {orgs, components, include_diffs, changed_only, diff_base_org, unified_context}
 * @param {Object} [opts] - {signal?: AbortSignal}
 */
export async function compareOrgsV2(body, opts = {}) {
  const apiUrl = `${API_URL}/api/compare-orgs-v2`;     // ← use API_URL like other endpoints
  console.log('🔍 compareOrgsV2 call', { url: apiUrl, body });

  const res = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: opts.signal
  });

  let json, text = '';
  try { json = await res.json(); } catch { try { text = await res.text(); } catch {} }

  if (!res.ok) {
    const msg = (json && (json.error || json.message)) || text || `HTTP ${res.status}`;
    console.error('❌ compareOrgsV2 error', { status: res.status, msg, json, text });
    throw new Error(`compareOrgsV2 HTTP ${res.status}: ${msg}`);
  }

  return json;
}

/** Phase 1 (fast): status only, no diffs */
export function compareOrgsV2Status({ orgs, components, diff_base_org, unified_context = 3 }, opts) {
  return compareOrgsV2(
    {
      orgs,
      components,
      include_diffs: false,   // status only
      changed_only: false,    // list all files
      diff_base_org,
      unified_context
    },
    opts
  );
}

/** Phase 2 (focused): diffs for a single component */
export function compareOrgsV2Diff({ orgs, component, diff_base_org, unified_context = 3 }, opts) {
  return compareOrgsV2(
    {
      orgs,
      components: [component],
      include_diffs: true,    // include hunks/tokens
      changed_only: true,     // only changed files
      diff_base_org,
      unified_context
    },
    opts
  );
}
