// ui/src/ui/tabs/reports-enhanced.js
import { createFilterBar } from '../components/filterBar.js';
import { generateDeploymentReport } from '../components/report-generator.js';
import { exportToPDF } from '../utils/export-pdf-simple.js';
import { exportToXLS } from '../utils/export-xls.js';

const $ = (s, r=document) => r.querySelector(s);

let REPORTS_STATE = {
  reportType: localStorage.getItem('ui.reports.type') || 'technical'
};

let CURRENT_ANALYSIS = {};
let CURRENT_REPORT_DATA = {};

export function renderReportsTab(analysis = {}) {
  const panel = $('#tab-reports');
  if (!panel) return;

  CURRENT_ANALYSIS = analysis;

  panel.innerHTML = '';

  // Header with enhanced styling
  const header = createElement('div', { className: 'section-header' }, [
    createElement('h2', { className: 'section-title' }, '📊 Deployment Reports'),
    createElement('p', { className: 'section-subtitle' }, 'Generate comprehensive deployment readiness reports with detailed component analysis')
  ]);
  panel.append(header);

  // Report Type Selection - Only Technical and Developer
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

  // Action Buttons with better layout
  const actionsSection = createElement('div', { className: 'report-actions-section card' });
  actionsSection.innerHTML = `
    <h3 class="section-heading">🎯 Generate Report</h3>
    <div class="actions-grid">
      <button class="btn btn-primary generate-btn" id="generate-report">
        <span class="btn-icon">🚀</span>
        Generate Enhanced Report
      </button>
      <div class="export-buttons">
        <button class="btn btn-secondary export-btn" data-format="pdf" disabled>
          <span class="btn-icon">📑</span>
          Export as PDF
        </button>
        <button class="btn btn-secondary export-btn" data-format="xls" disabled>
          <span class="btn-icon">📊</span>
          Export as XLS
        </button>
      </div>
    </div>
  `;
  panel.append(actionsSection);

  // Report Preview with enhanced design
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

function setupEventListeners(panel, analysis) {
  // Report type selection
  panel.querySelectorAll('.report-type-card').forEach(card => {
    card.addEventListener('click', () => {
      panel.querySelectorAll('.report-type-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      REPORTS_STATE.reportType = card.dataset.type;
      localStorage.setItem('ui.reports.type', REPORTS_STATE.reportType);
    });
  });

  // Generate report button
  const generateBtn = panel.querySelector('#generate-report');
  if (generateBtn) {
    generateBtn.addEventListener('click', () => {
      generateAndDisplayReport(analysis, panel);
    });
  }

  // Export buttons
  panel.querySelectorAll('.export-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const format = e.target.dataset.format;
      exportReport(format, analysis, panel);
    });
  });
}

function generateAndDisplayReport(analysis, panel) {
  const generateBtn = panel.querySelector('#generate-report');
  const preview = panel.querySelector('#report-preview');
  
  if (!generateBtn || !preview) return;

  // Show loading state
  generateBtn.innerHTML = '⏳ Generating Enhanced Report...';
  generateBtn.disabled = true;
  preview.innerHTML = `
    <div class="loading-report">
      <div class="loading-spinner"></div>
      <h4>Generating Enhanced Analysis</h4>
      <p>Analyzing component conflicts, blocking reasons, and deployment readiness...</p>
    </div>
  `;

  // Simulate processing time
  setTimeout(() => {
    try {
      console.log('Generating report with analysis:', analysis);
      const reportData = generateDeploymentReport(analysis, REPORTS_STATE);
      CURRENT_REPORT_DATA = reportData; // Store for export
      console.log('Generated report data:', reportData);
      displayEnhancedReportPreview(reportData, panel, analysis);
      
      // Enable export buttons
      panel.querySelectorAll('.export-btn').forEach(btn => {
        btn.disabled = false;
      });
      
    } catch (error) {
      console.error('Error generating enhanced report:', error);
      preview.innerHTML = `
        <div class="error-report">
          <div class="error-icon">❌</div>
          <h4>Error Generating Enhanced Report</h4>
          <p>${error.message}</p>
          <button class="btn btn-secondary retry-btn">Try Again</button>
        </div>
      `;
      
      // Add retry button event listener
      const retryBtn = preview.querySelector('.retry-btn');
      if (retryBtn) {
        retryBtn.addEventListener('click', () => {
          generateAndDisplayReport(analysis, panel);
        });
      }
    } finally {
      generateBtn.innerHTML = '🚀 Generate Enhanced Report';
      generateBtn.disabled = false;
    }
  }, 1500);
}

