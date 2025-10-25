// ============================================================================
// HISTORY API - API Functions
// src/ui/tabs/development-tools/history/api.js
// ============================================================================

import { API_ENDPOINTS, LIMITS } from '../constants.js';


/**
 * Fetch component history with commits
 */
export async function fetchComponentHistory(params) {
  const { branch, type, name, limit = LIMITS.DEFAULT_COMMIT_LIMIT } = params;

  if (!branch || !type || !name) {
    throw new Error('Branch, component type, and name are required');
  }

  if (limit < 1 || limit > LIMITS.MAX_CUSTOM_COMMITS) {
    throw new Error(`Limit must be between 1 and ${LIMITS.MAX_CUSTOM_COMMITS}`);
  }

  try {
    console.log(`🔍 Fetching component history for ${type}/${name} in ${branch}`, params);

    const payload = {
      branch,
      component: {
        type,
        name
      },
      limit
    };

    const response = await fetch(`${API_ENDPOINTS.COMPONENT_HISTORY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
      timeout: LIMITS.TIMEOUT_MS
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log(`✅ Component history fetched:`, data);

    return data;

  } catch (error) {
    console.error(`❌ Component history fetch error:`, error);
    throw error;
  }
}

/**
 * Fetch commit details
 */
export async function fetchCommitDetails(params) {
  const { branch, hash } = params;

  if (!branch || !hash) {
    throw new Error('Branch and commit hash are required');
  }

  try {
    console.log(`📋 Fetching commit details for ${hash} in ${branch}`);

    const response = await fetch(
      `${API_ENDPOINTS.COMMIT_HISTORY}/commit?branch=${branch}&hash=${hash}`,
      {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch commit: ${response.statusText}`);
    }

    const data = await response.json();
    console.log(`✅ Commit details fetched:`, data);

    return data;

  } catch (error) {
    console.error('❌ Commit details fetch error:', error);
    throw error;
  }
}

/**
 * Get deployment history (all branches)
 */
export async function getDeploymentHistory(params) {
  const { type, name, limit = LIMITS.DEFAULT_COMMIT_LIMIT } = params;

  if (!type || !name) {
    throw new Error('Component type and name are required');
  }

  const environments = [
    { key: 'uat', branch: 'uatsfdc', name: 'UAT' },
    { key: 'qasales', branch: 'qasales', name: 'QA' },
    { key: 'prep', branch: 'prep', name: 'PreProd' },
    { key: 'master', branch: 'master', name: 'Production' }
  ];

  const deploymentHistory = {};

  for (const env of environments) {
    try {
      console.log(`🔍 Fetching ${env.name} history...`);
      deploymentHistory[env.key] = await fetchComponentHistory({
        branch: env.branch,
        type,
        name,
        limit
      });
    } catch (error) {
      console.warn(`⚠️ Failed to fetch ${env.name} history:`, error);
      deploymentHistory[env.key] = null;
    }
  }

  return deploymentHistory;
}

/**
 * Compare versions across environments
 */
export async function compareVersions(params) {
  const { type, name } = params;

  if (!type || !name) {
    throw new Error('Component type and name are required');
  }

  try {
    console.log(`⇄ Comparing ${type}/${name} versions across all environments`);

    const response = await fetch(`${API_ENDPOINTS.COMPONENT_HISTORY}/compare`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        component: { type, name }
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to compare versions: ${response.statusText}`);
    }

    const data = await response.json();
    return data;

  } catch (error) {
    console.error('❌ Version comparison error:', error);
    throw error;
  }
}

/**
 * Get component changes between commits
 */
export async function getCommitDiff(params) {
  const { branch, hash1, hash2 } = params;

  if (!branch || !hash1 || !hash2) {
    throw new Error('Branch and both commit hashes are required');
  }

  try {
    console.log(`📊 Fetching diff between ${hash1} and ${hash2}`);

    const response = await fetch(
      `${API_ENDPOINTS.COMMIT_HISTORY}/diff?branch=${branch}&from=${hash1}&to=${hash2}`,
      {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      }
    );

    const data = await response.json();
    return data;

  } catch (error) {
    console.error('❌ Diff fetch error:', error);
    throw error;
  }
}

/**
 * Search commit history
 */
export async function searchCommitHistory(params) {
  const { branch, query, limit = LIMITS.DEFAULT_COMMIT_LIMIT } = params;

  if (!branch || !query) {
    throw new Error('Branch and search query are required');
  }

  try {
    console.log(`🔎 Searching commits in ${branch} for: ${query}`);

    const response = await fetch(`${API_ENDPOINTS.COMMIT_HISTORY}/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        branch,
        query,
        limit
      })
    });

    const data = await response.json();
    console.log(`✅ Search results:`, data);

    return data;

  } catch (error) {
    console.error('❌ Search error:', error);
    throw error;
  }
}

