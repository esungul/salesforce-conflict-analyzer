// ui/src/ui/tabs/deployment-plan.js
import { debugLog } from '../../config.js';

const $ = (s, r=document) => r.querySelector(s);

let PLAN_STATE = {
  planData: null,
  exportFormat: 'html'
};

export function renderDeploymentPlanTab(analysis = {}, enforcementResults = [], conflictsData = {}) {
  const panel = $('#tab-plan');
  if (!panel) return;

  panel.innerHTML = '';
  
  // Generate plan
  const plan = generateDeploymentPlan(analysis, enforcementResults, conflictsData);
  PLAN_STATE.planData = plan;

  panel.append(
    header(),
    controls(),
    reportPreview(plan)
  );

  injectPlanCss();
}

/* ─────────────────────────── Plan Generation ─────────────────────────── */

function generateDeploymentPlan(analysis, enforcementResults, conflictsData) {
  const allStories = analysis?.all_stories || [];
  
  debugLog('plan:generate', {
    totalStories: allStories.length,
    enforcementResults: enforcementResults.length,
    conflictsCount: Object.keys(conflictsData || {}).length
  });
  
  // ===== DATA DIAGNOSTICS =====
  debugLog('plan:all-stories', allStories.map(s => ({
    id: s.id || s.key,
    developer: s.developer || s.created_by || 'Unknown',
    commit_date: s.commit_date || s.lastModifiedDate || 'Unknown',
    prod_date: s.prod_commit_date || s.production_date || 'Unknown',
    components: (s.components || []).length
  })));
  
  // STEP 1: Identify stories BEHIND_PROD (exclude these from deployment)
  const behindProd = enforcementResults.filter(r => r.status === 'BEHIND_PROD');
  debugLog('plan:behind', { count: behindProd.length, stories: behindProd.map(bp => bp.primaryStoryId) });
  
  // STEP 2: Filter out BEHIND_PROD stories - only keep SAFE stories
  const safeStories = allStories.filter(story => {
    const storyId = story.id || story.key;
    const isBehind = behindProd.some(bp => bp.primaryStoryId === storyId);
    return !isBehind;
  });
  debugLog('plan:safe', { count: safeStories.length, excluded: allStories.length - safeStories.length });
  
  // STEP 3: From SAFE stories, identify which have CONFLICTS (don't deploy, but show)
  const storiesWithConflicts = new Set(Object.keys(conflictsData || {}));
  debugLog('plan:conflicts-detected', { 
    count: storiesWithConflicts.size,
    conflictStories: Array.from(storiesWithConflicts) 
  });
  
  // STEP 4: Separate SAFE stories into DEPLOYABLE and CONFLICTED
  const deployable = safeStories.filter(story => {
    const storyId = story.id || story.key;
    const hasConflict = storiesWithConflicts.has(storyId);
    return !hasConflict;
  });
  
  const conflicted = safeStories.filter(story => {
    const storyId = story.id || story.key;
    const hasConflict = storiesWithConflicts.has(storyId);
    return hasConflict;
  });
  
  debugLog('plan:split', { 
    deployable: deployable.length, 
    conflicted: conflicted.length,
    totalSafe: safeStories.length
  });

  // STEP 5: Remove duplicates from DEPLOYABLE (keep first occurrence)
  const uniqueDeployable = [];
  const seenIds = new Set();
  
  deployable.forEach(story => {
    const storyId = story.id || story.key;
    if (!seenIds.has(storyId)) {
      seenIds.add(storyId);
      uniqueDeployable.push(story);
    } else {
      debugLog('plan:duplicate-removed', { storyId, reason: 'Already in deployable sequence' });
    }
  });
  
  // STEP 6: Sort DEPLOYABLE stories by US number (extract numeric part: US-0033553 → 33553)
  const sorted = uniqueDeployable.sort((a, b) => {
    const numA = extractStoryNumber(a.id || a.key);
    const numB = extractStoryNumber(b.id || b.key);
    return numA - numB; // Lower US numbers first = older stories = safer
  });

  // STEP 7: Create deployment sequences from DEPLOYABLE stories
  const sequences = sorted.map((story, idx) => {
    const storyComps = story.components || [];
    
    // Get developer name - check multiple fields
    const devName = story.developer || story.created_by || story.assignee || 'Unknown';
    const devs = new Set([devName]);
    
    // Get commit dates
    const storyCommit = story.commit_date || story.lastModifiedDate || 'Unknown';
    const prodCommit = story.prod_commit_date || story.production_date || 'Unknown';
    
    // Calculate risk (no conflicts since we filtered them out)
    const risk = calculateRisk(storyComps.length, devs.size, 0, false);
    
    // Reason for sequence
    let reason = '';
    if (idx === 0) {
      reason = 'Lowest US number. Deploy first.';
    } else {
      reason = `Sequence ${idx + 1}. Depends on previous sequences.`;
    }

    return {
      sequence: idx + 1,
      storyId: story.id || story.key || '',
      status: 'AHEAD_OF_PROD',
      components: storyComps,
      devs: Array.from(devs),
      developerName: devName,
      componentCount: storyComps.length,
      developerCount: devs.size,
      storyCommit,
      prodCommit,
      risk,
      reason,
      action: `DEPLOY (Seq ${idx + 1})`
    };
  });

  // STEP 8: Collect conflict story IDs (sorted by US number)
  const conflictStories = conflicted
    .map(s => s.id || s.key)
    .filter((id, idx, arr) => arr.indexOf(id) === idx) // Remove duplicates
    .sort((a, b) => extractStoryNumber(a) - extractStoryNumber(b))
    .slice(0, 10);
  debugLog('plan:conflicts:display', { count: conflictStories.length, stories: conflictStories });
  
  // STEP 9: Collect behind prod story IDs (sorted by US number)
  const behindStories = Array.from(new Set(behindProd.map(bp => bp.primaryStoryId)))
    .sort((a, b) => extractStoryNumber(a) - extractStoryNumber(b))
    .slice(0, 10);
  debugLog('plan:behind:display', { count: behindStories.length, stories: behindStories });

  const finalPlan = {
    generated: new Date().toISOString(),
    summary: {
      total: allStories.length,                    // All input stories
      safe: sequences.length,                      // Safe + no conflicts = deployable
      conflicted: conflictStories.length,          // Safe but has conflicts
      behind: behindStories.length                 // Behind prod = excluded
    },
    sequences,                                     // Ordered deployment plan
    conflicts: conflictStories,                    // Stories to AVOID
    behind: behindStories,                         // Stories to EXCLUDE
    enforcementResults
  };
  
  debugLog('plan:complete', {
    total: finalPlan.summary.total,
    deployed: finalPlan.summary.safe,
    conflict: finalPlan.summary.conflicted,
    behind: finalPlan.summary.behind,
    math: `${finalPlan.summary.safe} deployed + ${finalPlan.summary.conflicted} conflicts + ${finalPlan.summary.behind} behind = ${finalPlan.summary.safe + finalPlan.summary.conflicted + finalPlan.summary.behind} unique stories`
  });
  
  return finalPlan;
}