function displayEnhancedReportPreview(reportData, panel, analysis) {
  const preview = panel.querySelector('#report-preview');
  if (!preview) return;

  let content = `
    <div class="report-content">
      <header class="report-header">
        <h1>${reportData.title || 'Deployment Report'}</h1>
        <div class="report-meta">
          <span class="report-date">Generated: ${reportData.generatedAt || new Date().toLocaleString()}</span>
          <span class="report-type">Type: ${reportData.type || 'technical'}</span>
        </div>
      </header>
  `;

  const reportType = reportData.type || 'technical';
  
  try {
    if (reportType === 'technical') {
      content += generateTechnicalPreview(reportData, analysis);
    } else {
      content += generateDeveloperPreview(reportData, analysis);
    }
  } catch (error) {
    console.error('Error generating preview content:', error);
    content += `
      <section class="error">
        <h2>Error Generating Preview</h2>
        <p>${error.message}</p>
      </section>
    `;
  }

  content += `</div>`;
  preview.innerHTML = content;
}

function generateTechnicalPreview(reportData, analysis) {
  const blockedStories = Array.isArray(reportData.blockedStories) ? reportData.blockedStories : [];
  const conflictStories = Array.isArray(reportData.conflictStories) ? reportData.conflictStories : [];
  const safeStories = Array.isArray(reportData.safeStories) ? reportData.safeStories : [];
  const safeWithCommitStories = Array.isArray(reportData.safeWithCommitStories) ? reportData.safeWithCommitStories : [];
  const componentConflicts = Array.isArray(reportData.componentConflicts) ? reportData.componentConflicts : [];
  
  const totalStories = blockedStories.length + conflictStories.length + 
                      safeStories.length + safeWithCommitStories.length;
  
  return `
    <section class="technical-overview">
      <h2>🔧 Technical Analysis - All Story Types</h2>
      <div class="technical-stats">
        <div class="tech-stat total">
          <span class="tech-label">📊 Total Stories:</span>
          <span class="tech-value">${totalStories}</span>
        </div>
        <div class="tech-stat blocked">
          <span class="tech-label">🚫 Blocked Stories:</span>
          <span class="tech-value">${blockedStories.length}</span>
        </div>
        <div class="tech-stat conflict">
          <span class="tech-label">🔄 Conflict Stories:</span>
          <span class="tech-value">${conflictStories.length}</span>
        </div>
        <div class="tech-stat safe">
          <span class="tech-label">✅ Safe Stories:</span>
          <span class="tech-value">${safeStories.length}</span>
        </div>
        <div class="tech-stat safe-commit">
          <span class="tech-label">✅ Safe with Commit:</span>
          <span class="tech-value">${safeWithCommitStories.length}</span>
        </div>
        <div class="tech-stat component-conflicts">
          <span class="tech-label">🔗 Component Conflicts:</span>
          <span class="tech-value">${componentConflicts.length}</span>
        </div>
      </div>
    </section>
    
    ${componentConflicts.length > 0 ? `
    <section class="component-conflicts">
      <h2>🔗 Component Conflict Analysis (${componentConflicts.length} Unique Components)</h2>
      <p class="section-description">Each component shown once with all affected stories and developers - no duplicate story IDs</p>
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
              <span class="col-comp-type">${comp.componentType || 'N/A'}</span>
              <span class="col-comp-name" title="${comp.componentName || 'N/A'}">${comp.componentName ? (comp.componentName.length > 30 ? comp.componentName.substring(0, 30) + '...' : comp.componentName) : 'N/A'}</span>
              <span class="col-unique-stories">${comp.uniqueStories || 0}</span>
              <span class="col-developers" title="${comp.developers || 'N/A'}">${comp.developers ? (comp.developers.length > 20 ? comp.developers.substring(0, 20) + '...' : comp.developers) : 'N/A'}</span>
              <span class="col-latest-story">${comp.latestStory || 'N/A'}</span>
              <span class="col-latest-developer">${comp.latestDeveloper || 'N/A'}</span>
              <span class="col-latest-commit">${comp.latestCommitDate || 'N/A'}</span>
              <span class="col-commit-hash" title="${comp.latestCommitHash || 'N/A'}">${comp.latestCommitHash && comp.latestCommitHash !== 'N/A' ? comp.latestCommitHash.substring(0, 8) + '...' : 'N/A'}</span>
              <span class="col-involved-stories" title="${comp.involvedStories || 'N/A'}">
                ${comp.involvedStories ? (comp.involvedStories.length > 80 ? comp.involvedStories.substring(0, 80) + '...' : comp.involvedStories) : 'N/A'}
              </span>
            </div>
          `).join('')}
        </div>
      </div>
    </section>
    ` : ''}
    
    ${conflictStories.length > 0 ? `
    <section class="conflict-details">
      <h2>🔄 Conflict Stories Report (${conflictStories.length})</h2>
      <p class="section-description">Traditional story-centric view (shows duplicate story IDs for multiple components)</p>
      <div class="table-container">
        <div class="details-table conflict-table">
          <div class="table-header">
            <span class="col-story-id">Story ID</span>
            <span class="col-developer">Developer</span>
            <span class="col-components">Conflict Components</span>
            <span class="col-resolution">Resolution Status</span>
            <span class="col-conflicts">Conflicting With</span>
            <span class="col-deployment">Deployment Task</span>
          </div>
          ${conflictStories.map(story => `
            <div class="table-row">
              <span class="col-story-id">${story.story_id || 'N/A'}</span>
              <span class="col-developer">${story.developer || 'Unknown'}</span>
              <span class="col-components" title="${Array.isArray(story.conflict_components) ? story.conflict_components.join(', ') : 'No components'}">
                ${Array.isArray(story.conflict_components) ? 
                  (story.conflict_components.length > 3 ? 
                    `${story.conflict_components.slice(0, 3).join(', ')}... (+${story.conflict_components.length - 3} more)` : 
                    story.conflict_components.join(', ')) 
                  : 'No components'}
              </span>
              <span class="col-resolution">${Array.isArray(story.resolution_status) ? story.resolution_status.join(', ') : 'N/A'}</span>
              <span class="col-conflicts">${Array.isArray(story.conflicts) && story.conflicts.length > 0 ? 
                `${story.conflicts[0].conflicting_story.id} (${story.conflicts[0].conflicting_story.developer})` : 'None'}</span>
              <span class="col-deployment ${story.has_deployment_task ? 'deployment-yes' : 'deployment-no'}">
                ${story.has_deployment_task ? '✅' : '❌'}
              </span>
            </div>
          `).join('')}
        </div>
      </div>
    </section>
    ` : '<section class="no-data"><p>No conflict stories found.</p></section>'}
    
    ${blockedStories.length > 0 ? `
    <section class="blocked-details">
      <h2>🚫 Blocked Stories Report (${blockedStories.length})</h2>
      <div class="table-container">
        <div class="details-table blocked-table">
          <div class="table-header">
            <span class="col-story-id">Story ID</span>
            <span class="col-developer">Developer</span>
            <span class="col-components">Blocking Components</span>
            <span class="col-reason">Blocking Reason</span>
            <span class="col-production">Production User Story</span>
            <span class="col-deployment">Deployment Task</span>
          </div>
          ${blockedStories.map(story => `
            <div class="table-row">
              <span class="col-story-id">${story.story_id || 'N/A'}</span>
              <span class="col-developer">${story.developer || 'Unknown'}</span>
              <span class="col-components" title="${Array.isArray(story.blocking_components) ? story.blocking_components.join(', ') : 'No components'}">
                ${Array.isArray(story.blocking_components) ? 
                  (story.blocking_components.length > 3 ? 
                    `${story.blocking_components.slice(0, 3).join(', ')}... (+${story.blocking_components.length - 3} more)` : 
                    story.blocking_components.join(', ')) 
                  : 'No components'}
              </span>
              <span class="col-reason" title="${Array.isArray(story.blocking_reasons) && story.blocking_reasons.length > 0 ? story.blocking_reasons[0] : 'No reason specified'}">
                ${Array.isArray(story.blocking_reasons) && story.blocking_reasons.length > 0 ? 
                  (story.blocking_reasons[0].length > 100 ? 
                    story.blocking_reasons[0].substring(0, 100) + '...' : 
                    story.blocking_reasons[0]) 
                  : 'No reason specified'}
              </span>
              <span class="col-production">${Array.isArray(story.production_blockers) && story.production_blockers.length > 0 ? 
                story.production_blockers[0].production_story_id : 'None'}</span>
              <span class="col-deployment ${story.has_deployment_task ? 'deployment-yes' : 'deployment-no'}">
                ${story.has_deployment_task ? '✅' : '❌'}
              </span>
            </div>
          `).join('')}
        </div>
      </div>
    </section>
    ` : '<section class="no-data"><p>No blocked stories found.</p></section>'}
    
    ${safeStories.length > 0 ? `
    <section class="safe-details">
      <h2>✅ Safe Stories Report (${safeStories.length})</h2>
      <div class="table-container">
        <div class="details-table safe-table">
          <div class="table-header">
            <span class="col-story-id">Story ID</span>
            <span class="col-developer">Developer</span>
            <span class="col-count">Component Count</span>
            <span class="col-commits">Has Commits</span>
            <span class="col-deployment">Deployment Task</span>
            <span class="col-task-type">Task Type</span>
            <span class="col-timing">Timing</span>
          </div>
          ${safeStories.map(story => `
            <div class="table-row">
              <span class="col-story-id">${story.story_id || 'N/A'}</span>
              <span class="col-developer">${story.developer || 'Unknown'}</span>
              <span class="col-count">${story.component_count || 0}</span>
              <span class="col-commits">${story.has_commits ? '✅' : '❌'}</span>
              <span class="col-deployment">${story.has_deployment_task ? '✅' : '❌'}</span>
              <span class="col-task-type">${story.task_type || 'N/A'}</span>
              <span class="col-timing">${story.timing || 'N/A'}</span>
            </div>
          `).join('')}
        </div>
      </div>
    </section>
    ` : '<section class="no-data"><p>No safe stories found.</p></section>'}
    
    ${safeWithCommitStories.length > 0 ? `
    <section class="safe-commit-details">
      <h2>✅ Safe with Commit Stories Report (${safeWithCommitStories.length})</h2>
      <div class="table-container">
        <div class="details-table safe-commit-table">
          <div class="table-header">
            <span class="col-story-id">Story ID</span>
            <span class="col-developer">Developer</span>
            <span class="col-count">Component Count</span>
            <span class="col-commit">Latest Commit</span>
            <span class="col-deployment">Deployment Task</span>
            <span class="col-task-type">Task Type</span>
            <span class="col-timing">Timing</span>
          </div>
          ${safeWithCommitStories.map(story => `
            <div class="table-row">
              <span class="col-story-id">${story.story_id || 'N/A'}</span>
              <span class="col-developer">${story.developer || 'Unknown'}</span>
              <span class="col-count">${story.component_count || 0}</span>
              <span class="col-commit">${story.commit_date || 'N/A'}</span>
              <span class="col-deployment">${story.has_deployment_task ? '✅' : '❌'}</span>
              <span class="col-task-type">${story.task_type || 'N/A'}</span>
              <span class="col-timing">${story.timing || 'N/A'}</span>
            </div>
          `).join('')}
        </div>
      </div>
    </section>
    ` : '<section class="no-data"><p>No safe with commit stories found.</p></section>'}
  `;
}


function generateDeveloperPreview(reportData, analysis) {
  const assignments = Array.isArray(reportData.developerAssignments) ? reportData.developerAssignments : [];
  const blockedActions = Array.isArray(reportData.blockedActions) ? reportData.blockedActions : [];
  const conflictActions = Array.isArray(reportData.conflictActions) ? reportData.conflictActions : [];
  const safeDeployments = Array.isArray(reportData.safeDeployments) ? reportData.safeDeployments : [];
  const safeWithCommitDeployments = Array.isArray(reportData.safeWithCommitDeployments) ? reportData.safeWithCommitDeployments : [];
  
  return `
    <section class="developer-assignments">
      <h2>👥 Developer Assignments - Workload Overview</h2>
      <div class="assignments-grid detailed">
        ${assignments.length > 0 ? assignments.map(dev => `
          <div class="developer-card detailed">
            <div class="developer-header">
              <h4>${dev.developer || 'Unknown Developer'}</h4>
              <span class="total-badge">${dev.total || 0} total</span>
            </div>
            <div class="developer-stats-detailed">
              <div class="stat-item blocked">
                <span class="stat-label">🚫 Blocked:</span>
                <span class="stat-value">${dev.blocked || 0}</span>
              </div>
              <div class="stat-item conflict">
                <span class="stat-label">🔄 Conflicts:</span>
                <span class="stat-value">${dev.conflicts || 0}</span>
              </div>
              <div class="stat-item safe">
                <span class="stat-label">✅ Safe:</span>
                <span class="stat-value">${dev.safe || 0}</span>
              </div>
              <div class="stat-item safe-commit">
                <span class="stat-label">✅ Safe with Commit:</span>
                <span class="stat-value">${dev.safeWithCommit || 0}</span>
              </div>
            </div>
            ${dev.stories && dev.stories.length > 0 ? `
            <div class="developer-stories">
              <div class="stories-header">Recent Stories:</div>
              ${dev.stories.slice(0, 3).map(story => `
                <div class="story-item status-${story.status}">
                  <span class="story-id">${story.id}</span>
                  <span class="story-status">${story.status}</span>
                </div>
              `).join('')}
              ${dev.stories.length > 3 ? `<div class="more-stories">+ ${dev.stories.length - 3} more stories</div>` : ''}
            </div>
            ` : ''}
          </div>
        `).join('') : '<div class="no-data">No developer assignments found.</div>'}
      </div>
    </section>
    
    ${blockedActions.length > 0 ? `
    <section class="blocked-actions">
      <h2>🚫 Blocked Story Actions (${blockedActions.length})</h2>
      <div class="actions-list">
        ${blockedActions.map(action => `
          <div class="action-item priority-high">
            <div class="action-header">
              <span class="action-developer">${action.developer || 'Unknown'}</span>
              <span class="action-story">${action.story_id || 'N/A'}</span>
              <span class="action-priority">High Priority</span>
            </div>
            <div class="action-text">${action.action || 'No action specified'}</div>
            ${action.details ? `<div class="action-details">${action.details}</div>` : ''}
          </div>
        `).join('')}
      </div>
    </section>
    ` : ''}
    
    ${conflictActions.length > 0 ? `
    <section class="conflict-actions">
      <h2>🔄 Conflict Resolution Actions (${conflictActions.length})</h2>
      <div class="actions-list">
        ${conflictActions.map(action => `
          <div class="action-item priority-medium">
            <div class="action-header">
              <span class="action-developer">${action.developer || 'Unknown'}</span>
              <span class="action-story">${action.story_id || 'N/A'}</span>
              <span class="action-priority">Medium Priority</span>
            </div>
            <div class="action-text">${action.action || 'No action specified'}</div>
            ${action.details ? `<div class="action-details">${action.details}</div>` : ''}
          </div>
        `).join('')}
      </div>
    </section>
    ` : ''}
    
    ${safeWithCommitDeployments.length > 0 ? `
    <section class="safe-commit-actions">
      <h2>✅ Safe with Commit Deployment Actions (${safeWithCommitDeployments.length})</h2>
      <div class="actions-list">
        ${safeWithCommitDeployments.map(action => `
          <div class="action-item priority-low">
            <div class="action-header">
              <span class="action-developer">${action.developer || 'Unknown'}</span>
              <span class="action-story">${action.story_id || 'N/A'}</span>
              <span class="action-priority">Ready for Deployment</span>
            </div>
            <div class="action-text">${action.action || 'No action specified'}</div>
            ${action.details ? `<div class="action-details">${action.details}</div>` : ''}
          </div>
        `).join('')}
      </div>
    </section>
    ` : ''}
    
    ${safeDeployments.length > 0 ? `
    <section class="safe-actions">
      <h2>✅ Safe Stories Actions (${safeDeployments.length})</h2>
      <div class="actions-list">
        ${safeDeployments.map(action => `
          <div class="action-item priority-low">
            <div class="action-header">
              <span class="action-developer">${action.developer || 'Unknown'}</span>
              <span class="action-story">${action.story_id || 'N/A'}</span>
              <span class="action-priority">Needs Setup</span>
            </div>
            <div class="action-text">${action.action || 'No action specified'}</div>
          </div>
        `).join('')}
      </div>
    </section>
    ` : ''}
  `;
}

function exportReport(format, analysis, panel) {
  try {
    // Use the current report data that was generated for the preview
    const reportData = CURRENT_REPORT_DATA;
    
    if (!reportData) {
      throw new Error('No report data available. Please generate a report first.');
    }
    
    switch (format) {
      case 'xls':
        exportToXLS(reportData, analysis, REPORTS_STATE.reportType);
        showExportSuccess(panel, 'XLSX');
        break;
      case 'pdf':
        exportToPDF(reportData, analysis, REPORTS_STATE.reportType);
        showExportSuccess(panel, 'PDF');
        break;
    }
  } catch (error) {
    console.error('Export error:', error);
    showExportError(panel, error.message);
  }
}

function showExportSuccess(panel, format) {
  const preview = panel.querySelector('#report-preview');
  if (!preview) return;

  preview.innerHTML = `
    <div class="export-success">
      <div class="success-icon">✅</div>
      <h4>${format} Report Exported Successfully</h4>
      <p>Your ${format} file has been downloaded with detailed component analysis.</p>
      <button class="btn btn-secondary view-preview-btn">View Preview Again</button>
    </div>
  `;

  // Add event listener for view preview button
  const viewPreviewBtn = preview.querySelector('.view-preview-btn');
  if (viewPreviewBtn) {
    viewPreviewBtn.addEventListener('click', () => {
      generateAndDisplayReport(CURRENT_ANALYSIS, panel);
    });
  }
}

function showExportError(panel, message) {
  const preview = panel.querySelector('#report-preview');
  if (!preview) return;

  preview.innerHTML = `
    <div class="error-report">
      <div class="error-icon">❌</div>
      <h4>Export Failed</h4>
      <p>${message}</p>
      <button class="btn btn-secondary retry-export-btn">Try Again</button>
    </div>
  `;

  // Add event listener for retry button
  const retryBtn = preview.querySelector('.retry-export-btn');
  if (retryBtn) {
    retryBtn.addEventListener('click', () => {
      renderReportsTab(CURRENT_ANALYSIS);
    });
  }
}

// Utility functions
function getTotalStories(analysis) {
  return (analysis.all_stories?.length || 0) + 
         (analysis.component_conflicts?.length || 0) + 
         (analysis.blocked_stories?.length || 0);
}

function getTopBlockingReason(blockedAnalysis) {
  if (!blockedAnalysis.commonReasons || typeof blockedAnalysis.commonReasons !== 'object') {
    return 'N/A';
  }
  const entries = Object.entries(blockedAnalysis.commonReasons);
  if (entries.length === 0) return 'N/A';
  const sorted = entries.sort((a, b) => b[1] - a[1]);
  return sorted[0][0] || 'N/A';
}

function createElement(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  Object.assign(node, props);
  const childArray = Array.isArray(children) ? children : children ? [children] : [];
  childArray.forEach(child => {
    if (typeof child === 'string') {
      node.appendChild(document.createTextNode(child));
    } else if (child instanceof Node) {
      node.appendChild(child);
    }
  });
  return node;
}

// Make renderReportsTab available globally for error recovery
window.renderReportsTab = renderReportsTab;

const injectEnhancedCss = (() => {
  let done = false;
  return () => {
    if (done) return;
    done = true;

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

       .component-conflict-table .table-header,
  .component-conflict-table .table-row {
    grid-template-columns: 120px minmax(200px, 1fr) 100px 150px 120px 150px 140px 100px minmax(250px, 2fr);
  }

  .tech-stat.component-conflicts {
    border-left: 4px solid #6f42c1;
    background: #f8f9fa;
  }

  .tech-stat.component-conflicts .tech-label {
    color: #6f42c1;
  }

  .tech-stat.component-conflicts .tech-value {
    color: #6f42c1;
  }

  .section-description {
    font-size: 14px;
    color: #6b7280;
    margin: -10px 0 20px 0;
    font-style: italic;

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

      .options-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
        gap: 16px;
      }

      .option-checkbox {
        display: flex;
        align-items: center;
        gap: 12px;
        cursor: pointer;
        padding: 12px;
        border-radius: 8px;
        border: 1px solid #e5e7eb;
        transition: all 0.2s ease;
      }

      .option-checkbox:hover {
        border-color: #2a5da6;
        background: #f8fafc;
      }

      .option-label {
        font-size: 14px;
        font-weight: 500;
        color: #374151;
      }

      .actions-grid {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      .generate-btn, .export-btn {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 12px 24px;
        border: none;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
      }

      .generate-btn {
        background: #2a5da6;
        color: white;
      }

      .generate-btn:hover:not(:disabled) {
        background: #1e3a8a;
        transform: translateY(-1px);
      }

      .export-btn {
        background: #6b7280;
        color: white;
      }

      .export-btn:hover:not(:disabled) {
        background: #4b5563;
      }

      .export-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .export-buttons {
        display: flex;
        gap: 12px;
      }

      .btn-icon {
        font-size: 16px;
      }

      /* Enhanced preview styles */
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

      /* Report content styles */
      .report-content {
        padding: 32px;
      }

      .report-header {
        text-align: center;
        margin-bottom: 32px;
        padding-bottom: 24px;
        border-bottom: 2px solid #e5e7eb;
      }

      .report-header h1 {
        margin: 0 0 12px;
        font-size: 28px;
        font-weight: 700;
        color: #1f2937;
      }

      .report-meta {
        display: flex;
        justify-content: center;
        gap: 24px;
        font-size: 14px;
        color: #6b7280;
      }

      /* Enhanced Table Styles with Fixed Layout */
      .table-container {
        overflow-x: auto;
        border: 1px solid #e5e7eb;
        border-radius: 12px;
        background: white;
        margin-bottom: 24px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
      }

      .details-table {
        min-width: 100%;
        width: auto;
      }

      .table-header {
        display: grid;
        background: #f8fafc;
        padding: 18px 20px;
        font-weight: 600;
        font-size: 14px;
        color: #374151;
        border-bottom: 2px solid #e5e7eb;
        gap: 16px;
      }

      .table-row {
        display: grid;
        padding: 16px 20px;
        border-bottom: 1px solid #f3f4f6;
        font-size: 14px;
        align-items: start;
        gap: 16px;
        transition: background-color 0.2s ease;
      }

      .table-row:hover {
        background: #f9fafb;
      }

      .table-row:last-child {
        border-bottom: none;
      }

      /* Fixed column widths for better layout */
      .blocked-table .table-header,
      .blocked-table .table-row {
        grid-template-columns: 140px 150px minmax(200px, 2fr) minmax(200px, 2fr) 160px 120px;
      }

      .conflict-table .table-header,
      .conflict-table .table-row {
        grid-template-columns: 140px 150px minmax(200px, 2fr) 150px 200px 120px;
      }

      .safe-table .table-header,
      .safe-table .table-row {
        grid-template-columns: 140px 150px 120px 100px 120px 120px 140px;
      }

      .safe-commit-table .table-header,
      .safe-commit-table .table-row {
        grid-template-columns: 140px 150px 120px 150px 120px 120px 140px;
      }

      /* Column-specific styles */
      .col-story-id {
        font-weight: 600;
        color: #2a5da6;
        word-break: break-word;
      }

      .col-developer {
        word-break: break-word;
        font-weight: 500;
      }

      .col-components,
      .col-reason {
        word-break: break-word;
        line-height: 1.4;
        min-height: 20px;
      }

      .col-components {
        background: #f8f9fa;
        padding: 8px 12px;
        border-radius: 6px;
        border: 1px solid #e9ecef;
        font-size: 13px;
      }

      .col-reason {
        background: #fff3cd;
        padding: 8px 12px;
        border-radius: 6px;
        border: 1px solid #ffeaa7;
        font-size: 13px;
        color: #856404;
      }

      .col-production,
      .col-conflicts {
        word-break: break-word;
        font-weight: 500;
      }

      .col-count,
      .col-commits,
      .col-deployment {
        text-align: center;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 600;
      }

      .col-task-type,
      .col-timing,
      .col-resolution {
        word-break: break-word;
        background: #e7f3ff;
        padding: 6px 10px;
        border-radius: 4px;
        font-size: 13px;
        text-align: center;
      }

      .col-commit {
        font-family: 'Courier New', monospace;
        font-size: 12px;
        color: #6b7280;
      }

      .deployment-yes {
        color: #198754;
      }

      .deployment-no {
        color: #dc3545;
      }

      /* Enhanced Technical Stats */
      .technical-stats {
        display: grid;
        grid-template-columns: repeat(5, 1fr);
        gap: 16px;
        margin: 24px 0;
      }

      .tech-stat {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 24px 16px;
        background: #f8fafc;
        border-radius: 12px;
        border: 2px solid #e5e7eb;
        text-align: center;
        min-height: 100px;
        transition: all 0.2s ease;
      }

      .tech-stat:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      }

      .tech-stat.total {
        background: linear-gradient(135deg, #2a5da6 0%, #1e3a8a 100%);
        color: white;
        border: none;
        grid-column: span 1;
      }

      .tech-stat.blocked {
        border-left: 4px solid #dc3545;
        background: #fef2f2;
      }

      .tech-stat.conflict {
        border-left: 4px solid #fd7e14;
        background: #fff7ed;
      }

      .tech-stat.safe {
        border-left: 4px solid #198754;
        background: #f0f9ff;
      }

      .tech-stat.safe-commit {
        border-left: 4px solid #0d6efd;
        background: #eff6ff;
      }

      .tech-label {
        font-size: 14px;
        font-weight: 500;
        margin-bottom: 8px;
        text-align: center;
      }

      .tech-stat.total .tech-label {
        color: rgba(255, 255, 255, 0.9);
        font-weight: 600;
      }

      .tech-stat.blocked .tech-label {
        color: #dc3545;
      }

      .tech-stat.conflict .tech-label {
        color: #fd7e14;
      }

      .tech-stat.safe .tech-label {
        color: #198754;
      }

      .tech-stat.safe-commit .tech-label {
        color: #0d6efd;
      }

      .tech-value {
        font-size: 28px;
        font-weight: 800;
        line-height: 1;
      }

      .tech-stat.total .tech-value {
        color: white;
        font-size: 32px;
      }

      .tech-stat.blocked .tech-value {
        color: #dc3545;
      }

      .tech-stat.conflict .tech-value {
        color: #fd7e14;
      }

      .tech-stat.safe .tech-value {
        color: #198754;
      }

      .tech-stat.safe-commit .tech-value {
        color: #0d6efd;
      }

      /* Developer assignments styles */
      .assignments-grid.detailed {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
        gap: 20px;
      }

      .developer-card.detailed {
        border: 1px solid #e5e7eb;
        border-radius: 12px;
        padding: 20px;
        background: white;
        box-shadow: 0 2px 8px rgba(0,0,0,0.05);
      }

      .developer-header {
        display: flex;
        justify-content: between;
        align-items: center;
        margin-bottom: 16px;
      }

      .developer-header h4 {
        margin: 0;
        font-size: 16px;
        font-weight: 600;
        color: #1f2937;
      }

      .total-badge {
        background: #2a5da6;
        color: white;
        padding: 4px 8px;
        border-radius: 12px;
        font-size: 12px;
        font-weight: 600;
      }

      .developer-stats-detailed {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
        margin-bottom: 16px;
      }

      .stat-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px 12px;
        border-radius: 6px;
        background: #f8f9fa;
      }

      .stat-item.blocked {
        border-left: 3px solid #dc3545;
      }

      .stat-item.conflict {
        border-left: 3px solid #fd7e14;
      }

      .stat-item.safe {
        border-left: 3px solid #198754;
      }

      .stat-item.safe-commit {
        border-left: 3px solid #0d6efd;
      }

      .stat-label {
        font-size: 12px;
        font-weight: 500;
      }

      .stat-value {
        font-size: 14px;
        font-weight: 700;
      }

      .developer-stories {
        border-top: 1px solid #e5e7eb;
        padding-top: 16px;
      }

      .stories-header {
        font-size: 12px;
        font-weight: 600;
        color: #6b7280;
        margin-bottom: 8px;
      }

      .story-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 6px 0;
        font-size: 12px;
      }

      .story-id {
        font-weight: 500;
        color: #2a5da6;
      }

      .story-status {
        font-size: 10px;
        padding: 2px 6px;
        border-radius: 4px;
        font-weight: 600;
      }

      .story-item.status-ready .story-status {
        background: #d1fae5;
        color: #065f46;
      }

      .story-item.status-blocked .story-status {
        background: #fecaca;
        color: #dc2626;
      }

      .story-item.status-conflict .story-status {
        background: #fed7aa;
        color: #ea580c;
      }

      .more-stories {
        font-size: 11px;
        color: #6b7280;
        text-align: center;
        margin-top: 8px;
      }

      /* Actions list styles */
      .actions-list {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .action-item {
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        padding: 16px;
        background: white;
      }

      .action-item.priority-high {
        border-left: 4px solid #dc3545;
      }

      .action-item.priority-medium {
        border-left: 4px solid #fd7e14;
      }

      .action-item.priority-low {
        border-left: 4px solid #198754;
      }

      .action-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;
        gap: 12px;
      }

      .action-developer {
        font-weight: 600;
        color: #2a5da6;
      }

      .action-story {
        font-family: 'Courier New', monospace;
        font-size: 12px;
        color: #6b7280;
      }

      .action-priority {
        font-size: 11px;
        padding: 2px 8px;
        border-radius: 12px;
        font-weight: 600;
      }

      .action-item.priority-high .action-priority {
        background: #fecaca;
        color: #dc2626;
      }

      .action-item.priority-medium .action-priority {
        background: #fed7aa;
        color: #ea580c;
      }

      .action-item.priority-low .action-priority {
        background: #d1fae5;
        color: #065f46;
      }

      .action-text {
        font-size: 14px;
        line-height: 1.4;
      }

      .action-details {
        font-size: 12px;
        color: #6b7280;
        margin-top: 8px;
        padding: 8px;
        background: #f8f9fa;
        border-radius: 4px;
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

      /* Responsive design */
      @media (max-width: 1200px) {
        .technical-stats {
          grid-template-columns: repeat(3, 1fr);
        }
        
        .tech-stat.total {
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
          max-width: 100%;
        }

        .report-type-grid {
          grid-template-columns: 1fr;
        }

        .technical-stats {
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
        }

        .tech-stat.total {
          grid-column: span 2;
        }

        .tech-stat {
          padding: 16px 12px;
          min-height: 80px;
        }

        .tech-value {
          font-size: 24px;
        }

        .tech-stat.total .tech-value {
          font-size: 28px;
        }

        .table-container {
          margin: 0 -16px;
          border-radius: 0;
          border-left: none;
          border-right: none;
        }

        .assignments-grid.detailed {
          grid-template-columns: 1fr;
        }

        .action-header {
          flex-direction: column;
          align-items: flex-start;
          gap: 8px;
        }
      }

      @media (max-width: 480px) {
        .technical-stats {
          grid-template-columns: 1fr;
        }

        .tech-stat.total {
          grid-column: span 1;
        }

        .tech-value {
          font-size: 20px;
        }

        .tech-stat.total .tech-value {
          font-size: 24px;
        }
      }
    `;

    document.head.appendChild(Object.assign(document.createElement('style'), { textContent: css }));
  };
})();