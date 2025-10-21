// ui/src/ui/tabs/reports-enhanced.js
import { createFilterBar } from '../components/filterBar.js';
import { generateDeploymentReport } from '../components/report-generator.js';
import { exportToHTML } from '../utils/export-html.js';
import { exportToCSV } from '../utils/export-csv.js';

const $ = (s, r=document) => r.querySelector(s);

let REPORTS_STATE = {
  reportType: localStorage.getItem('ui.reports.type') || 'executive',
  includeDetails: localStorage.getItem('ui.reports.details') === 'true',
  includeTimeline: localStorage.getItem('ui.reports.timeline') === 'true'
};

export function renderReportsTab(analysis = {}) {
  const panel = $('#tab-reports');
  if (!panel) return;

  panel.innerHTML = '';

  // Header
  const header = createElement('div', { className: 'section-header' }, [
    createElement('h2', {}, 'Deployment Reports'),
    createElement('p', { className: 'muted' }, 'Generate comprehensive deployment readiness reports')
  ]);
  panel.append(header);

  // Report Type Selection
  const typeSection = createElement('div', { className: 'report-type-section' });
  typeSection.innerHTML = `
    <h3>📋 Report Type</h3>
    <div class="report-type-grid">
      <div class="report-type-card ${REPORTS_STATE.reportType === 'executive' ? 'selected' : ''}" data-type="executive">
        <div class="type-icon">📈</div>
        <div class="type-info">
          <h4>Executive Summary</h4>
          <p>High-level overview for managers</p>
        </div>
      </div>
      <div class="report-type-card ${REPORTS_STATE.reportType === 'developer' ? 'selected' : ''}" data-type="developer">
        <div class="type-icon">👤</div>
        <div class="type-info">
          <h4>Developer Focused</h4>
          <p>Individual assignments & actions</p>
        </div>
      </div>
      <div class="report-type-card ${REPORTS_STATE.reportType === 'technical' ? 'selected' : ''}" data-type="technical">
        <div class="type-icon">🔧</div>
        <div class="type-info">
          <h4>Technical Deep Dive</h4>
          <p>Component-level analysis</p>
        </div>
      </div>
    </div>
  `;
  panel.append(typeSection);

  // Report Options
  const optionsSection = createElement('div', { className: 'report-options-section' });
  optionsSection.innerHTML = `
    <h3>⚙️ Report Options</h3>
    <div class="options-grid">
      <label class="option-checkbox">
        <input type="checkbox" ${REPORTS_STATE.includeDetails ? 'checked' : ''} id="include-details">
        <span class="checkmark"></span>
        Include component details
      </label>
      <label class="option-checkbox">
        <input type="checkbox" ${REPORTS_STATE.includeTimeline ? 'checked' : ''} id="include-timeline">
        <span class="checkmark"></span>
        Include timeline data
      </label>
      <label class="option-checkbox">
        <input type="checkbox" checked id="include-recommendations">
        <span class="checkmark"></span>
        Include recommendations
      </label>
    </div>
  `;
  panel.append(optionsSection);

  // Action Buttons
  const actionsSection = createElement('div', { className: 'report-actions-section' });
  actionsSection.innerHTML = `
    <h3>🎯 Generate Report</h3>
    <div class="actions-grid">
      <button class="btn btn-primary generate-btn" id="generate-report">
        🚀 Generate Deployment Report
      </button>
      <div class="export-buttons">
        <button class="btn btn-secondary export-btn" data-format="html" disabled>
          📄 Export as HTML
        </button>
        <button class="btn btn-secondary export-btn" data-format="csv" disabled>
          📊 Export as CSV
        </button>
        <button class="btn btn-secondary export-btn" data-format="pdf" disabled>
          📑 Export as PDF
        </button>
      </div>
    </div>
  `;
  panel.append(actionsSection);

  // Report Preview
  const previewSection = createElement('div', { className: 'report-preview-section' });
  previewSection.innerHTML = `
    <h3>📊 Report Preview</h3>
    <div class="report-preview" id="report-preview">
      <div class="preview-placeholder">
        <div class="placeholder-icon">📋</div>
        <h4>No Report Generated</h4>
        <p>Click "Generate Deployment Report" to create your first report</p>
      </div>
    </div>
  `;
  panel.append(previewSection);

  // Event Listeners
  setupEventListeners(panel, analysis);
  injectCss();
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

  // Options checkboxes
  panel.querySelector('#include-details').addEventListener('change', (e) => {
    REPORTS_STATE.includeDetails = e.target.checked;
    localStorage.setItem('ui.reports.details', REPORTS_STATE.includeDetails);
  });

  panel.querySelector('#include-timeline').addEventListener('change', (e) => {
    REPORTS_STATE.includeTimeline = e.target.checked;
    localStorage.setItem('ui.reports.timeline', REPORTS_STATE.includeTimeline);
  });

  // Generate report button
  panel.querySelector('#generate-report').addEventListener('click', () => {
    generateAndDisplayReport(analysis, panel);
  });

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
  
  // Show loading state
  generateBtn.innerHTML = '⏳ Generating Report...';
  generateBtn.disabled = true;
  preview.innerHTML = '<div class="loading-report">Generating deployment report...</div>';

  // Simulate processing time
  setTimeout(() => {
    try {
      const reportData = generateDeploymentReport(analysis, REPORTS_STATE);
      displayReportPreview(reportData, panel);
      
      // Enable export buttons
      panel.querySelectorAll('.export-btn').forEach(btn => {
        btn.disabled = false;
      });
      
    } catch (error) {
      console.error('Error generating report:', error);
      preview.innerHTML = `
        <div class="error-report">
          <div class="error-icon">❌</div>
          <h4>Error Generating Report</h4>
          <p>${error.message}</p>
          <button class="btn btn-secondary" onclick="renderReportsTab(analysis)">Try Again</button>
        </div>
      `;
    } finally {
      generateBtn.innerHTML = '🚀 Generate Deployment Report';
      generateBtn.disabled = false;
    }
  }, 1000);
}