// Helper: Extract numeric part from US-0033553 → 33553
function extractStoryNumber(storyId) {
  if (!storyId) return 0;
  const match = String(storyId).match(/(\d+)/);
  return match ? parseInt(match[1]) : 0;
}

function calculateRisk(componentCount, devCount, conflicts, isBehind) {
  if (isBehind) return 10;
  let risk = 0;
  risk += Math.min(componentCount * 0.1, 3); // Max 3
  risk += Math.min(devCount * 0.2, 2);       // Max 2
  risk += conflicts * 2;                       // Per conflict
  return Math.min(Math.round(risk * 10) / 10, 10);
}

function getRiskLevel(risk) {
  if (risk <= 2) return 'LOW';
  if (risk <= 6) return 'MEDIUM';
  return 'HIGH';
}

/* ─────────────────────────── UI Components ─────────────────────────── */

function header() {
  const div = document.createElement('div');
  div.className = 'plan-header';
  div.innerHTML = `
    <h1>Deployment Plan</h1>
    <p>Optimized sequence for safe, reliable deployment</p>
  `;
  return div;
}

function controls() {
  const div = document.createElement('div');
  div.className = 'plan-controls';
  div.innerHTML = `
    <div class="control-group">
      <button class="export-btn" id="export-pdf">Export PDF</button>
      <button class="export-btn" id="export-csv">Export CSV</button>
      <button class="export-btn" id="export-action">Export Action Table</button>
    </div>
  `;

  div.querySelector('#export-pdf').addEventListener('click', () => exportPDF());
  div.querySelector('#export-csv').addEventListener('click', () => exportCSV());
  div.querySelector('#export-action').addEventListener('click', () => exportActionTable());

  return div;
}

