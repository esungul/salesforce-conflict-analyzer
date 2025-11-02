// ui/src/ui/utils/export-pdf-simple.js

export function exportToPDF(reportData, analysis, reportType = 'technical') {
  try {
    // Create a simple HTML-based PDF export
    const printWindow = window.open('', '_blank');
    const timestamp = new Date().toISOString().split('T')[0];
    
    let content = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${reportData.title || 'Deployment Report'}</title>
        <style>
          body { 
            font-family: 'Segoe UI', Arial, sans-serif; 
            margin: 0; 
            padding: 30px; 
            color: #333; 
            background: #fff;
            line-height: 1.4;
          }
          .header { 
            text-align: center; 
            border-bottom: 3px solid #2a5da6; 
            padding-bottom: 25px; 
            margin-bottom: 30px; 
          }
          .header h1 { 
            color: #2a5da6; 
            margin: 0 0 10px; 
            font-size: 32px;
            font-weight: 700;
          }
          .meta { 
            display: flex; 
            justify-content: center; 
            gap: 30px; 
            margin-top: 15px; 
            font-size: 14px; 
            color: #666; 
            flex-wrap: wrap;
          }
          .section { 
            margin-bottom: 35px; 
            page-break-inside: avoid;
          }
          .section h2 { 
            color: #2a5da6; 
            border-bottom: 2px solid #e5e7eb; 
            padding-bottom: 8px; 
            margin-bottom: 20px;
            font-size: 20px;
            font-weight: 600;
          }
          .stats-grid { 
            display: grid;
            grid-template-columns: repeat(5, 1fr);
            gap: 15px; 
            margin: 25px 0; 
          }
          .stat-card { 
            border: 2px solid #e5e7eb; 
            padding: 25px 15px; 
            text-align: center; 
            border-radius: 12px; 
            background: #f8fafc;
            min-height: 90px;
            display: flex;
            flex-direction: column;
            justify-content: center;
          }
          .stat-value { 
            font-size: 28px; 
            font-weight: 800; 
            margin: 8px 0; 
            line-height: 1;
          }
          .stat-label { 
            font-size: 14px; 
            color: #666; 
            font-weight: 500;
          }
          .total-stat { 
            background: linear-gradient(135deg, #2a5da6 0%, #1e3a8a 100%); 
            color: white; 
            border: none;
          }
          .total-stat .stat-value, 
          .total-stat .stat-label { 
            color: white; 
          }
          .blocked-stat { 
            border-left: 4px solid #dc3545; 
            background: #fef2f2;
          }
          .blocked-stat .stat-value { color: #dc3545; }
          .conflict-stat { 
            border-left: 4px solid #fd7e14; 
            background: #fff7ed;
          }
          .conflict-stat .stat-value { color: #fd7e14; }
          .safe-stat { 
            border-left: 4px solid #198754; 
            background: #f0f9ff;
          }
          .safe-stat .stat-value { color: #198754; }
          .safe-commit-stat { 
            border-left: 4px solid #0d6efd; 
            background: #eff6ff;
          }
          .safe-commit-stat .stat-value { color: #0d6efd; }
          .table { 
            width: 100%; 
            border-collapse: collapse; 
            margin: 20px 0; 
            font-size: 12px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.05);
          }
          .table th { 
            background-color: #f8fafc; 
            border: 1px solid #e5e7eb; 
            padding: 12px 10px; 
            text-align: left; 
            font-weight: 600;
            font-size: 12px;
          }
          .table td { 
            border: 1px solid #e5e7eb; 
            padding: 10px; 
            vertical-align: top;
            font-size: 11px;
          }
          .table tr:nth-child(even) { 
            background-color: #f9f9f9; 
          }
          .table tr:hover { 
            background-color: #f0f7ff; 
          }
          .no-data { 
            text-align: center; 
            color: #666; 
            font-style: italic; 
            padding: 40px; 
            background: #f8f9fa;
            border-radius: 8px;
          }
          .component-cell {
            background: #f8f9fa;
            padding: 4px 6px;
            border-radius: 4px;
            border: 1px solid #e9ecef;
            font-size: 10px;
            line-height: 1.3;
          }
          .reason-cell {
            background: #fff3cd;
            padding: 4px 6px;
            border-radius: 4px;
            border: 1px solid #ffeaa7;
            font-size: 10px;
            color: #856404;
            line-height: 1.3;
          }
          .status-cell {
            background: #e7f3ff;
            padding: 4px 6px;
            border-radius: 4px;
            font-size: 10px;
            text-align: center;
          }
          .center-cell {
            text-align: center;
            font-weight: 600;
          }
          .deployment-task-yes {
            color: #198754;
            font-weight: 600;
            text-align: center;
          }
          .deployment-task-no {
            color: #dc3545;
            font-weight: 600;
            text-align: center;
          }
          @media print {
            body { margin: 0; padding: 15px; }
            .no-print { display: none; }
            .section { page-break-inside: avoid; }
            .stats-grid { grid-template-columns: repeat(5, 1fr); }
            .table { font-size: 10px; }
            .table th, .table td { padding: 8px 6px; }
          }
          @media (max-width: 1000px) {
            .stats-grid { grid-template-columns: repeat(3, 1fr); }
            .total-stat { grid-column: span 3; }
          }
          @media (max-width: 600px) {
            .stats-grid { grid-template-columns: repeat(2, 1fr); }
            .total-stat { grid-column: span 2; }
            .meta { flex-direction: column; gap: 5px; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${reportData.title || 'Deployment Report'}</h1>
          <div class="meta">
            <span>Generated: ${reportData.generatedAt || new Date().toLocaleString()}</span>
            <span>Type: Technical Analysis</span>
            <span>Analysis Time: ${analysis.summary?.analyzed_at || 'N/A'}</span>
          </div>
        </div>
    `;

    if (reportType === 'technical') {
      content += generateTechnicalPDFContent(reportData, analysis);
    } else {
      content += generateDeveloperPDFContent(reportData, analysis);
    }

    content += `
        <div class="no-print" style="margin-top: 40px; text-align: center; padding: 20px; background: #f8f9fa; border-radius: 8px;">
          <button onclick="window.print()" style="padding: 12px 24px; background: #2a5da6; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 600;">
            Print as PDF
          </button>
          <p style="margin-top: 12px; color: #666; font-size: 13px;">
            Use your browser's print dialog and select "Save as PDF" to export this report.
          </p>
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(content);
    printWindow.document.close();
    
    // Auto-print after a short delay
    setTimeout(() => {
      printWindow.print();
    }, 500);

  } catch (error) {
    console.error('PDF export error:', error);
    throw new Error(`Failed to generate PDF: ${error.message}`);
  }
}

function generateTechnicalPDFContent(reportData, analysis) {
  const blockedStories = Array.isArray(reportData.blockedStories) ? reportData.blockedStories : [];
  const conflictStories = Array.isArray(reportData.conflictStories) ? reportData.conflictStories : [];
  const safeStories = Array.isArray(reportData.safeStories) ? reportData.safeStories : [];
  const safeWithCommitStories = Array.isArray(reportData.safeWithCommitStories) ? reportData.safeWithCommitStories : [];

  const totalStories = blockedStories.length + conflictStories.length + 
                      safeStories.length + safeWithCommitStories.length;

  let content = `
      <div class="section">
        <h2>Technical Analysis - All Story Types</h2>
        <div class="stats-grid">
          <div class="stat-card total-stat">
            <div class="stat-value">${totalStories}</div>
            <div class="stat-label">Total Stories</div>
          </div>
          <div class="stat-card blocked-stat">
            <div class="stat-value">${blockedStories.length}</div>
            <div class="stat-label">Blocked Stories</div>
          </div>
          <div class="stat-card conflict-stat">
            <div class="stat-value">${conflictStories.length}</div>
            <div class="stat-label">Conflict Stories</div>
          </div>
          <div class="stat-card safe-stat">
            <div class="stat-value">${safeStories.length}</div>
            <div class="stat-label">Safe Stories</div>
          </div>
          <div class="stat-card safe-commit-stat">
            <div class="stat-value">${safeWithCommitStories.length}</div>
            <div class="stat-label">Safe with Commit</div>
          </div>
        </div>
      </div>
  `;

  // Blocked Stories Table with Deployment Task Column
  if (blockedStories.length > 0) {
    content += `
      <div class="section">
        <h2>Blocked Stories Report (${blockedStories.length})</h2>
        <table class="table">
          <thead>
            <tr>
              <th>Story ID</th>
              <th>Developer</th>
              <th>Blocking Components</th>
              <th>Blocking Reason</th>
              <th>Production User Story</th>
              <th>Deployment Task</th>
            </tr>
          </thead>
          <tbody>
            ${blockedStories.map(story => `
              <tr>
                <td><strong>${escapeHtml(story.story_id || 'N/A')}</strong></td>
                <td>${escapeHtml(story.developer || 'Unknown')}</td>
                <td class="component-cell">${escapeHtml(Array.isArray(story.blocking_components) ? 
                  (story.blocking_components.length > 5 ? 
                    story.blocking_components.slice(0, 5).join(', ') + '...' : 
                    story.blocking_components.join(', ')) 
                  : 'No components')}</td>
                <td class="reason-cell">${escapeHtml(Array.isArray(story.blocking_reasons) && story.blocking_reasons.length > 0 ? 
                  (story.blocking_reasons[0].length > 100 ? 
                    story.blocking_reasons[0].substring(0, 100) + '...' : 
                    story.blocking_reasons[0]) 
                  : 'No reason specified')}</td>
                <td>${escapeHtml(Array.isArray(story.production_blockers) && story.production_blockers.length > 0 ? 
                  story.production_blockers[0].production_story_id : 'None')}</td>
                <td class="${story.has_deployment_task ? 'deployment-task-yes' : 'deployment-task-no'}">
                  ${story.has_deployment_task ? 'Yes' : 'No'}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  } else {
    content += `<div class="section"><p class="no-data">No blocked stories found.</p></div>`;
  }

  // Conflict Stories Table with Deployment Task Column
  if (conflictStories.length > 0) {
    content += `
      <div class="section">
        <h2>Conflict Stories Report (${conflictStories.length})</h2>
        <table class="table">
          <thead>
            <tr>
              <th>Story ID</th>
              <th>Developer</th>
              <th>Conflict Components</th>
              <th>Resolution Status</th>
              <th>Conflicting With</th>
              <th>Deployment Task</th>
            </tr>
          </thead>
          <tbody>
            ${conflictStories.map(story => `
              <tr>
                <td><strong>${escapeHtml(story.story_id || 'N/A')}</strong></td>
                <td>${escapeHtml(story.developer || 'Unknown')}</td>
                <td class="component-cell">${escapeHtml(Array.isArray(story.conflict_components) ? 
                  (story.conflict_components.length > 5 ? 
                    story.conflict_components.slice(0, 5).join(', ') + '...' : 
                    story.conflict_components.join(', ')) 
                  : 'No components')}</td>
                <td class="status-cell">${escapeHtml(Array.isArray(story.resolution_status) ? 
                  story.resolution_status.join(', ') : 'N/A')}</td>
                <td>${escapeHtml(Array.isArray(story.conflicts) && story.conflicts.length > 0 ? 
                  `${story.conflicts[0].conflicting_story.id} (${story.conflicts[0].conflicting_story.developer})` : 'None')}</td>
                <td class="${story.has_deployment_task ? 'deployment-task-yes' : 'deployment-task-no'}">
                  ${story.has_deployment_task ? 'Yes' : 'No'}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  } else {
    content += `<div class="section"><p class="no-data">No conflict stories found.</p></div>`;
  }

  // Safe Stories Table (already has Deployment Task column)
  if (safeStories.length > 0) {
    content += `
      <div class="section">
        <h2>Safe Stories Report (${safeStories.length})</h2>
        <table class="table">
          <thead>
            <tr>
              <th>Story ID</th>
              <th>Developer</th>
              <th>Component Count</th>
              <th>Has Commits</th>
              <th>Deployment Task</th>
              <th>Task Type</th>
              <th>Timing</th>
            </tr>
          </thead>
          <tbody>
            ${safeStories.map(story => `
              <tr>
                <td><strong>${escapeHtml(story.story_id || 'N/A')}</strong></td>
                <td>${escapeHtml(story.developer || 'Unknown')}</td>
                <td class="center-cell">${story.component_count || 0}</td>
                <td class="center-cell">${story.has_commits ? 'Yes' : 'No'}</td>
                <td class="${story.has_deployment_task ? 'deployment-task-yes' : 'deployment-task-no'}">
                  ${story.has_deployment_task ? 'Yes' : 'No'}
                </td>
                <td class="status-cell">${escapeHtml(story.task_type || 'N/A')}</td>
                <td class="status-cell">${escapeHtml(story.timing || 'N/A')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  } else {
    content += `<div class="section"><p class="no-data">No safe stories found.</p></div>`;
  }

  // Safe with Commit Stories Table (already has Deployment Task column)
  if (safeWithCommitStories.length > 0) {
    content += `
      <div class="section">
        <h2>Safe with Commit Stories Report (${safeWithCommitStories.length})</h2>
        <table class="table">
          <thead>
            <tr>
              <th>Story ID</th>
              <th>Developer</th>
              <th>Component Count</th>
              <th>Latest Commit</th>
              <th>Deployment Task</th>
              <th>Task Type</th>
              <th>Timing</th>
            </tr>
          </thead>
          <tbody>
            ${safeWithCommitStories.map(story => `
              <tr>
                <td><strong>${escapeHtml(story.story_id || 'N/A')}</strong></td>
                <td>${escapeHtml(story.developer || 'Unknown')}</td>
                <td class="center-cell">${story.component_count || 0}</td>
                <td>${escapeHtml(story.commit_date || 'N/A')}</td>
                <td class="${story.has_deployment_task ? 'deployment-task-yes' : 'deployment-task-no'}">
                  ${story.has_deployment_task ? 'Yes' : 'No'}
                </td>
                <td class="status-cell">${escapeHtml(story.task_type || 'N/A')}</td>
                <td class="status-cell">${escapeHtml(story.timing || 'N/A')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  } else {
    content += `<div class="section"><p class="no-data">No safe with commit stories found.</p></div>`;
  }

  return content;
}

function generateDeveloperPDFContent(reportData, analysis) {
  const assignments = Array.isArray(reportData.developerAssignments) ? reportData.developerAssignments : [];
  const blockedActions = Array.isArray(reportData.blockedActions) ? reportData.blockedActions : [];
  const conflictActions = Array.isArray(reportData.conflictActions) ? reportData.conflictActions : [];
  const safeDeployments = Array.isArray(reportData.safeDeployments) ? reportData.safeDeployments : [];
  const safeWithCommitDeployments = Array.isArray(reportData.safeWithCommitDeployments) ? reportData.safeWithCommitDeployments : [];

  let content = `
    <div class="section">
      <h2>Developer Assignments - Workload Overview</h2>
  `;

  if (assignments.length > 0) {
    content += `
      <table class="table">
        <thead>
          <tr>
            <th>Developer</th>
            <th>Blocked</th>
            <th>Conflicts</th>
            <th>Safe</th>
            <th>Safe with Commit</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          ${assignments.map(dev => `
            <tr>
              <td>${escapeHtml(dev.developer || 'Unknown')}</td>
              <td class="center-cell">${dev.blocked || 0}</td>
              <td class="center-cell">${dev.conflicts || 0}</td>
              <td class="center-cell">${dev.safe || 0}</td>
              <td class="center-cell">${dev.safeWithCommit || 0}</td>
              <td class="center-cell"><strong>${dev.total || 0}</strong></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  } else {
    content += `<p class="no-data">No developer assignments found.</p>`;
  }

  content += `</div>`;

  // Blocked Actions
  if (blockedActions.length > 0) {
    content += `
      <div class="section">
        <h2>Blocked Story Actions (${blockedActions.length})</h2>
        <table class="table">
          <thead>
            <tr>
              <th>Developer</th>
              <th>Story ID</th>
              <th>Action</th>
              <th>Priority</th>
            </tr>
          </thead>
          <tbody>
            ${blockedActions.map(action => `
              <tr>
                <td>${escapeHtml(action.developer || 'Unknown')}</td>
                <td>${escapeHtml(action.story_id || 'N/A')}</td>
                <td>${escapeHtml(action.action || 'No action specified')}</td>
                <td><strong>High</strong></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  // Conflict Actions
  if (conflictActions.length > 0) {
    content += `
      <div class="section">
        <h2>Conflict Resolution Actions (${conflictActions.length})</h2>
        <table class="table">
          <thead>
            <tr>
              <th>Developer</th>
              <th>Story ID</th>
              <th>Action</th>
              <th>Priority</th>
            </tr>
          </thead>
          <tbody>
            ${conflictActions.map(action => `
              <tr>
                <td>${escapeHtml(action.developer || 'Unknown')}</td>
                <td>${escapeHtml(action.story_id || 'N/A')}</td>
                <td>${escapeHtml(action.action || 'No action specified')}</td>
                <td><strong>Medium</strong></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  // Safe with Commit Actions
  if (safeWithCommitDeployments.length > 0) {
    content += `
      <div class="section">
        <h2>Safe with Commit Deployment Actions (${safeWithCommitDeployments.length})</h2>
        <table class="table">
          <thead>
            <tr>
              <th>Developer</th>
              <th>Story ID</th>
              <th>Action</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${safeWithCommitDeployments.map(action => `
              <tr>
                <td>${escapeHtml(action.developer || 'Unknown')}</td>
                <td>${escapeHtml(action.story_id || 'N/A')}</td>
                <td>${escapeHtml(action.action || 'No action specified')}</td>
                <td><strong>Ready</strong></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  return content;
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}