function displayReportPreview(reportData, panel) {
  const preview = panel.querySelector('#report-preview');
  
  preview.innerHTML = `
    <div class="report-content">
      <header class="report-header">
        <h1>${reportData.title}</h1>
        <div class="report-meta">
          <span class="report-date">Generated: ${reportData.generatedAt}</span>
          <span class="report-type">Type: ${reportData.type}</span>
        </div>
      </header>
      
      <section class="executive-summary">
        <h2>📈 Executive Summary</h2>
        <div class="summary-grid">
          <div class="summary-card total">
            <div class="summary-value">${reportData.summary.totalStories}</div>
            <div class="summary-label">Total Stories</div>
          </div>
          <div class="summary-card ready">
            <div class="summary-value">${reportData.summary.readyStories}</div>
            <div class="summary-label">Ready to Deploy</div>
            <div class="summary-percent">${reportData.summary.readyPercent}%</div>
          </div>
          <div class="summary-card conflicts">
            <div class="summary-value">${reportData.summary.conflictStories}</div>
            <div class="summary-label">With Conflicts</div>
            <div class="summary-percent">${reportData.summary.conflictPercent}%</div>
          </div>
          <div class="summary-card blocked">
            <div class="summary-value">${reportData.summary.blockedStories}</div>
            <div class="summary-label">Blocked</div>
            <div class="summary-percent">${reportData.summary.blockedPercent}%</div>
          </div>
        </div>
      </section>
      
      <section class="critical-actions">
        <h2>🔴 Critical Actions</h2>
        <div class="actions-list">
          ${reportData.criticalActions.map((action, index) => `
            <div class="action-item">
              <span class="action-number">${index + 1}.</span>
              <span class="action-text">${action}</span>
            </div>
          `).join('')}
        </div>
      </section>
      
      ${REPORTS_STATE.includeDetails ? `
      <section class="team-assignments">
        <h2>👥 Team Assignments</h2>
        <div class="assignments-grid">
          ${reportData.teamAssignments.map(dev => `
            <div class="developer-card">
              <h4>${dev.name}</h4>
              <div class="developer-stats">
                <span class="stat ready">${dev.ready} ready</span>
                <span class="stat conflicts">${dev.conflicts} conflicts</span>
                <span class="stat blocked">${dev.blocked} blocked</span>
              </div>
              ${dev.actions.length > 0 ? `
                <div class="developer-actions">
                  ${dev.actions.map(action => `<div class="dev-action">• ${action}</div>`).join('')}
                </div>
              ` : ''}
            </div>
          `).join('')}
        </div>
      </section>
      ` : ''}
      
      ${REPORTS_STATE.includeTimeline ? `
      <section class="timeline-overview">
        <h2>🕐 Timeline Overview</h2>
        <div class="timeline-summary">
          <p>Earliest conflict: ${reportData.timeline.earliestDate}</p>
          <p>Latest update: ${reportData.timeline.latestDate}</p>
          <p>Active development period: ${reportData.timeline.periodDays} days</p>
        </div>
      </section>
      ` : ''}
      
      <section class="recommendations">
        <h2>💡 Recommendations</h2>
        <div class="recommendations-list">
          ${reportData.recommendations.map((rec, index) => `
            <div class="recommendation-item">
              <span class="rec-number">${index + 1}.</span>
              <span class="rec-text">${rec}</span>
            </div>
          `).join('')}
        </div>
      </section>
    </div>
  `;
}