function reportPreview(plan) {
  const div = document.createElement('div');
  div.className = 'plan-report';

  // Summary
  const summary = document.createElement('div');
  summary.className = 'plan-summary';
  summary.innerHTML = `
    <div class="summary-grid">
      <div class="summary-item">
        <div class="summary-label">Total Stories</div>
        <div class="summary-value">${plan.summary.total}</div>
      </div>
      <div class="summary-item">
        <div class="summary-label">Ready to Deploy</div>
        <div class="summary-value safe">${plan.summary.safe}</div>
      </div>
      <div class="summary-item">
        <div class="summary-label">Conflicts</div>
        <div class="summary-value ${plan.summary.conflicted > 0 ? 'warning' : ''}">${plan.summary.conflicted}</div>
      </div>
      <div class="summary-item">
        <div class="summary-label">Behind Production</div>
        <div class="summary-value ${plan.summary.behind > 0 ? 'danger' : ''}">${plan.summary.behind}</div>
      </div>
    </div>
  `;
  div.append(summary);

  // Sequences
  const sequences = document.createElement('div');
  sequences.className = 'plan-sequences';
  
  plan.sequences.forEach(seq => {
    const seqCard = document.createElement('div');
    seqCard.className = `sequence-card risk-${getRiskLevel(seq.risk).toLowerCase()}`;
    
    const devInfo = seq.developerName && seq.developerName !== 'Unknown' 
      ? `<div class="seq-dev">Developer: ${escapeHtml(seq.developerName)}</div>` 
      : '<div class="seq-dev warning-text">Developer: Unknown</div>';
    
    const commitInfo = seq.storyCommit && seq.storyCommit !== 'Unknown'
      ? `<div class="seq-commit">Story Commit: ${escapeHtml(seq.storyCommit)}</div>`
      : '<div class="seq-commit warning-text">Story Commit: Unknown</div>';
    
    const prodInfo = seq.prodCommit && seq.prodCommit !== 'Unknown'
      ? `<div class="seq-commit">Prod Commit: ${escapeHtml(seq.prodCommit)}</div>`
      : '';
    
    seqCard.innerHTML = `
      <div class="seq-header">
        <div class="seq-number">Sequence ${seq.sequence}</div>
        <div class="seq-id">${escapeHtml(seq.storyId)}</div>
        <div class="seq-risk">Risk: ${seq.risk}/10</div>
      </div>

      <div class="seq-metadata">
        ${devInfo}
        ${commitInfo}
        ${prodInfo}
      </div>

      <div class="seq-reason">
        ${escapeHtml(seq.reason)}
      </div>

      <div class="seq-stats">
        <span>${seq.componentCount} Components</span>
      </div>

      <div class="seq-components">
        <div class="components-title">Components</div>
        <div class="components-list">
          ${seq.components.slice(0, 8).map(c => {
            const name = c?.name || c?.fullName || 'Unknown';
            const type = c?.type || 'Component';
            const isUnknown = name === 'Unknown';
            return `<div class="component-item ${isUnknown ? 'unknown-comp' : ''}">${escapeHtml(type)}: ${escapeHtml(name)}</div>`;
          }).join('')}
          ${seq.components.length > 8 ? `<div class="component-more">+ ${seq.components.length - 8} more</div>` : ''}
        </div>
      </div>

      <div class="seq-action">${seq.action}</div>
    `;
    
    sequences.append(seqCard);
  });

  div.append(sequences);

  // Conflicts - Warning style
  if (plan.conflicts.length > 0) {
    const conflicts = document.createElement('div');
    conflicts.className = 'plan-conflicts';
    conflicts.innerHTML = `
      <h3>⚠️ Conflicts Detected</h3>
      <p>${plan.conflicts.length} story/stories have conflicts</p>
      <div class="conflicts-list">
        ${plan.conflicts.map(c => `<div class="conflict-item">${escapeHtml(c)}</div>`).join('')}
      </div>
    `;
    div.append(conflicts);
  }

  // Behind Production - Danger style
  if (plan.behind.length > 0) {
    const behind = document.createElement('div');
    behind.className = 'plan-behind';
    behind.innerHTML = `
      <h3>🚫 Behind Production</h3>
      <p>${plan.behind.length} story/stories behind production - DO NOT DEPLOY</p>
      <div class="behind-list">
        ${plan.behind.map(b => `<div class="behind-item">${escapeHtml(b)}</div>`).join('')}
      </div>
    `;
    div.append(behind);
  }

  return div;
}

