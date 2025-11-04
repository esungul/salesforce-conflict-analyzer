// ui/src/ui/tabs/reports-enhanced.js (CLEANED: XLS-only, no PDF)
// - Removes all PDF/Print usage and top-level export buttons
// - Keeps a single "Export XLS" button in the Preview toolbar
// - Fixes Conflict Stories empty state + rendering
// - Unifies table CSS for stable, professional preview
// - Restores Safe / Safe with Commit / Blocked tables with correct columns

import { createFilterBar } from '../components/filterBar.js';
import { generateDeploymentReport } from '../components/report-generator.js';
import { exportToXLS } from '../utils/export-xls.js';

const $ = (s, r = document) => r.querySelector(s);

// Fallback if createElement isn't globally provided
function createElement(tag, props = {}, children = []) {
  const el = document.createElement(tag);
  Object.assign(el, props);
  if (!Array.isArray(children)) children = [children];
  children.forEach(c => el.append(c));
  return el;
}

// Only allow 'technical' or 'developer'
let REPORTS_STATE = {
  reportType: localStorage.getItem('ui.reports.type') || 'technical'
};
const _ALLOWED_TYPES = new Set(['technical', 'developer']);
if (!_ALLOWED_TYPES.has(REPORTS_STATE.reportType)) {
  REPORTS_STATE.reportType = 'technical';
  localStorage.setItem('ui.reports.type', 'technical');
}

let CURRENT_ANALYSIS = {};
let CURRENT_REPORT_DATA = {};

// -----------------------------
// Public entry
// -----------------------------
export function renderReportsTab(analysis = {}) {
  const panel = $('#tab-reports');
  if (!panel) return;

  CURRENT_ANALYSIS = analysis;
  if (!analysis || typeof analysis !== 'object') {
    console.warn('⚠ No analysis passed to renderReportsTab; showing placeholder.');
  }

  panel.innerHTML = '';

  // Header
  const header = createElement('div', { className: 'section-header' }, [
    createElement('h2', { className: 'section-title' }, '📊 Deployment Reports'),
    createElement('p', { className: 'section-subtitle' }, 'Generate comprehensive deployment readiness reports with detailed component analysis')
  ]);
  panel.append(header);

  // Type chooser
  const typeSection = createElement('div', { className: 'report-type-section card' });
  typeSection.innerHTML = `
    <h3 class="section-heading">📋 Report Type</h3>
    <div class="report-type-grid">
      <div class="report-type-card ${REPORTS_STATE.reportType === 'technical' ? 'selected' : ''}" data-type="technical">
        <div class="type-icon">🔧</div>
        <div class="type-info">
          <h4>Technical Analysis</h4>
          <p>Component-level conflict details</p>
          <div class="type-features">
            <span class="feature-item">• Component conflict mapping</span>
            <span class="feature-item">• Resolution priority</span>
            <span class="feature-item">• Copado status details</span>
          </div>
        </div>
      </div>
      <div class="report-type-card ${REPORTS_STATE.reportType === 'developer' ? 'selected' : ''}" data-type="developer">
        <div class="type-icon">👥</div>
        <div class="type-info">
          <h4>Developer Focused</h4>
          <p>Individual assignments & actions</p>
          <div class="type-features">
            <span class="feature-item">• Developer-specific actions</span>
            <span class="feature-item">• Conflict resolution tasks</span>
            <span class="feature-item">• Deployment readiness</span>
          </div>
        </div>
      </div>
    </div>
  `;
  panel.append(typeSection);

  // Actions (Generate + Copy JSON only)
  const actionsSection = createElement('div', { className: 'report-actions-section card' });
  actionsSection.innerHTML = `
    <h3 class="section-heading">🎯 Generate Report</h3>
    <div class="actions-grid">
      <button class="btn btn-primary generate-btn" id="generate-report">
        <span class="btn-icon">🚀</span>
        Generate Enhanced Report
      </button>
      <div class="export-buttons">
        <button class="btn btn-secondary" id="copy-conflicts-json" disabled>
          <span class="btn-icon">📋</span> Copy Component Conflicts (JSON)
        </button>
      </div>
    </div>
  `;
  panel.append(actionsSection);

  // Preview container
  const previewSection = createElement('div', { className: 'report-preview-section card' });
  previewSection.innerHTML = `
    <h3 class="section-heading">📋 Report Preview</h3>
    <div class="report-preview" id="report-preview">
      <div class="preview-placeholder">
        <div class="placeholder-icon">📋</div>
        <h4>No Report Generated</h4>
        <p>Click "Generate Enhanced Report" to create your first detailed analysis</p>
        <div class="preview-features">
          <div class="feature">
            <span class="feature-icon">🔍</span>
            <span class="feature-text">Component-level blocking reasons</span>
          </div>
          <div class="feature">
            <span class="feature-icon">🔄</span>
            <span class="feature-text">Conflict story mapping</span>
          </div>
          <div class="feature">
            <span class="feature-icon">✅</span>
            <span class="feature-text">Deployment readiness status</span>
          </div>
        </div>
      </div>
    </div>
  `;
  panel.append(previewSection);

  setupEventListeners(panel, analysis);
  injectEnhancedCss();
}

