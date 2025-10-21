// ui/src/ui/utils/export-html.js
export function exportToHTML(reportData) {
  const htmlContent = generateHTMLReport(reportData);
  const blob = new Blob([htmlContent], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `deployment-report-${new Date().toISOString().split('T')[0]}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function generateHTMLReport(reportData) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${reportData.title}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
            line-height: 1.6;
            color: #1d1d1f;
            max-width: 1000px;
            margin: 0 auto;
            padding: 20px;
            background: #f5f5f7;
        }
        .report-container {
            background: white;
            border-radius: 12px;
            padding: 40px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        .report-header {
            text-align: center;
            margin-bottom: 40px;
            padding-bottom: 20px;
            border-bottom: 3px solid #0071e3;
        }
        .report-header h1 {
            color: #1d1d1f;
            margin: 0 0 10px;
            font-size: 32px;
        }
        .report-meta {
            display: flex;
            justify-content: center;
            gap: 20px;
            color: #86868b;
            font-size: 14px;
        }
        .section {
            margin-bottom: 40px;
        }
        .section h2 {
            color: #1d1d1f;
            border-bottom: 2px solid #e5e5e7;
            padding-bottom: 10px;
            margin-bottom: 20px;
            font-size: 24px;
        }
        .summary-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .summary-card {
            text-align: center;
            padding: 20px;
            border-radius: 10px;
            background: #f8f9fa;
            border: 2px solid #e5e5e7;
        }
        .summary-card.ready { border-color: #34C759; background: #d1f4e0; }
        .summary-card.conflicts { border-color: #FF9500; background: #ffd4a3; }
        .summary-card.blocked { border-color: #FF3B30; background: #ffcccb; }
        .summary-value {
            font-size: 36px;
            font-weight: bold;
            margin-bottom: 5px;
        }
        .summary-label {
            color: #86868b;
            margin-bottom: 5px;
        }
        .summary-percent {
            font-weight: 600;
            color: #1d1d1f;
        }
        .actions-list, .recommendations-list {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 10px;
        }
        .action-item, .recommendation-item {
            margin-bottom: 10px;
            padding: 10px;
            border-left: 4px solid #FF3B30;
            background: white;
        }
        .recommendation-item {
            border-left-color: #0071e3;
            background: #e8f0ff;
        }
        .assignments-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
        }
        .developer-card {
            padding: 15px;
            border: 1px solid #e5e5e7;
            border-radius: 8px;
            background: white;
        }
        .developer-stats {
            display: flex;
            gap: 10px;
            margin: 10px 0;
            flex-wrap: wrap;
        }
        .stat {
            padding: 5px 10px;
            border-radius: 5px;
            font-size: 12px;
            font-weight: bold;
        }
        .stat.ready { background: #d1f4e0; color: #1d8a4a; }
        .stat.conflicts { background: #ffd4a3; color: #cc7000; }
        .stat.blocked { background: #ffcccb; color: #d70015; }
        @media print {
            body { background: white; }
            .report-container { box-shadow: none; }
        }
    </style>
</head>
<body>
    <div class="report-container">
        <header class="report-header">
            <h1>${reportData.title}</h1>
            <div class="report-meta">
                <span>Generated: ${reportData.generatedAt}</span>
                <span>Type: ${reportData.type}</span>
            </div>
        </header>

        <section class="section">
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

        <section class="section">
            <h2>🔴 Critical Actions</h2>
            <div class="actions-list">
                ${reportData.criticalActions.map((action, index) => `
                    <div class="action-item">
                        <strong>${index + 1}.</strong> ${action}
                    </div>
                `).join('')}
            </div>
        </section>

        <section class="section">
            <h2>👥 Team Assignments</h2>
            <div class="assignments-grid">
                ${reportData.teamAssignments.map(dev => `
                    <div class="developer-card">
                        <h3>${dev.name}</h3>
                        <div class="developer-stats">
                            <span class="stat ready">${dev.ready} ready</span>
                            <span class="stat conflicts">${dev.conflicts} conflicts</span>
                            <span class="stat blocked">${dev.blocked} blocked</span>
                        </div>
                        ${dev.actions.length > 0 ? `
                            <div>
                                <strong>Actions:</strong>
                                ${dev.actions.map(action => `<div>• ${action}</div>`).join('')}
                            </div>
                        ` : ''}
                    </div>
                `).join('')}
            </div>
        </section>

        <section class="section">
            <h2>💡 Recommendations</h2>
            <div class="recommendations-list">
                ${reportData.recommendations.map((rec, index) => `
                    <div class="recommendation-item">
                        <strong>${index + 1}.</strong> ${rec}
                    </div>
                `).join('')}
            </div>
        </section>
    </div>
</body>
</html>`;
}