/* ─────────────────────────── Export Functions ─────────────────────────── */

function exportPDF() {
  const plan = PLAN_STATE.planData;
  if (!plan) return;

  const printWindow = window.open('', '', 'width=1200,height=800');
  printWindow.document.write(generateHTMLReport(plan));
  printWindow.document.close();
  
  setTimeout(() => {
    printWindow.print();
  }, 250);
}

function exportCSV() {
  const plan = PLAN_STATE.planData;
  if (!plan) return;

  let csv = 'Sequence,Story ID,Developer,Story Commit,Prod Commit,Status,Risk,Components,Action\n';
  
  plan.sequences.forEach(seq => {
    csv += `${seq.sequence},"${seq.storyId}","${seq.developerName}","${seq.storyCommit}","${seq.prodCommit}","${seq.status}","${seq.risk}/10",${seq.componentCount},"${seq.action}"\n`;
  });

  if (plan.conflicts.length > 0) {
    csv += '\n\nConflicts\n';
    plan.conflicts.forEach(c => {
      csv += `"${c}","DO NOT DEPLOY","CONFLICT"\n`;
    });
  }

  if (plan.behind.length > 0) {
    csv += '\n\nBehind Production\n';
    plan.behind.forEach(b => {
      csv += `"${b}","SKIP","BEHIND_PROD"\n`;
    });
  }

  downloadFile(csv, 'deployment-plan.csv', 'text/csv');
}