// -----------------------------
// Events
// -----------------------------
function setupEventListeners(panel, analysis) {
  // Type selection
  panel.querySelectorAll('.report-type-card').forEach(card => {
    card.addEventListener('click', () => {
      panel.querySelectorAll('.report-type-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      REPORTS_STATE.reportType = card.dataset.type;
      localStorage.setItem('ui.reports.type', REPORTS_STATE.reportType);
      console.log('🧭 Report type set to:', REPORTS_STATE.reportType);
    });
  });

  // Generate
  const generateBtn = panel.querySelector('#generate-report');
  if (generateBtn) {
    generateBtn.addEventListener('click', () => {
      generateAndDisplayReport(analysis, panel);
    });
  }
}

// -----------------------------
// Generation + Preview
// -----------------------------
function generateAndDisplayReport(analysis, panel) {
  const generateBtn = panel.querySelector('#generate-report');
  const preview = panel.querySelector('#report-preview');
  if (!generateBtn || !preview) return;

  generateBtn.innerHTML = '⏳ Generating Enhanced Report...';
  generateBtn.disabled = true;
  preview.innerHTML = `
    <div class="loading-report">
      <div class="loading-spinner"></div>
      <h4>Generating Enhanced Analysis</h4>
      <p>Analyzing component conflicts, blocking reasons, and deployment readiness...</p>
    </div>
  `;

  setTimeout(() => {
    try {
      const type = _ALLOWED_TYPES.has(REPORTS_STATE.reportType) ? REPORTS_STATE.reportType : 'technical';
      console.log('🚀 Generating report', { type, analysisKeys: Object.keys(analysis || {}) });

      const reportData = generateDeploymentReport(analysis || {}, { ...REPORTS_STATE, reportType: type });
      if (!reportData || typeof reportData !== 'object') throw new Error('Report generator returned no data');

      if (reportData.type === 'technical' && !Array.isArray(reportData.componentConflicts)) {
        console.warn('⚠ componentConflicts missing for technical report; defaulting to empty array');
        reportData.componentConflicts = [];
      }

      CURRENT_REPORT_DATA = reportData;
      window.__report = reportData; // debug helper
      window.__conflicts = reportData.componentConflicts || [];

      // Enable copy JSON (preview export button is wired after render)
      const copyBtn = panel.querySelector('#copy-conflicts-json');
      if (copyBtn) {
        copyBtn.disabled = false;
        copyBtn.onclick = async () => {
          try {
            await navigator.clipboard.writeText(JSON.stringify(reportData.componentConflicts || [], null, 2));
            copyBtn.textContent = '✅ Copied!';
            setTimeout(() => (copyBtn.innerHTML = '<span class="btn-icon">📋</span> Copy Component Conflicts (JSON)'), 1200);
          } catch (e) {
            console.error('❌ Copy failed:', e);
            copyBtn.textContent = '❌ Copy failed';
            setTimeout(() => (copyBtn.innerHTML = '<span class="btn-icon">📋</span> Copy Component Conflicts (JSON)'), 1200);
          }
        };
      }

      displayEnhancedReportPreview(reportData, panel, analysis);
    } catch (error) {
      console.error('❌ Error generating enhanced report:', error);
      preview.innerHTML = `
        <div class="error-report">
          <div class="error-icon">❌</div>
          <h4>Error Generating Enhanced Report</h4>
          <p>${error?.message || 'Unknown error'}</p>
          <pre style="text-align:left;white-space:pre-wrap;background:#fff;border:1px solid #eee;border-radius:8px;padding:8px;max-height:160px;overflow:auto;">
${(error && error.stack) || ''}
          </pre>
          <button class="btn btn-secondary retry-btn">Try Again</button>
        </div>
      `;
      preview.querySelector('.retry-btn')?.addEventListener('click', () => generateAndDisplayReport(analysis, panel));
    } finally {
      generateBtn.innerHTML = '🚀 Generate Enhanced Report';
      generateBtn.disabled = false;
    }
  }, 400);
}


function displayEnhancedReportPreview(reportData, panel, analysis) {
  const preview = panel.querySelector('#report-preview');
  if (!preview) return;

  // Early exit if empty
  if (!reportData || typeof reportData !== 'object') {
    preview.innerHTML = `
      <div class="error-report">
        <div class="error-icon">⚠️</div>
        <h4>No Report Data</h4>
        <p>The report object is empty. Try generating again.</p>
      </div>`;
    return;
  }

  const reportType = reportData.type || 'technical';
  const titleHTML = renderReportTitleBar(reportData, analysis);
  const kpiHTML = renderKPISection(reportData);

  // Define exportToolbarHTML properly
  const exportToolbarHTML = `
    <div class="export-toolbar">
      <button id="export-xls" class="export-btn">
        <span class="btn-icon">📊</span>
        Export XLS
      </button>
    </div>
  `;

  preview.innerHTML = `
    <div class="enhanced-preview">
      ${titleHTML}
      ${kpiHTML}
      ${exportToolbarHTML}
      <div id="preview-scroll-container">
        ${generateTechnicalPreview(reportData, analysis)}
      </div>
    </div>`;
  
  // Wire up export button
  const btnXls = panel.querySelector('#export-xls');
  if (btnXls) {
    btnXls.onclick = () => {
      try {
        const data = typeof normalizeReportForExport === 'function'
          ? normalizeReportForExport(CURRENT_REPORT_DATA)
          : CURRENT_REPORT_DATA;
        const type = data?.type || 'technical';
        exportToXLS(data, analysis || window.CURRENT_ANALYSIS || {}, type);
      } catch (e) {
        console.error('Export failed:', e);
      }
    };
  }
}

/* -----------------------------
 * Technical Preview Builder
 * ---------------------------*/
function generateTechnicalPreview(reportData /*, analysis */) {
  const componentConflicts = Array.isArray(reportData.componentConflicts) ? reportData.componentConflicts : [];
  const blocked = Array.isArray(reportData.blockedStories) ? reportData.blockedStories : [];
  const safe = Array.isArray(reportData.safeStories) ? reportData.safeStories : [];
  const safeWC = Array.isArray(reportData.safeWithCommitStories) ? reportData.safeWithCommitStories : [];

  // --- Component conflicts ---
  const conflictsTable = `
    <section class="component-conflicts">
      <h2>🔗 Component Conflict Analysis (${componentConflicts.length} Unique Components)</h2>
      <p class="section-description">Each component appears once with all affected stories and developers.</p>
      <div class="table-container">
        <div class="details-table component-conflict-table">
          <div class="table-header">
            <span class="col-comp-type">Component Type</span>
            <span class="col-comp-name">Component Name</span>
            <span class="col-unique-stories">Unique Stories</span>
            <span class="col-developers">Developers</span>
            <span class="col-latest-story">Latest Story</span>
            <span class="col-latest-developer">Latest Developer</span>
            <span class="col-latest-commit">Latest Commit</span>
            <span class="col-commit-hash">Commit Hash</span>
            <span class="col-involved-stories">Involved Stories</span>
          </div>
          ${componentConflicts.map(comp => `
            <div class="table-row">
              <span class="col-comp-type" title="${comp.componentType || 'N/A'}">${comp.componentType || 'N/A'}</span>
              <span class="col-comp-name" title="${comp.componentName || 'N/A'}">${comp.componentName || 'N/A'}</span>
              <span class="col-unique-stories">${comp.uniqueStories ?? 0}</span>
              <span class="col-developers" title="${comp.developers || 'N/A'}">${comp.developers || 'N/A'}</span>
              <span class="col-latest-story">${comp.latestStory || 'N/A'}</span>
              <span class="col-latest-developer" title="${comp.latestDeveloper || 'N/A'}">${comp.latestDeveloper || 'N/A'}</span>
              <span class="col-latest-commit">${comp.latestCommitDate || 'N/A'}</span>
              <span class="col-commit-hash" title="${comp.latestCommitHash || 'N/A'}">
                ${comp.latestCommitHash && comp.latestCommitHash !== 'N/A' ? comp.latestCommitHash.slice(0, 8) + '…' : 'N/A'}
              </span>
              <span class="col-involved-stories" title="${comp.involvedStories || 'N/A'}">${comp.involvedStories || 'N/A'}</span>
            </div>
          `).join('')}
        </div>
      </div>
    </section>
  `;
  // --- Safe Stories ---
  const safeTable = `
    <section class="safe-stories">
      <h2>✅ Safe Stories (${safe.length})</h2>
      <div class="table-container">
        <div class="details-table safe-table">
          <div class="table-header">
            <span>Story ID</span>
            <span>Developer</span>
            <span>Component Count</span>
            <span>Latest Commit</span>
            <span>Deployment Task</span>
            <span>Task Type</span>
            <span>Timing</span>
          </div>
          ${safe.map(s => `
            <div class="table-row">
              <span title="${s.story_id || 'N/A'}">${s.story_id || 'N/A'}</span>
              <span title="${s.developer || 'N/A'}">${s.developer || 'N/A'}</span>
              <span>${s.component_count ?? 0}</span>
              <span>${'N/A'}</span>
              <span class="${s.has_deployment_task ? 'deployment-yes' : 'deployment-no'}">
                ${s.has_deployment_task ? 'Yes' : 'No'}
              </span>
              <span>${s.task_type || 'N/A'}</span>
              <span>${s.timing || 'N/A'}</span>
            </div>
          `).join('')}
        </div>
      </div>
    </section>
  `;

  // --- Safe with Commit ---
  const safeWithCommitTable = `
    <section class="safe-commit-stories">
      <h2>🟩 Safe Stories with Commit (${safeWC.length})</h2>
      <div class="table-container">
        <div class="details-table safecommit-table">
          <div class="table-header">
            <span>Story ID</span>
            <span>Developer</span>
            <span>Component Count</span>
            <span>Latest Commit</span>
            <span>Deployment Task</span>
            <span>Task Type</span>
            <span>Timing</span>
          </div>
          ${safeWC.map(s => `
            <div class="table-row">
              <span title="${s.story_id || 'N/A'}">${s.story_id || 'N/A'}</span>
              <span title="${s.developer || 'N/A'}">${s.developer || 'N/A'}</span>
              <span>${s.component_count ?? 0}</span>
              <span title="${s.commit_hash || 'N/A'}">
                ${s.commit_date && s.commit_date !== 'N/A'
                  ? `${(s.commit_hash && s.commit_hash !== 'N/A') ? s.commit_hash.slice(0, 8) + '…' : 'N/A'} · ${s.commit_date}`
                  : 'N/A'}
              </span>
              <span class="${s.has_deployment_task ? 'deployment-yes' : 'deployment-no'}">
                ${s.has_deployment_task ? 'Yes' : 'No'}
              </span>
              <span>${s.task_type || 'N/A'}</span>
              <span>${s.timing || 'N/A'}</span>
            </div>
          `).join('')}
        </div>
      </div>
    </section>
  `;

  // --- Blocked Stories ---
  const blockedTable = `
    <section class="blocked-stories">
      <h2>⛔ Blocked Stories (${blocked.length})</h2>
      <div class="table-container">
        <div class="details-table blocked-table">
          <div class="table-header">
            <span>Story ID</span>
            <span>Developer</span>
            <span>Blocking Components</span>
            <span>Why Blocked (Reasons)</span>
            <span>Conflicting With</span>
            <span>Deployment Task</span>
          </div>
          ${blocked.map(s => {
            const reasons = (s.blocking_reasons || []).join(' | ') || '—';
            const blockers = (s.production_blockers || [])
              .map(b => `${b.production_story_id || ''}${b.production_developer ? ' (' + b.production_developer + ')' : ''}`)
              .filter(Boolean)
              .join(', ') || '—';
            return `
              <div class="table-row">
                <span title="${s.story_id || 'N/A'}">${s.story_id || 'N/A'}</span>
                <span title="${s.developer || 'N/A'}">${s.developer || 'N/A'}</span>
                <span title="${(s.blocking_components || []).join(', ') || '—'}">${(s.blocking_components || []).join(', ') || '—'}</span>
                <span title="${reasons}">${reasons}</span>
                <span title="${blockers}">${blockers}</span>
                <span class="${s.has_deployment_task ? 'deployment-yes' : 'deployment-no'}">${s.has_deployment_task ? 'Yes' : 'No'}</span>
              </div>`;
          }).join('')}
        </div>
      </div>
    </section>
  `;

  // Order: Component → Safe → Safe with Commit → Blocked → Conflict Stories
  return (
    conflictsTable +
    safeTable +
    safeWithCommitTable +
    blockedTable
  );
}

// Developer preview stub
function generateDeveloperPreview(/* reportData, analysis */) {
  return `
    <section class="developer-preview">
      <h2>👥 Developer Focused View</h2>
      <p>Use Technical view for component-centric conflicts. Developer view can be expanded later.</p>
    </section>
  `;
}

// Build the KPI numbers robustly from reportData (or compute if missing)
function computeKPIs(reportData) {
  const blocked = Array.isArray(reportData.blockedStories) ? reportData.blockedStories.length : 0;
  const conflict = Array.isArray(reportData.conflictStories) ? reportData.conflictStories.length : 0;
  const safe = Array.isArray(reportData.safeStories) ? reportData.safeStories.length : 0;
  const safeWC = Array.isArray(reportData.safeWithCommitStories) ? reportData.safeWithCommitStories.length : 0;

  const totalFromSummary = reportData.technicalSummary?.totalStories ?? reportData.summary?.totalStories ?? null;
  const total = Number.isFinite(totalFromSummary) ? totalFromSummary : (blocked + conflict + safe + safeWC);
  return { total, blocked, conflict, safe, safeWC };
}

function getAnalysisTime(analysis) {
  const raw = analysis?.analysis_time || analysis?.summary?.analyzed_at || analysis?.generated_at || analysis?.timestamp || null;
  try {
    const d = raw ? new Date(raw) : new Date();
    return isNaN(d) ? new Date().toISOString() : d.toISOString();
  } catch {
    return new Date().toISOString();
  }
}

function renderReportTitleBar(reportData, analysis) {
  const generated = reportData.generatedAt || new Date().toLocaleString();
  const type = (reportData.type || 'Technical Analysis').replace(/^./, s => s.toUpperCase());
  const analysisTime = getAnalysisTime(analysis);
  return `
    <header class="report-titlebar">
      <h1 class="report-title">Technical Analysis Report - Component Health</h1>
      <div class="report-title-meta">
        <span><strong>Generated:</strong> ${generated}</span>
        <span><strong>Type:</strong> ${type}</span>
        <span><strong>Analysis Time:</strong> ${analysisTime}</span>
      </div>
      <div class="report-divider"></div>
      <h2 class="report-section-title">Technical Analysis - All Story Types</h2>
    </header>
  `;
}

function renderKPISection(reportData) {
  const { total, blocked, conflict, safe, safeWC } = computeKPIs(reportData);
  return `
    <section class="kpi-section">
      <div class="kpi-grid">
        <div class="kpi-card kpi-total">
          <div class="kpi-value">${total}</div>
          <div class="kpi-label">Total Stories</div>
        </div>
        <div class="kpi-card kpi-blocked">
          <div class="kpi-value">${blocked}</div>
          <div class="kpi-label">Blocked Stories</div>
        </div>
        <div class="kpi-card kpi-conflict">
          <div class="kpi-value">${conflict}</div>
          <div class="kpi-label">Conflict Stories</div>
        </div>
        <div class="kpi-card kpi-safe">
          <div class="kpi-value">${safe}</div>
          <div class="kpi-label">Safe Stories</div>
        </div>
        <div class="kpi-card kpi-safewc">
          <div class="kpi-value">${safeWC}</div>
          <div class="kpi-label">Safe with Commit</div>
        </div>
      </div>
    </section>
  `;
}

// Normalize report to include a summary for export/xls
function normalizeReportForExport(reportData) {
  if (!reportData || typeof reportData !== 'object') return reportData;
  if (reportData.summary) return reportData;
  const ts = reportData.technicalSummary || {};
  const n = (arr) => Array.isArray(arr) ? arr.length : 0;
  const summary = {
    totalStories: Number.isFinite(ts.totalStories) ? ts.totalStories : n(reportData.blockedStories) + n(reportData.conflictStories) + n(reportData.safeStories) + n(reportData.safeWithCommitStories),
    blockedStories: Number.isFinite(ts.blockedStories) ? ts.blockedStories : n(reportData.blockedStories),
    conflictStories: Number.isFinite(ts.conflictStories) ? ts.conflictStories : n(reportData.conflictStories),
    safeStories: Number.isFinite(ts.safeStories) ? ts.safeStories : n(reportData.safeStories),
    safeWithCommitStories: Number.isFinite(ts.safeWithCommitStories) ? ts.safeWithCommitStories : n(reportData.safeWithCommitStories),
    componentsWithConflicts: Number.isFinite(ts.conflictedComponents) ? ts.conflictedComponents : n(reportData.componentConflicts),
    componentConflicts: Number.isFinite(ts.componentConflicts) ? ts.componentConflicts : n(reportData.componentConflicts),
  };
  return { ...reportData, summary };
}

function exportReportToXLS(analysis, panel) {
  if (!CURRENT_REPORT_DATA) return console.warn('⚠ Nothing to export');
  try {
    const data = typeof normalizeReportForExport === 'function' ? normalizeReportForExport(CURRENT_REPORT_DATA) : CURRENT_REPORT_DATA;
    exportToXLS(data, analysis || window.CURRENT_ANALYSIS || {}, data.type || 'technical');
  } catch (e) {
    console.error('Export failed:', e);
  }
}

// Build story-centric conflicts from componentConflicts when missing
function synthesizeConflictStoriesFromComponents(reportData) {
  const rows = Array.isArray(reportData.componentConflicts) ? reportData.componentConflicts : [];
  if (!rows.length) return [];
  const byStory = new Map();
  const storyIdRe = /US-\d{6,}/g;
  for (const comp of rows) {
    const compName = comp?.componentName || 'Unknown';
    const involved = String(comp?.involvedStories || '');
    const ids = involved.match(storyIdRe) || [];
    const latestId = (String(comp?.latestStory || '').match(storyIdRe) || [null])[0];
    ids.forEach(id => {
      if (!byStory.has(id)) {
        byStory.set(id, { story_id: id, developer: 'Unknown', conflict_components: [], conflicting_with: new Set(), resolution_status: 'Potential Conflict', has_deployment_task: false });
      }
      const entry = byStory.get(id);
      entry.conflict_components.push(compName);
      ids.forEach(other => { if (other !== id) entry.conflicting_with.add(other); });
      if (latestId && latestId === id) entry.resolution_status = 'Latest Commit (primary)';
    });
  }
  const devIndex = new Map();
  for (const bucket of [reportData.safeWithCommitStories, reportData.safeStories, reportData.blockedStories, reportData.conflictStories]) {
    (Array.isArray(bucket) ? bucket : []).forEach(s => {
      if (s.story_id && s.developer) devIndex.set(s.story_id, s.developer);
    });
  }
  const result = [];
  for (const v of byStory.values()) {
    v.developer = devIndex.get(v.story_id) || v.developer;
    v.conflicting_with = Array.from(v.conflicting_with);
    result.push(v);
  }
  result.sort((a, b) => (b.conflicting_with.length - a.conflicting_with.length) || (a.story_id.localeCompare(b.story_id)));
  return result;
}

function renderConflictStoriesSection(reportData) {
  let conflicts = Array.isArray(reportData.conflictStories) ? reportData.conflictStories : [];
  if (!conflicts.length) conflicts = synthesizeConflictStoriesFromComponents(reportData);

  if (!conflicts.length) {
    return `
      <section class="conflict-stories">
        <h2>🟧 Conflict Stories (0)</h2>
        <div class="table-container"><div class="details-table">
          <div class="table-row"><span>No conflict stories found.</span></div>
        </div></div>
      </section>`;
  }

  return `
    <section class="conflict-stories">
      <h2>🟧 Conflict Stories (${conflicts.length})</h2>
      <div class="table-container">
        <div class="details-table conflict-table">
          <div class="table-header">
            <span>Story ID</span>
            <span>Developer</span>
            <span>Conflict Components</span>
            <span>Resolution Status</span>
            <span>Conflicting With</span>
            <span>Deployment Task</span>
          </div>
          ${conflicts.map(s => `
            <div class="table-row">
              <span title="${s.story_id || 'N/A'}">${s.story_id || 'N/A'}</span>
              <span title="${s.developer || 'Unknown'}">${s.developer || 'Unknown'}</span>
              <span title="${(s.conflict_components || []).join(', ') || '—'}">${(s.conflict_components || []).join(', ') || '—'}</span>
              <span>${s.resolution_status || 'Potential Conflict'}</span>
              <span title="${(s.conflicting_with || []).join(', ') || '—'}">${(s.conflicting_with || []).join(', ') || '—'}</span>
              <span class="${s.has_deployment_task ? 'deployment-yes' : 'deployment-no'}">${s.has_deployment_task ? 'Yes' : 'No'}</span>
            </div>
          `).join('')}
        </div>
      </div>
    </section>
  `;
}

/* -----------------------------
 * Styles (single source of truth)
 * ---------------------------*/
function injectEnhancedCssback() {
  if (document.getElementById('reports-enhanced-css')) return;
  const css = `
  /* --- Shared layout / cards --- */
  .section-header { display:flex; flex-direction:column; gap:.25rem; margin:8px 0 16px; }
  .section-title { font-size:1.4rem; margin:0; font-weight:700; }
  .section-subtitle { margin:0; color:#666; }
  .card { background:#fff; border:1px solid #e6e6e6; border-radius:14px; padding:14px; box-shadow:0 1px 2px rgba(0,0,0,.04); margin-bottom:12px; }
  .section-heading { margin:0 0 10px; font-size:1.05rem; }
  .report-type-grid { display:grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap:10px; }
  .report-type-card { display:flex; gap:10px; align-items:flex-start; border:1px solid #e6e6e6; border-radius:12px; padding:12px; cursor:pointer; transition:border-color .15s, box-shadow .15s, transform .06s; }
  .report-type-card:hover { border-color:#cfcfcf; box-shadow:0 2px 6px rgba(0,0,0,.06); }
  .report-type-card.selected { border-color:#2563eb; box-shadow:0 0 0 3px rgba(37,99,235,.15); }
  .type-icon { font-size:1.4rem; }
  .type-info h4 { margin:.125rem 0 .25rem; }
  .type-features { color:#555; font-size:.9rem; display:flex; flex-wrap:wrap; gap:8px; }
  .feature-item { background:#f6f7fb; border:1px solid #eef0f6; border-radius:10px; padding:4px 8px; }
  .actions-grid { display:flex; flex-wrap:wrap; gap:8px; align-items:center; justify-content:space-between; }
  .export-buttons { display:flex; gap:8px; }
  .btn { appearance:none; border:1px solid #dcdcdc; background:#fff; padding:8px 12px; border-radius:10px; cursor:pointer; }
  .btn:disabled { opacity:.6; cursor:not-allowed; }
  .btn-primary { background:#2563eb; border-color:#1f55c9; color:#fff; }
  .btn-primary:hover { filter:brightness(1.05); }
  .btn-secondary:hover { background:#f4f6fb; }
  .report-preview { min-height:180px; }
  .preview-placeholder { text-align:center; padding:24px 8px; color:#666; }
  .placeholder-icon { font-size:2rem; margin-bottom:6px; }
  .preview-features { display:flex; gap:10px; flex-wrap:wrap; justify-content:center; margin-top:10px; }
  .preview-features .feature { display:flex; gap:6px; align-items:center; background:#f6f7fb; border:1px solid #eef0f6; border-radius:10px; padding:6px 10px; }
  .loading-report { display:flex; flex-direction:column; align-items:center; gap:8px; padding:24px 8px; }
  .loading-spinner { width:28px; height:28px; border-radius:50%; border:3px solid #e6e6e6; border-top-color:#2563eb; animation:spin .9s linear infinite; }
  @keyframes spin { to { transform:rotate(360deg); } }
  .error-report { text-align:center; padding:18px; border:1px solid #ffdfdf; background:#fff6f6; border-radius:10px; }

  /* --- Title bar & KPI --- */
  .enhanced-preview { background:#fff; padding:24px; border-radius:16px; box-shadow:0 2px 8px rgba(0,0,0,.05); }
  .report-titlebar { display:flex; flex-direction:column; gap:6px; }
  .report-title { font-size:1.8rem; font-weight:800; color:#1f4fbf; margin:0; text-align:center; }
  .report-title-meta { display:flex; gap:18px; flex-wrap:wrap; justify-content:center; color:#444; }
  .report-divider { border-bottom:3px solid #1f4fbf; opacity:.35; margin:10px 0 12px; }
  .report-section-title { margin:0; font-size:1.25rem; color:#124; }
  .kpi-section { margin:10px 0 14px; }
  .kpi-grid { display:grid; grid-template-columns: repeat(5, minmax(160px, 1fr)); gap:14px; }
  .kpi-card { border-radius:16px; padding:16px; text-align:center; border:1px solid #e6e9f2; box-shadow: 0 2px 6px rgba(0,0,0,.05) inset, 0 1px 2px rgba(0,0,0,.04); background:#fff; }
  .kpi-value { font-size:2rem; font-weight:800; margin-bottom:6px; }
  .kpi-label { color:#555; font-weight:600; }
  .kpi-total{ background: linear-gradient(135deg, #1f4fbf, #1954a8); color:#fff; }
  .kpi-blocked{ background:#fff5f5; }
  .kpi-conflict{ background:#fff8ec; }
  .kpi-safe{ background:#f0fbf3; }
  .kpi-safewc{ background:#f4f8ff; }
  .kpi-blocked .kpi-value{ color:#c62828; }
  .kpi-conflict .kpi-value{ color:#f57c00; }
  .kpi-safe .kpi-value{ color:#1b8a3e; }
  .kpi-safewc .kpi-value{ color:#1f4fbf; }
  @media (max-width: 1100px) { .kpi-grid { grid-template-columns: repeat(3, minmax(160px, 1fr)); } }
  @media (max-width: 720px)  { .kpi-grid { grid-template-columns: repeat(2, minmax(140px, 1fr)); } .report-title { font-size:1.5rem; } }

  /* --- Export toolbar (preview only) --- */
  .export-toolbar { display:flex; justify-content:flex-end; gap:10px; margin:10px 0 20px; }
  .export-btn { background:#1f4fbf; color:#fff; border:none; border-radius:8px; padding:10px 16px; cursor:pointer; font-weight:600; font-size:14px; transition:background .2s; }
  .export-btn:hover { background:#173a8a; }

  /* --- Tables (grid) --- */
  #preview-scroll-container { overflow-x:auto; border:1px solid #e5e7eb; border-radius:8px; padding:10px; }
  .table-container { border:1px solid #e9e9ef; border-radius:12px; overflow:hidden; }
  .details-table { display:block; max-height:52vh; overflow:auto; font-size:.92rem; }
  .details-table .table-header, .details-table .table-row { display:grid; gap:8px; align-items:flex-start; padding:8px 10px; white-space:nowrap; }
  .details-table .table-header { position:sticky; top:0; z-index:2; background:#f8fafc; border-bottom:1px solid #eaecf2; font-weight:600; }
  .details-table .table-row { border-bottom:1px dashed #f0f1f6; }
  .details-table .table-row:nth-child(even) { background:#fcfdff; }
  .details-table .table-row span, .details-table .table-header span { overflow:hidden; text-overflow:ellipsis; }
  .deployment-yes { color:#0a7a2f; font-weight:600; }
  .deployment-no  { color:#b32525; font-weight:600; }

  /* Component Conflict table (9 columns) */
  .component-conflict-table .table-header, .component-conflict-table .table-row {
    grid-template-columns:
      140px                   /* Component Type */
      minmax(220px, 1.4fr)    /* Component Name */
      120px                   /* Unique Stories */
      minmax(180px, 1.1fr)    /* Developers */
      120px                   /* Latest Story */
      160px                   /* Latest Developer */
      170px                   /* Latest Commit */
      120px                   /* Commit Hash */
      minmax(260px, 2fr);     /* Involved Stories */
  }

  /* Safe Stories (7 columns) */
  .safe-table .table-header, .safe-table .table-row {
    grid-template-columns:
      130px   /* Story ID */
      180px   /* Developer */
      150px   /* Component Count */
      260px   /* Latest Commit */
      150px   /* Deployment Task */
      160px   /* Task Type */
      160px;  /* Timing */
  }

  /* Safe with Commit (7 columns) */
  .safecommit-table .table-header, .safecommit-table .table-row {
    grid-template-columns:
      130px
      180px
      150px
      260px
      150px
      160px
      160px;
  }

  /* Blocked Stories (6 columns) */
  .blocked-table .table-header, .blocked-table .table-row {
    grid-template-columns:
      130px     /* Story ID */
      180px     /* Developer */
      1.4fr     /* Blocking Components */
      1.2fr     /* Why Blocked (Reasons) */
      240px     /* Conflicting With */
      120px;    /* Deployment Task */
  }
  @media (max-width: 980px) {
    .blocked-table .table-header, .blocked-table .table-row { grid-template-columns: 120px 160px 1.2fr 1fr 200px 110px; }
    .safe-table .table-header, .safe-table .table-row { grid-template-columns: 120px 160px 120px 220px 140px 140px 140px; }
    .safecommit-table .table-header, .safecommit-table .table-row { grid-template-columns: 120px 160px 140px 220px 120px 140px 140px; }
  }
  @media (max-width: 760px) {
    .blocked-table .table-header, .blocked-table .table-row { grid-template-columns: 110px 140px 1fr 1fr; }
    .blocked-table .table-header span:nth-child(5), .blocked-table .table-row span:nth-child(5),
    .blocked-table .table-header span:nth-child(6), .blocked-table .table-row span:nth-child(6) { display:none; }

    .safe-table .table-header, .safe-table .table-row { grid-template-columns: 110px 140px 100px 1fr; }
    .safe-table .table-header span:nth-child(5), .safe-table .table-row span:nth-child(5),
    .safe-table .table-header span:nth-child(6), .safe-table .table-row span:nth-child(6),
    .safe-table .table-header span:nth-child(7), .safe-table .table-row span:nth-child(7) { display:none; }

    .safecommit-table .table-header, .safecommit-table .table-row { grid-template-columns: 110px 140px 140px 1fr; }
    .safecommit-table .table-header span:nth-child(5), .safecommit-table .table-row span:nth-child(5),
    .safecommit-table .table-header span:nth-child(6), .safecommit-table .table-row span:nth-child(6),
    .safecommit-table .table-header span:nth-child(7), .safecommit-table .table-row span:nth-child(7) { display:none; }
  }
  `;
  const style = document.createElement('style');
  style.id = 'reports-enhanced-css';
  style.textContent = css;
  document.head.appendChild(style);
}


function injectEnhancedCss() {
  if (document.getElementById('reports-enhanced-css')) return;

  const css = `
  /* Enhanced CSS with proper theming */
  .tab-reports {
    padding: 20px;
    background: #f8f9fa;
    min-height: 100vh;
  }

  .section-header {
    text-align: center;
    margin-bottom: 32px;
    padding: 24px;
    background: linear-gradient(135deg, #2a5da6 0%, #1e3a8a 100%);
    border-radius: 12px;
    color: white;
  }

  .table-container {
    overflow-x: auto;
    border: 1px solid #e1e5e9;
    border-radius: 8px;
    background: white;
    margin-bottom: 24px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }

  .details-table {
    min-width: 100%;
    width: auto;
    border-collapse: collapse;
  }

  .table-header {
    display: grid;
    background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%);
    padding: 16px 20px;
    font-weight: 600;
    font-size: 14px;
    color: white;
    border-bottom: 2px solid #2c3e50;
    gap: 16px;
    position: sticky;
    top: 0;
    z-index: 10;
  }

  .table-row {
    display: grid;
    padding: 14px 20px;
    border-bottom: 1px solid #f0f2f5;
    font-size: 14px;
    align-items: center;
    gap: 16px;
    transition: background-color 0.2s ease;
    background: white;
    min-height: 50px;
  }

  .table-row:hover {
    background: #f8fafc;
  }

  .table-row:nth-child(even) {
    background: #fafbfc;
  }

  .table-row:nth-child(even):hover {
    background: #f1f5f9;
  }

  .table-row:last-child {
    border-bottom: none;
  }

  /* Column-specific styles - Fixed text colors */
  .table-header span,
  .table-row span {
    min-height: 20px;
    display: flex;
    align-items: center;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    line-height: 1.4;
    color: #374151; /* Theme color instead of black */
  }

  /* Ensure header text stays white */
  .table-header span {
    color: white;
  }

  .col-story-id {
    font-weight: 600;
    color: #2a5da6; /* Theme blue */
  }

  .col-developer {
    font-weight: 500;
    color: #374151; /* Theme dark gray */
  }

  .col-components,
  .col-reason,
  .col-involved-stories {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    color: #374151; /* Theme color */
  }

  .col-components {
    background: #f8f9fa;
    padding: 6px 10px;
    border-radius: 4px;
    border: 1px solid #e9ecef;
    font-size: 13px;
    color: #374151; /* Theme color */
  }

  .col-reason {
    background: #fff3cd;
    padding: 6px 10px;
    border-radius: 4px;
    border: 1px solid #ffeaa7;
    font-size: 13px;
    color: #856404; /* Keep warning color for contrast */
  }

  .col-count,
  .col-commits,
  .col-deployment,
  .col-unique-stories {
    text-align: center;
    justify-content: center;
    font-weight: 600;
    color: #374151; /* Theme color */
  }

  .col-task-type,
  .col-timing,
  .col-resolution {
    background: #e7f3ff;
    padding: 6px 10px;
    border-radius: 4px;
    font-size: 13px;
    text-align: center;
    justify-content: center;
    color: #1e3a8a; /* Theme blue */
  }

  .col-commit,
  .col-commit-hash {
    font-family: 'Courier New', monospace;
    font-size: 12px;
    color: #6b7280; /* Lighter gray for code-like text */
  }

  /* Fix involved stories column - allow full content display */
  .col-involved-stories {
    white-space: normal !important; /* Allow wrapping */
    word-break: break-word; /* Break long words */
    overflow: visible !important; /* Show all content */
    text-overflow: unset !important; /* Remove ellipsis */
    min-width: 200px; /* Ensure minimum width */
  }

  .deployment-yes {
    color: #198754;
    background: #d1fae5;
    padding: 4px 8px;
    border-radius: 4px;
    font-weight: 600;
  }

  .deployment-no {
    color: #dc3545;
    background: #fecaca;
    padding: 4px 8px;
    border-radius: 4px;
    font-weight: 600;
  }

  /* Specific table column layouts with better scrolling */
  .component-conflict-table .table-header,
  .component-conflict-table .table-row {
    grid-template-columns: 
      140px 
      minmax(220px, 1.4fr) 
      120px 
      minmax(180px, 1.1fr) 
      120px 
      160px 
      170px 
      120px 
      minmax(300px, 3fr); /* Increased width for involved stories */
  }

  .blocked-table .table-header,
  .blocked-table .table-row {
    grid-template-columns: 130px 180px 1.4fr 1.2fr 240px 120px;
  }

  .safe-table .table-header,
  .safe-table .table-row {
    grid-template-columns: 130px 180px 150px 260px 150px 160px 160px;
  }

  .safecommit-table .table-header,
  .safecommit-table .table-row {
    grid-template-columns: 130px 180px 150px 260px 150px 160px 160px;
  }

  .conflict-table .table-header,
  .conflict-table .table-row {
    grid-template-columns: 130px 180px 1.5fr 180px 1.2fr 130px;
  }

  /* Section headers */
  .component-conflicts h2,
  .safe-stories h2,
  .safe-commit-stories h2,
  .blocked-stories h2,
  .conflict-stories h2 {
    font-size: 1.3rem;
    font-weight: 700;
    color: #1f2937;
    margin: 0 0 16px;
    padding-bottom: 12px;
    border-bottom: 2px solid #e5e7eb;
  }

  .section-description {
    font-size: 14px;
    color: #6b7280;
    margin: -8px 0 20px 0;
    font-style: italic;
  }

  /* Improved Scroll container for tables */
  #preview-scroll-container {
    max-height: 70vh;
    overflow-x: auto; /* Enable horizontal scrolling */
    overflow-y: auto;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 0;
    margin-top: 16px;
  }

  /* Ensure tables can expand horizontally */
  #preview-scroll-container .table-container {
    margin-bottom: 0;
    border: none;
    border-radius: 0;
    box-shadow: none;
    min-width: fit-content; /* Allow container to expand with content */
  }

  #preview-scroll-container .table-container:not(:last-child) {
    border-bottom: 2px solid #e5e7eb;
  }

  /* Make sure the details table can expand beyond viewport */
  .details-table {
    min-width: max-content; /* Expand to fit all columns */
  }

  .section-title {
    font-size: 32px;
    font-weight: 700;
    margin: 0 0 12px;
    color: white;
    line-height: 1.2;
  }

  .section-subtitle {
    font-size: 16px;
    margin: 0;
    opacity: 0.9;
    color: white;
    line-height: 1.5;
    max-width: 600px;
    margin-left: auto;
    margin-right: auto;
  }

  .card {
    background: white;
    border-radius: 12px;
    padding: 24px;
    margin-bottom: 24px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    border: 1px solid #e5e7eb;
  }

  .section-heading {
    font-size: 18px;
    font-weight: 600;
    color: #1f2937;
    margin: 0 0 20px;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .report-type-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
    gap: 20px;
    margin-top: 16px;
  }

  .report-type-card {
    display: flex;
    align-items: flex-start;
    gap: 16px;
    padding: 24px;
    border: 2px solid #e5e7eb;
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.3s ease;
    background: white;
    min-height: 140px;
  }

  .report-type-card:hover {
    border-color: #2a5da6;
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(42, 93, 166, 0.15);
  }

  .report-type-card.selected {
    border-color: #2a5da6;
    background: #f0f7ff;
    box-shadow: 0 4px 12px rgba(42, 93, 166, 0.1);
  }

  .type-icon {
    font-size: 36px;
    flex-shrink: 0;
    margin-top: 4px;
  }

  .type-info h4 {
    margin: 0 0 8px;
    font-size: 18px;
    font-weight: 600;
    color: #1f2937;
  }

  .type-info p {
    margin: 0 0 16px;
    font-size: 14px;
    color: #6b7280;
    line-height: 1.4;
  }

  .type-features {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .feature-item {
    font-size: 13px;
    color: #6b7280;
    line-height: 1.3;
  }

  .actions-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
    justify-content: space-between;
  }

  .export-buttons {
    display: flex;
    gap: 8px;
  }

  .btn {
    appearance: none;
    border: 1px solid #dcdcdc;
    background: #fff;
    padding: 8px 12px;
    border-radius: 10px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    font-weight: 600;
    transition: all 0.2s ease;
  }

  .btn:disabled {
    opacity: .6;
    cursor: not-allowed;
  }

  .btn-primary {
    background: #2a5da6;
    border-color: #1e3a8a;
    color: #fff;
  }

  .btn-primary:hover:not(:disabled) {
    background: #1e3a8a;
    transform: translateY(-1px);
  }

  .btn-secondary {
    background: #6b7280;
    color: white;
    border: none;
  }

  .btn-secondary:hover:not(:disabled) {
    background: #4b5563;
  }

  .report-preview {
    min-height: 500px;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    background: white;
    overflow: auto;
  }

  .preview-placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 500px;
    color: #6b7280;
    text-align: center;
  }

  .placeholder-icon {
    font-size: 64px;
    margin-bottom: 16px;
    opacity: 0.5;
  }

  .preview-placeholder h4 {
    margin: 0 0 8px;
    font-size: 20px;
    font-weight: 600;
    color: #374151;
  }

  .preview-placeholder p {
    margin: 0 0 24px;
    font-size: 14px;
  }

  .preview-features {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .feature {
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 14px;
    color: #6b7280;
  }

  .feature-icon {
    font-size: 16px;
  }

  .feature-text {
    font-weight: 500;
  }

  /* Loading and error states */
  .loading-report {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 400px;
    text-align: center;
  }

  .loading-spinner {
    width: 40px;
    height: 40px;
    border: 4px solid #f3f4f6;
    border-top: 4px solid #2a5da6;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: 16px;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  .error-report, .export-success {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 400px;
    text-align: center;
  }

  .error-icon, .success-icon {
    font-size: 48px;
    margin-bottom: 16px;
  }

  .error-icon {
    color: #dc3545;
  }

  .success-icon {
    color: #198754;
  }

  /* Enhanced Preview Styles */
  .enhanced-preview {
    background: #fff;
    padding: 32px;
    border-radius: 12px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.05);
  }

  /* Title bar & divider */
  .report-titlebar {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-bottom: 24px;
    text-align: center;
  }

  .report-title {
    font-size: 2rem;
    font-weight: 800;
    color: #1f4fbf;
    margin: 0;
  }

  .report-title-meta {
    display: flex;
    gap: 24px;
    flex-wrap: wrap;
    justify-content: center;
    color: #444;
    font-size: 14px;
  }

  .report-divider {
    border-bottom: 3px solid #1f4fbf;
    opacity: .35;
    margin: 16px 0;
  }

  .report-section-title {
    margin: 0;
    font-size: 1.4rem;
    color: #124;
    font-weight: 600;
  }

  /* KPI cards row */
  .kpi-section {
    margin: 20px 0;
  }

  .kpi-grid {
    display: grid;
    grid-template-columns: repeat(5, minmax(160px, 1fr));
    gap: 16px;
    margin: 24px 0;
  }

  .kpi-card {
    border-radius: 12px;
    padding: 20px;
    text-align: center;
    border: 2px solid #e5e7eb;
    box-shadow: 0 2px 6px rgba(0,0,0,0.05);
    background: #fff;
    transition: all 0.2s ease;
  }

  .kpi-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }

  .kpi-value {
    font-size: 2.2rem;
    font-weight: 800;
    margin-bottom: 8px;
    line-height: 1;
  }

  .kpi-label {
    color: #555;
    font-weight: 600;
    font-size: 14px;
  }

  /* Color accents per card */
  .kpi-total {
    background: linear-gradient(135deg, #2a5da6 0%, #1e3a8a 100%);
    color: #fff;
    border: none;
  }

  .kpi-total .kpi-label {
    color: rgba(255,255,255,0.9);
  }

  .kpi-blocked {
    border-left: 4px solid #dc3545;
    background: #fef2f2;
  }

  .kpi-conflict {
    border-left: 4px solid #fd7e14;
    background: #fff7ed;
  }

  .kpi-safe {
    border-left: 4px solid #198754;
    background: #f0f9ff;
  }

  .kpi-safewc {
    border-left: 4px solid #0d6efd;
    background: #eff6ff;
  }

  .kpi-blocked .kpi-value {
    color: #dc3545;
  }

  .kpi-conflict .kpi-value {
    color: #fd7e14;
  }

  .kpi-safe .kpi-value {
    color: #198754;
  }

  .kpi-safewc .kpi-value {
    color: #0d6efd;
  }

  /* Export toolbar */
  .export-toolbar {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    margin: 20px 0;
  }

  .export-btn {
    background: #2a5da6;
    color: #fff;
    border: none;
    border-radius: 8px;
    padding: 10px 16px;
    cursor: pointer;
    font-weight: 600;
    font-size: 14px;
    transition: background 0.2s;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .export-btn:hover {
    background: #1e3a8a;
  }

  /* Professional Table Styles - Fixed */
  .table-container {
    overflow-x: auto;
    border: 1px solid #e1e5e9;
    border-radius: 8px;
    background: white;
    margin-bottom: 24px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }

  .details-table {
    min-width: 100%;
    width: auto;
    border-collapse: collapse;
  }

  .table-header {
    display: grid;
    background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%);
    padding: 16px 20px;
    font-weight: 600;
    font-size: 14px;
    color: white;
    border-bottom: 2px solid #2c3e50;
    gap: 16px;
    position: sticky;
    top: 0;
    z-index: 10;
  }

  .table-row {
    display: grid;
    padding: 14px 20px;
    border-bottom: 1px solid #f0f2f5;
    font-size: 14px;
    align-items: center;
    gap: 16px;
    transition: background-color 0.2s ease;
    background: white;
    min-height: 50px;
  }

  .table-row:hover {
    background: #f8fafc;
  }

  .table-row:nth-child(even) {
    background: #fafbfc;
  }

  .table-row:nth-child(even):hover {
    background: #f1f5f9;
  }

  .table-row:last-child {
    border-bottom: none;
  }

  /* Column-specific styles */
  .table-header span,
  .table-row span {
    min-height: 20px;
    display: flex;
    align-items: center;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    line-height: 1.4;
  }

  .col-story-id {
    font-weight: 600;
    color: #2a5da6;
  }

  .col-developer {
    font-weight: 500;
    color: #374151;
  }

  .col-components,
  .col-reason,
  .col-involved-stories {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .col-components {
    background: #f8f9fa;
    padding: 6px 10px;
    border-radius: 4px;
    border: 1px solid #e9ecef;
    font-size: 13px;
  }

  .col-reason {
    background: #fff3cd;
    padding: 6px 10px;
    border-radius: 4px;
    border: 1px solid #ffeaa7;
    font-size: 13px;
    color: #856404;
  }

  .col-count,
  .col-commits,
  .col-deployment,
  .col-unique-stories {
    text-align: center;
    justify-content: center;
    font-weight: 600;
  }

  .col-task-type,
  .col-timing,
  .col-resolution {
    background: #e7f3ff;
    padding: 6px 10px;
    border-radius: 4px;
    font-size: 13px;
    text-align: center;
    justify-content: center;
  }

  .col-commit,
  .col-commit-hash {
    font-family: 'Courier New', monospace;
    font-size: 12px;
    color: #6b7280;
  }

  .deployment-yes {
    color: #198754;
    background: #d1fae5;
    padding: 4px 8px;
    border-radius: 4px;
    font-weight: 600;
  }

  .deployment-no {
    color: #dc3545;
    background: #fecaca;
    padding: 4px 8px;
    border-radius: 4px;
    font-weight: 600;
  }

  /* Specific table column layouts */
  .component-conflict-table .table-header,
  .component-conflict-table .table-row {
    grid-template-columns: 140px minmax(220px, 1.4fr) 120px minmax(180px, 1.1fr) 120px 160px 170px 120px minmax(260px, 2fr);
  }

  .blocked-table .table-header,
  .blocked-table .table-row {
    grid-template-columns: 130px 180px 1.4fr 1.2fr 240px 120px;
  }

  .safe-table .table-header,
  .safe-table .table-row {
    grid-template-columns: 130px 180px 150px 260px 150px 160px 160px;
  }

  .safecommit-table .table-header,
  .safecommit-table .table-row {
    grid-template-columns: 130px 180px 150px 260px 150px 160px 160px;
  }

  .conflict-table .table-header,
  .conflict-table .table-row {
    grid-template-columns: 130px 180px 1.5fr 180px 1.2fr 130px;
  }

  /* Section headers */
  .component-conflicts h2,
  .safe-stories h2,
  .safe-commit-stories h2,
  .blocked-stories h2,
  .conflict-stories h2 {
    font-size: 1.3rem;
    font-weight: 700;
    color: #1f2937;
    margin: 0 0 16px;
    padding-bottom: 12px;
    border-bottom: 2px solid #e5e7eb;
  }

  .section-description {
    font-size: 14px;
    color: #6b7280;
    margin: -8px 0 20px 0;
    font-style: italic;
  }

  /* Scroll container for tables */
  #preview-scroll-container {
    max-height: 70vh;
    overflow-y: auto;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 0;
    margin-top: 16px;
  }

  #preview-scroll-container .table-container {
    margin-bottom: 0;
    border: none;
    border-radius: 0;
    box-shadow: none;
  }

  #preview-scroll-container .table-container:not(:last-child) {
    border-bottom: 2px solid #e5e7eb;
  }

  /* Responsive design */
  @media (max-width: 1200px) {
    .kpi-grid {
      grid-template-columns: repeat(3, minmax(160px, 1fr));
    }
    
    .kpi-total {
      grid-column: span 3;
    }
  }

  @media (max-width: 768px) {
    .tab-reports {
      padding: 16px;
    }

    .section-header {
      padding: 20px 16px;
    }

    .section-title {
      font-size: 24px;
    }

    .section-subtitle {
      font-size: 14px;
    }

    .report-type-grid {
      grid-template-columns: 1fr;
    }

    .kpi-grid {
      grid-template-columns: repeat(2, minmax(140px, 1fr));
      gap: 12px;
    }

    .kpi-total {
      grid-column: span 2;
    }

    .kpi-card {
      padding: 16px 12px;
    }

    .kpi-value {
      font-size: 1.8rem;
    }

    .actions-grid {
      flex-direction: column;
      align-items: stretch;
    }

    .export-buttons {
      justify-content: center;
    }

    .export-toolbar {
      justify-content: center;
    }

    .report-title {
      font-size: 1.5rem;
    }

    .report-title-meta {
      flex-direction: column;
      gap: 8px;
    }

    .enhanced-preview {
      padding: 20px 16px;
    }
  }

  @media (max-width: 480px) {
    .kpi-grid {
      grid-template-columns: 1fr;
    }

    .kpi-total {
      grid-column: span 1;
    }

    .kpi-value {
      font-size: 1.6rem;
    }
  }
  `;

  const style = document.createElement('style');
  style.id = 'reports-enhanced-css';
  style.textContent = css;
  document.head.appendChild(style);
}