function exportReport(format, analysis, panel) {
  const reportData = generateDeploymentReport(analysis, REPORTS_STATE);
  
  switch (format) {
    case 'html':
      exportToHTML(reportData);
      break;
    case 'csv':
      exportToCSV(reportData, analysis);
      break;
    case 'pdf':
      // PDF export would go here (would require jsPDF library)
      alert('PDF export coming soon!');
      break;
  }
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

const injectCss = (() => {
  let done = false;
  return () => {
    if (done) return;
    done = true;

    const css = `
      .report-type-section, .report-options-section, .report-actions-section, .report-preview-section {
        margin-bottom: 24px;
        padding: 16px;
        background: white;
        border-radius: 8px;
        border: 1px solid #e5e5e7;
      }

      .report-type-section h3, .report-options-section h3, .report-actions-section h3, .report-preview-section h3 {
        margin: 0 0 16px;
        font-size: 16px;
        font-weight: 600;
        color: #1d1d1f;
      }

      .report-type-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 12px;
      }

      .report-type-card {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 16px;
        border: 2px solid #e5e5e7;
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.3s ease;
      }

      .report-type-card:hover {
        border-color: #0071e3;
        background: #f8f9fa;
      }

      .report-type-card.selected {
        border-color: #0071e3;
        background: #e8f0ff;
      }

      .type-icon {
        font-size: 24px;
        flex-shrink: 0;
      }

      .type-info h4 {
        margin: 0 0 4px;
        font-size: 14px;
        font-weight: 600;
        color: #1d1d1f;
      }

      .type-info p {
        margin: 0;
        font-size: 12px;
        color: #86868b;
      }

      .options-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 12px;
      }

      .option-checkbox {
        display: flex;
        align-items: center;
        gap: 8px;
        cursor: pointer;
        font-size: 14px;
        color: #1d1d1f;
      }

      .option-checkbox input {
        margin: 0;
      }

      .actions-grid {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .generate-btn {
        padding: 12px 24px;
        font-size: 16px;
        font-weight: 600;
      }

      .export-buttons {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }

      .export-btn {
        flex: 1;
        min-width: 120px;
      }

      .export-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .report-preview {
        min-height: 400px;
        border: 1px solid #e5e5e7;
        border-radius: 8px;
        background: white;
        overflow: auto;
      }

      .preview-placeholder, .loading-report, .error-report {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 400px;
        color: #86868b;
        text-align: center;
      }

      .placeholder-icon, .error-icon {
        font-size: 48px;
        margin-bottom: 12px;
      }

      .preview-placeholder h4, .error-report h4 {
        margin: 0 0 8px;
        font-size: 16px;
        font-weight: 600;
        color: #1d1d1f;
      }

      .preview-placeholder p, .error-report p {
        margin: 0;
        font-size: 14px;
      }

      .report-content {
        padding: 24px;
      }

      .report-header {
        text-align: center;
        margin-bottom: 32px;
        padding-bottom: 16px;
        border-bottom: 2px solid #e5e5e7;
      }

      .report-header h1 {
        margin: 0 0 8px;
        font-size: 24px;
        font-weight: 700;
        color: #1d1d1f;
      }

      .report-meta {
        display: flex;
        justify-content: center;
        gap: 16px;
        font-size: 14px;
        color: #86868b;
      }

      .executive-summary, .critical-actions, .team-assignments, .timeline-overview, .recommendations {
        margin-bottom: 32px;
      }

      .executive-summary h2, .critical-actions h2, .team-assignments h2, .timeline-overview h2, .recommendations h2 {
        margin: 0 0 16px;
        font-size: 18px;
        font-weight: 600;
        color: #1d1d1f;
        border-bottom: 1px solid #e5e5e7;
        padding-bottom: 8px;
      }

      .summary-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        gap: 16px;
      }

      .summary-card {
        text-align: center;
        padding: 16px;
        border-radius: 8px;
        background: #f5f5f7;
      }

      .summary-card.ready {
        background: #d1f4e0;
        border: 1px solid #34C759;
      }

      .summary-card.conflicts {
        background: #ffd4a3;
        border: 1px solid #FF9500;
      }

      .summary-card.blocked {
        background: #ffcccb;
        border: 1px solid #FF3B30;
      }

      .summary-value {
        font-size: 32px;
        font-weight: 700;
        margin-bottom: 4px;
      }

      .summary-label {
        font-size: 14px;
        color: #86868b;
        margin-bottom: 4px;
      }

      .summary-percent {
        font-size: 12px;
        font-weight: 600;
        color: #1d1d1f;
      }

      .actions-list, .recommendations-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .action-item, .recommendation-item {
        display: flex;
        gap: 8px;
        padding: 8px 12px;
        background: #fff3f3;
        border-radius: 6px;
        border-left: 4px solid #FF3B30;
      }

      .recommendation-item {
        background: #e8f0ff;
        border-left-color: #0071e3;
      }

      .action-number, .rec-number {
        font-weight: 600;
        color: #FF3B30;
        min-width: 20px;
      }

      .rec-number {
        color: #0071e3;
      }

      .action-text, .rec-text {
        flex: 1;
        color: #1d1d1f;
      }

      .assignments-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
        gap: 16px;
      }

      .developer-card {
        padding: 16px;
        border: 1px solid #e5e5e7;
        border-radius: 8px;
        background: white;
      }

      .developer-card h4 {
        margin: 0 0 12px;
        font-size: 16px;
        font-weight: 600;
        color: #1d1d1f;
      }

      .developer-stats {
        display: flex;
        gap: 8px;
        margin-bottom: 12px;
        flex-wrap: wrap;
      }

      .developer-stats .stat {
        font-size: 12px;
        padding: 4px 8px;
        border-radius: 4px;
        font-weight: 600;
      }

      .stat.ready {
        background: #d1f4e0;
        color: #1d8a4a;
      }

      .stat.conflicts {
        background: #ffd4a3;
        color: #cc7000;
      }

      .stat.blocked {
        background: #ffcccb;
        color: #d70015;
      }

      .developer-actions {
        font-size: 12px;
        color: #1d1d1f;
      }

      .dev-action {
        margin-bottom: 4px;
        line-height: 1.4;
      }

      .timeline-summary {
        padding: 16px;
        background: #f5f5f7;
        border-radius: 8px;
        font-size: 14px;
      }

      .timeline-summary p {
        margin: 0 0 8px;
      }

      .timeline-summary p:last-child {
        margin-bottom: 0;
      }

      @media (max-width: 768px) {
        .report-type-grid {
          grid-template-columns: 1fr;
        }
        
        .options-grid {
          grid-template-columns: 1fr;
        }
        
        .export-buttons {
          flex-direction: column;
        }
        
        .summary-grid {
          grid-template-columns: repeat(2, 1fr);
        }
        
        .assignments-grid {
          grid-template-columns: 1fr;
        }
        
        .report-meta {
          flex-direction: column;
          gap: 4px;
        }
      }
    `;

    document.head.appendChild(Object.assign(document.createElement('style'), { textContent: css }));
  };
})();