/**
 * Get author statistics
 */
export async function getAuthorStats(params) {
  const { branch, type, name } = params;

  if (!branch || !type || !name) {
    throw new Error('Branch, type, and name are required');
  }

  try {
    console.log(`👤 Fetching author stats for ${type}/${name}`);

    const response = await fetch(`${API_ENDPOINTS.COMMIT_HISTORY}/authors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        branch,
        component: { type, name }
      })
    });

    const data = await response.json();
    return data;

  } catch (error) {
    console.error('❌ Author stats error:', error);
    throw error;
  }
}

/**
 * Get activity timeline
 */
export async function getActivityTimeline(params) {
  const { branch, type, name, days = 30 } = params;

  if (!branch || !type || !name) {
    throw new Error('Branch, type, and name are required');
  }

  try {
    console.log(`📅 Fetching activity timeline for ${type}/${name} (last ${days} days)`);

    const response = await fetch(`${API_ENDPOINTS.COMMIT_HISTORY}/timeline`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        branch,
        component: { type, name },
        days
      })
    });

    const data = await response.json();
    return data;

  } catch (error) {
    console.error('❌ Timeline fetch error:', error);
    throw error;
  }
}

/**
 * Export commit history
 */
export async function exportCommitHistory(data, format = 'json') {
  try {
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `history-${timestamp}.${format === 'csv' ? 'csv' : 'json'}`;

    if (format === 'json') {
      const json = JSON.stringify(data, null, 2);
      downloadFile(json, filename, 'application/json');
    } else if (format === 'csv') {
      const csv = convertHistoryToCsv(data);
      downloadFile(csv, filename, 'text/csv');
    }

    console.log(`✅ History exported as ${filename}`);

  } catch (error) {
    console.error('❌ Export error:', error);
    throw error;
  }
}

/**
 * Helper: Download file
 */
function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Helper: Convert history to CSV
 */
function convertHistoryToCsv(data) {
  let csv = 'Commit Hash,Author,Date,Message,Branch\n';

  if (data.commits && Array.isArray(data.commits)) {
    for (const commit of data.commits) {
      const message = (commit.message || '').replace(/"/g, '""');
      const author = (commit.author || 'Unknown').replace(/"/g, '""');
      csv += `"${commit.hash || ''}","${author}","${commit.timestamp || ''}","${message}","${data.branch || ''}"\n`;
    }
  }

  return csv;
}

/**
 * Get branch statistics
 */
export async function getBranchStats(params) {
  const { type, name } = params;

  if (!type || !name) {
    throw new Error('Component type and name are required');
  }

  try {
    console.log(`📊 Fetching branch statistics for ${type}/${name}`);

    const environments = [
      { key: 'uat', branch: 'uatsfdc' },
      { key: 'qasales', branch: 'qasales' },
      { key: 'prep', branch: 'prep' },
      { key: 'master', branch: 'master' }
    ];

    const stats = {};

    for (const env of environments) {
      try {
        const response = await fetch(
          `${API_ENDPOINTS.COMMIT_HISTORY}/stats?branch=${env.branch}&type=${type}&name=${name}`,
          { method: 'GET' }
        );
        stats[env.key] = await response.json();
      } catch (error) {
        stats[env.key] = { error: error.message };
      }
    }

    return stats;

  } catch (error) {
    console.error('❌ Branch stats error:', error);
    throw error;
  }
}