function exportActionTable() {
  const plan = PLAN_STATE.planData;
  if (!plan) return;

  let html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Deployment Actions</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 40px; }
    h1 { margin: 0 0 30px 0; }
    table { width: 100%; border-collapse: collapse; margin: 30px 0; }
    th, td { padding: 12px 16px; text-align: left; border-bottom: 1px solid #e5e5e7; }
    th { background: #f5f5f7; font-weight: 600; }
    .action-deploy { color: #34c759; font-weight: 600; }
    .action-skip { color: #ff3b30; font-weight: 600; }
    .risk-low { color: #34c759; }
    .risk-medium { color: #ff9500; }
    .risk-high { color: #ff3b30; }
    .unknown { color: #ff9500; font-style: italic; }
  </style>
</head>
<body>
  <h1>Deployment Action Table</h1>
  <table>
    <thead>
      <tr>
        <th>Story</th>
        <th>Developer</th>
        <th>Story Commit</th>
        <th>Action</th>
        <th>Risk</th>
        <th>Notes</th>
      </tr>
    </thead>
    <tbody>`;

  plan.sequences.forEach(seq => {
    const devDisplay = seq.developerName === 'Unknown' 
      ? '<span class="unknown">Unknown</span>' 
      : escapeHtml(seq.developerName);
    
    html += `
      <tr>
        <td>${escapeHtml(seq.storyId)}</td>
        <td>${devDisplay}</td>
        <td>${seq.storyCommit === 'Unknown' ? '<span class="unknown">Unknown</span>' : escapeHtml(seq.storyCommit)}</td>
        <td><span class="action-deploy">${seq.action}</span></td>
        <td><span class="risk-${getRiskLevel(seq.risk).toLowerCase()}">${seq.risk}/10</span></td>
        <td>${seq.componentCount} components</td>
      </tr>
    `;
  });

  if (plan.conflicts.length > 0) {
    plan.conflicts.forEach(c => {
      html += `
        <tr style="background: #fff3cd;">
          <td>${escapeHtml(c)}</td>
          <td colspan="4"><span class="action-skip">⚠️ DO NOT DEPLOY - CONFLICTS</span></td>
          <td>Resolve conflicts first</td>
        </tr>
      `;
    });
  }

  if (plan.behind.length > 0) {
    plan.behind.forEach(b => {
      html += `
        <tr style="background: #ffebee;">
          <td>${escapeHtml(b)}</td>
          <td colspan="4"><span class="action-skip">🚫 SKIP THIS CYCLE - BEHIND PROD</span></td>
          <td>Rebase and include next cycle</td>
        </tr>
      `;
    });
  }

  html += `
    </tbody>
  </table>
</body>
</html>`;

  downloadFile(html, 'deployment-actions.html', 'text/html');
}

function generateHTMLReport(plan) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Deployment Plan</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1d1d1f; background: #fff; line-height: 1.6; }
    .container { max-width: 900px; margin: 0 auto; padding: 60px 40px; }
    h1 { font-size: 32px; font-weight: 600; margin-bottom: 8px; }
    .subtitle { color: #86868b; font-size: 15px; margin-bottom: 40px; }
    .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin: 40px 0; }
    .summary-item { padding: 20px; background: #f5f5f7; border-radius: 8px; }
    .summary-label { font-size: 13px; color: #86868b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; }
    .summary-value { font-size: 28px; font-weight: 600; }
    .summary-value.safe { color: #34c759; }
    .summary-value.warning { color: #ff9500; }
    .summary-value.danger { color: #ff3b30; }
    .sequences { margin: 60px 0; }
    .sequence-card { padding: 24px; background: #fff; border: 1px solid #e5e5e7; border-radius: 12px; margin-bottom: 20px; }
    .seq-header { display: flex; gap: 16px; align-items: center; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid #f5f5f7; }
    .seq-number { font-weight: 600; font-size: 16px; }
    .seq-id { color: #007aff; font-weight: 500; flex: 1; }
    .seq-risk { font-size: 13px; color: #86868b; }
    .seq-metadata { background: #f9f9fb; padding: 12px; border-radius: 6px; margin: 12px 0; font-size: 13px; line-height: 1.6; }
    .seq-dev, .seq-commit { margin: 4px 0; }
    .seq-dev { font-weight: 500; }
    .warning-text { color: #ff9500; }
    .seq-reason { font-size: 14px; color: #555; margin: 12px 0; line-height: 1.5; }
    .seq-stats { display: flex; gap: 24px; font-size: 13px; color: #86868b; margin: 12px 0; }
    .components-title { font-size: 12px; font-weight: 600; color: #86868b; text-transform: uppercase; margin: 16px 0 8px 0; }
    .components-list { display: flex; flex-direction: column; gap: 6px; font-size: 13px; }
    .component-item { color: #555; padding-left: 16px; }
    .component-item.unknown-comp { color: #ff9500; font-style: italic; }
    .component-more { color: #86868b; font-style: italic; }
    .seq-action { margin-top: 16px; padding-top: 12px; border-top: 1px solid #f5f5f7; font-weight: 600; color: #34c759; font-size: 13px; }
    .conflicts { margin: 40px 0; padding: 24px; background: #fff3cd; border-radius: 8px; border-left: 3px solid #ff9500; }
    .behind { margin: 40px 0; padding: 24px; background: #ffebee; border-radius: 8px; border-left: 3px solid #ff3b30; }
    .conflicts h3, .behind h3 { font-size: 16px; font-weight: 600; margin-bottom: 4px; }
    .conflicts p, .behind p { font-size: 13px; color: #555; margin-bottom: 12px; }
    .conflicts-list, .behind-list { display: flex; flex-wrap: wrap; gap: 8px; }
    .conflict-item { padding: 6px 12px; background: #fff; border-radius: 6px; border: 1px solid #ffc107; font-size: 13px; }
    .behind-item { padding: 6px 12px; background: #fff; border-radius: 6px; border: 1px solid #f44336; font-size: 13px; }
    @media print { body { margin: 0; padding: 0; } .container { padding: 40px; } }
  </style>
</head>
<body>
  <div class="container">
    <h1>Deployment Plan</h1>
    <p class="subtitle">Optimized sequence for safe, reliable deployment</p>

    <div class="summary-grid">
      <div class="summary-item">
        <div class="summary-label">Total Stories</div>
        <div class="summary-value">${plan.summary.total}</div>
      </div>
      <div class="summary-item">
        <div class="summary-label">Ready to Deploy</div>
        <div class="summary-value safe">${plan.summary.safe}</div>
      </div>
      <div class="summary-item">
        <div class="summary-label">Conflicts</div>
        <div class="summary-value ${plan.summary.conflicted > 0 ? 'warning' : ''}">${plan.summary.conflicted}</div>
      </div>
      <div class="summary-item">
        <div class="summary-label">Behind Production</div>
        <div class="summary-value ${plan.summary.behind > 0 ? 'danger' : ''}">${plan.summary.behind}</div>
      </div>
    </div>

    <div class="sequences">
      <h2 style="font-size: 20px; margin-bottom: 20px;">Deployment Sequence</h2>
      ${plan.sequences.map(seq => {
        const devInfo = seq.developerName && seq.developerName !== 'Unknown' 
          ? `Developer: ${escapeHtml(seq.developerName)}` 
          : '<span style="color: #ff9500;">Developer: Unknown</span>';
        
        const commitInfo = seq.storyCommit && seq.storyCommit !== 'Unknown'
          ? `Story Commit: ${escapeHtml(seq.storyCommit)}`
          : '<span style="color: #ff9500;">Story Commit: Unknown</span>';
        
        const prodInfo = seq.prodCommit && seq.prodCommit !== 'Unknown'
          ? `Prod Commit: ${escapeHtml(seq.prodCommit)}`
          : '';
        
        return `
        <div class="sequence-card">
          <div class="seq-header">
            <div class="seq-number">Sequence ${seq.sequence}</div>
            <div class="seq-id">${escapeHtml(seq.storyId)}</div>
            <div class="seq-risk">Risk: ${seq.risk}/10</div>
          </div>
          <div class="seq-metadata">
            <div class="seq-dev">${devInfo}</div>
            <div class="seq-commit">${commitInfo}</div>
            ${prodInfo ? `<div class="seq-commit">${prodInfo}</div>` : ''}
          </div>
          <div class="seq-reason">${escapeHtml(seq.reason)}</div>
          <div class="seq-stats">
            <span>${seq.componentCount} Components</span>
          </div>
          <div class="components-title">Components</div>
          <div class="components-list">
            ${seq.components.slice(0, 10).map(c => {
              const name = c?.name || c?.fullName || 'Unknown';
              const type = c?.type || 'Component';
              const isUnknown = name === 'Unknown';
              return `<div class="component-item ${isUnknown ? 'unknown-comp' : ''}">${escapeHtml(type)}: ${escapeHtml(name)}</div>`;
            }).join('')}
            ${seq.components.length > 10 ? `<div class="component-more">+ ${seq.components.length - 10} more</div>` : ''}
          </div>
          <div class="seq-action">${seq.action}</div>
        </div>
      `}).join('')}
    </div>

    ${plan.conflicts.length > 0 ? `
      <div class="conflicts">
        <h3>⚠️ Conflicts Detected</h3>
        <p>${plan.conflicts.length} story/stories have conflicts - CANNOT DEPLOY</p>
        <div class="conflicts-list">
          ${plan.conflicts.map(c => `<div class="conflict-item">${escapeHtml(c)}</div>`).join('')}
        </div>
      </div>
    ` : ''}

    ${plan.behind.length > 0 ? `
      <div class="behind">
        <h3>🚫 Behind Production</h3>
        <p>${plan.behind.length} story/stories behind production - DO NOT DEPLOY</p>
        <div class="behind-list">
          ${plan.behind.map(b => `<div class="behind-item">${escapeHtml(b)}</div>`).join('')}
        </div>
      </div>
    ` : ''}
  </div>
</body>
</html>`;
}

function downloadFile(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
}

function toast(msg) {
  const region = document.getElementById('toast-region');
  if (!region) return alert(msg);
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  region.appendChild(t);
  setTimeout(() => t.remove(), 2600);
}

/* ─────────────────────────── Styles ─────────────────────────── */

let cssInjected = false;
function injectPlanCss() {
  if (cssInjected) return;
  cssInjected = true;

  const css = `
  .plan-header {
    margin-bottom: 40px;
  }

  .plan-header h1 {
    font-size: 32px;
    font-weight: 600;
    margin: 0 0 8px 0;
    color: #1d1d1f;
  }

  .plan-header p {
    font-size: 15px;
    color: #86868b;
    margin: 0;
  }

  .plan-controls {
    display: flex;
    gap: 12px;
    margin-bottom: 40px;
  }

  .export-btn {
    padding: 10px 20px;
    border: 1px solid #d2d2d7;
    background: #fff;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .export-btn:hover {
    background: #f5f5f7;
    border-color: #999;
  }

  .plan-summary {
    margin-bottom: 40px;
  }

  .summary-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 16px;
  }

  .summary-item {
    padding: 16px;
    background: #f5f5f7;
    border-radius: 8px;
  }

  .summary-label {
    font-size: 12px;
    color: #86868b;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    font-weight: 500;
    margin-bottom: 8px;
  }

  .summary-value {
    font-size: 24px;
    font-weight: 600;
    color: #1d1d1f;
  }

  .summary-value.safe {
    color: #34c759;
  }

  .summary-value.warning {
    color: #ff9500;
  }

  .summary-value.danger {
    color: #ff3b30;
  }

  .plan-sequences {
    margin: 40px 0;
  }

  .sequence-card {
    padding: 20px;
    background: #fff;
    border: 1px solid #e5e5e7;
    border-radius: 12px;
    margin-bottom: 16px;
    transition: all 0.2s ease;
  }

  .sequence-card:hover {
    border-color: #999;
    box-shadow: 0 2px 8px rgba(0,0,0,0.08);
  }

  .seq-header {
    display: flex;
    gap: 16px;
    align-items: center;
    margin-bottom: 12px;
    padding-bottom: 12px;
    border-bottom: 1px solid #f5f5f7;
  }

  .seq-number {
    font-weight: 600;
    font-size: 14px;
    color: #1d1d1f;
  }

  .seq-id {
    color: #007aff;
    font-weight: 500;
    font-size: 14px;
    flex: 1;
  }

  .seq-risk {
    font-size: 12px;
    color: #86868b;
  }

  .seq-metadata {
    background: #f9f9fb;
    padding: 12px;
    border-radius: 6px;
    margin: 12px 0;
    font-size: 13px;
    line-height: 1.6;
  }

  .seq-dev {
    font-weight: 500;
    margin: 4px 0;
  }

  .seq-commit {
    margin: 4px 0;
  }

  .warning-text {
    color: #ff9500;
    font-weight: 500;
  }

  .seq-reason {
    font-size: 13px;
    color: #555;
    margin: 12px 0;
    line-height: 1.5;
  }

  .seq-stats {
    display: flex;
    gap: 20px;
    font-size: 12px;
    color: #86868b;
    margin: 12px 0;
  }

  .components-title {
    font-size: 11px;
    font-weight: 600;
    color: #86868b;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin: 16px 0 8px 0;
  }

  .components-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .component-item {
    font-size: 12px;
    color: #555;
    padding-left: 12px;
  }

  .component-item.unknown-comp {
    color: #ff9500;
    font-style: italic;
    font-weight: 500;
  }

  .component-more {
    font-size: 12px;
    color: #86868b;
    font-style: italic;
  }

  .seq-action {
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid #f5f5f7;
    font-weight: 600;
    color: #34c759;
    font-size: 12px;
  }

  .plan-conflicts {
    margin: 30px 0;
    padding: 20px;
    background: #fff3cd;
    border-radius: 8px;
    border-left: 3px solid #ff9500;
  }

  .plan-behind {
    margin: 30px 0;
    padding: 20px;
    background: #ffebee;
    border-radius: 8px;
    border-left: 3px solid #ff3b30;
  }

  .plan-conflicts h3, .plan-behind h3 {
    font-size: 15px;
    font-weight: 600;
    margin-bottom: 4px;
  }

  .plan-conflicts p, .plan-behind p {
    font-size: 12px;
    color: #555;
    margin-bottom: 12px;
  }

  .conflicts-list, .behind-list {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .conflict-item {
    padding: 6px 10px;
    background: #fff;
    border-radius: 6px;
    border: 1px solid #ffc107;
    font-size: 12px;
    color: #333;
  }

  .behind-item {
    padding: 6px 10px;
    background: #fff;
    border-radius: 6px;
    border: 1px solid #f44336;
    font-size: 12px;
    color: #c62828;
  }

  @media (max-width: 768px) {
    .summary-grid {
      grid-template-columns: repeat(2, 1fr);
    }

    .seq-header {
      flex-wrap: wrap;
    }

    .export-btn {
      flex: 1;
    }
  }
  `;

  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
}