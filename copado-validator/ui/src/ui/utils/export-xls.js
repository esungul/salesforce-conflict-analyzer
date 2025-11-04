
// ui/src/ui/utils/export-xls.js

export function exportToXLS(reportData, analysis, reportType = 'technical') {
  try {
    // Check if XLSX is available
    if (typeof XLSX === 'undefined') {
      throw new Error('XLSX library not loaded. Please include xlsx.full.min.js in your HTML.');
    }

    // Create workbook
    const wb = XLSX.utils.book_new();

    if (reportType === 'technical') {
      createTechnicalWorkbook(wb, reportData, analysis);
    } else {
      createDeveloperWorkbook(wb, reportData, analysis);
    }

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `deployment-report-${reportType}-${timestamp}.xlsx`;
    
    // Export to file
    XLSX.writeFile(wb, filename);
    
  } catch (error) {
    console.error('XLSX export error:', error);
    throw new Error(`Failed to generate XLSX: ${error.message}`);
  }
}

function createTechnicalWorkbook(wb, reportData, analysis) {
  const blockedStories = Array.isArray(reportData.blockedStories) ? reportData.blockedStories : [];
  const conflictStories = Array.isArray(reportData.conflictStories) ? reportData.conflictStories : [];
  const safeStories = Array.isArray(reportData.safeStories) ? reportData.safeStories : [];
  const safeWithCommitStories = Array.isArray(reportData.safeWithCommitStories) ? reportData.safeWithCommitStories : [];
  const totalStories = blockedStories.length + conflictStories.length + safeStories.length + safeWithCommitStories.length;

  // Summary Sheet
  const summaryData = [
    ['Deployment Readiness Technical Report'],
    ['Generated:', reportData.generatedAt || new Date().toLocaleString()],
    ['Report Type:', 'Technical Analysis'],
    ['Analysis Time:', analysis.summary?.analyzed_at || 'N/A'],
    [''],
    ['Story Type Summary', 'Count', 'Percentage'],
    ['Total Stories', totalStories, '100%'],
    ['Blocked Stories', blockedStories.length, `${Math.round((blockedStories.length / totalStories) * 100)}%`],
    ['Conflict Stories', conflictStories.length, `${Math.round((conflictStories.length / totalStories) * 100)}%`],
    ['Safe Stories', safeStories.length, `${Math.round((safeStories.length / totalStories) * 100)}%`],
    ['Safe with Commit Stories', safeWithCommitStories.length, `${Math.round((safeWithCommitStories.length / totalStories) * 100)}%`],
    [''],
    ['Quick Stats'],
    ['Components with Conflicts', analysis.summary?.components_with_conflicts || 0],
    ['Deployment Readiness Score', `${calculateDeploymentScore(analysis)}%`],
    ['Risk Level', calculateRiskLevel(analysis)]
  ];

  const summaryWs = addSheetWithColorTheme(wb, '📊 Summary', summaryData, '2a5da6');

  // Blocked Stories Sheet
  if (blockedStories.length > 0) {
    const blockedData = [
      ['Story ID', 'Title', 'Developer', 'JIRA Key', 'Component Count', 'Blocking Components', 'Blocking Reason', 'Production User Story', 'Has Deployment Task']
    ];

    blockedStories.forEach(story => {
      blockedData.push([
        story.story_id || 'N/A',
        story.title || 'N/A',
        story.developer || 'Unknown',
        story.jira_key || 'N/A',
        story.component_count || 0,
        Array.isArray(story.blocking_components) ? story.blocking_components.join('; ') : 'No components',
        Array.isArray(story.blocking_reasons) && story.blocking_reasons.length > 0 ? story.blocking_reasons[0] : 'No reason',
        Array.isArray(story.production_blockers) && story.production_blockers.length > 0 ? story.production_blockers[0].production_story_id : 'None',
        story.has_deployment_task ? 'Yes' : 'No'
      ]);
    });

    addSheetWithColorTheme(wb, '🚫 Blocked', blockedData, 'dc3545');
  }

  const componentConflicts = Array.isArray(reportData.componentConflicts) ? reportData.componentConflicts : [];
if (componentConflicts.length > 0) {
  const compData = [
    ['Component Type', 'Component Name', 'Unique Stories', 'Developers', 'Latest Story',
     'Latest Developer', 'Latest Commit', 'Commit Hash', 'Involved Stories']
  ];
  componentConflicts.forEach(r => {
    compData.push([
      r.componentType || 'N/A',
      r.componentName || 'N/A',
      r.uniqueStories ?? 0,
      r.developers || 'N/A',
      r.latestStory || 'N/A',
      r.latestDeveloper || 'N/A',
      r.latestCommitDate || 'N/A',
      r.latestCommitHash || 'N/A',
      r.involvedStories || 'N/A'
    ]);
  });
  addSheetWithColorTheme(wb, '🧩 Components', compData, '2a5da6'); // blue header
}

  // Safe Stories Sheet
  if (safeStories.length > 0) {
    const safeData = [
      ['Story ID', 'Title', 'Developer', 'JIRA Key', 'Component Count', 'Has Commits', 'Has Deployment Task', 'Task Type', 'Timing', 'Current Status', 'Validation']
    ];

    safeStories.forEach(story => {
      safeData.push([
        story.story_id || 'N/A',
        story.title || 'N/A',
        story.developer || 'Unknown',
        story.jira_key || 'N/A',
        story.component_count || 0,
        story.has_commits ? 'Yes' : 'No',
        'Yes', // Safe stories always have deployment task
        story.task_type || 'N/A',
        story.timing || 'N/A',
        story.current_status || 'N/A',
        story.validation || 'N/A'
      ]);
    });

    addSheetWithColorTheme(wb, '✅ Safe', safeData, '198754');
  }

  // Safe with Commit Stories Sheet
  if (safeWithCommitStories.length > 0) {
    const safeCommitData = [
      ['Story ID', 'Title', 'Developer', 'JIRA Key', 'Component Count', 'Latest Commit', 'Has Deployment Task', 'Task Type', 'Timing', 'Current Status', 'Validation']
    ];

    safeWithCommitStories.forEach(story => {
      safeCommitData.push([
        story.story_id || 'N/A',
        story.title || 'N/A',
        story.developer || 'Unknown',
        story.jira_key || 'N/A',
        story.component_count || 0,
        story.commit_date || 'N/A',
        story.has_deployment_task ? 'Yes' : 'No',
        story.task_type || 'N/A',
        story.timing || 'N/A',
        story.current_status || 'N/A',
        story.validation || 'N/A'
      ]);
    });

    addSheetWithColorTheme(wb, '✅ Safe+Commit', safeCommitData, '0d6efd');
  }

  // Set tab colors for all sheets
  setTabColors(wb);
}

function createDeveloperWorkbook(wb, reportData, analysis) {
  const assignments = Array.isArray(reportData.developerAssignments) ? reportData.developerAssignments : [];
  const blockedActions = Array.isArray(reportData.blockedActions) ? reportData.blockedActions : [];
  const conflictActions = Array.isArray(reportData.conflictActions) ? reportData.conflictActions : [];
  const safeDeployments = Array.isArray(reportData.safeDeployments) ? reportData.safeDeployments : [];
  const safeWithCommitDeployments = Array.isArray(reportData.safeWithCommitDeployments) ? reportData.safeWithCommitDeployments : [];

  // Summary Sheet for Developer Report
  const summaryData = [
    ['Developer Focused Report'],
    ['Generated:', reportData.generatedAt || new Date().toLocaleString()],
    ['Report Type:', 'Developer Focused'],
    [''],
    ['Action Items Summary', 'Count'],
    ['Blocked Actions', blockedActions.length],
    ['Conflict Actions', conflictActions.length],
    ['Safe Deployment Actions', safeDeployments.length],
    ['Safe with Commit Actions', safeWithCommitDeployments.length],
    ['Total Actions', blockedActions.length + conflictActions.length + safeDeployments.length + safeWithCommitDeployments.length],
    [''],
    ['Developer Statistics'],
    ['Total Developers', assignments.length],
    ['Total Stories', assignments.reduce((sum, dev) => sum + (dev.total || 0), 0)],
    ['Average Stories per Developer', Math.round(assignments.reduce((sum, dev) => sum + (dev.total || 0), 0) / (assignments.length || 1))]
  ];

  addSheetWithColorTheme(wb, '📊 Summary', summaryData, '2a5da6');

  // Developer Assignments Sheet
  if (assignments.length > 0) {
    const assignData = [
      ['Developer', 'Blocked Stories', 'Conflict Stories', 'Safe Stories', 'Safe with Commit Stories', 'Total Stories', 'Workload Level']
    ];

    assignments.forEach(dev => {
      const total = dev.total || 0;
      let workloadLevel = 'Low';
      if (total > 8) workloadLevel = 'High';
      else if (total > 4) workloadLevel = 'Medium';

      assignData.push([
        dev.developer || 'Unknown',
        dev.blocked || 0,
        dev.conflicts || 0,
        dev.safe || 0,
        dev.safeWithCommit || 0,
        total,
        workloadLevel
      ]);
    });

    addSheetWithColorTheme(wb, '👥 Developers', assignData, '2a5da6');
  }

  // Action Items Sheet
  const actionData = [
    ['Developer', 'Story ID', 'Action Item', 'Priority', 'Type', 'Status', 'Created Date']
  ];

  // Blocked Actions
  blockedActions.forEach(action => {
    actionData.push([
      action.developer || 'Unknown',
      action.story_id || 'N/A',
      action.action || 'No action specified',
      'High',
      'Blocked Resolution',
      'Pending',
      new Date().toLocaleDateString()
    ]);
  });

  // Conflict Actions
  conflictActions.forEach(action => {
    actionData.push([
      action.developer || 'Unknown',
      action.story_id || 'N/A',
      action.action || 'No action specified',
      'Medium',
      'Conflict Resolution',
      'Pending',
      new Date().toLocaleDateString()
    ]);
  });

  // Safe with Commit Deployments
  safeWithCommitDeployments.forEach(action => {
    actionData.push([
      action.developer || 'Unknown',
      action.story_id || 'N/A',
      action.action || 'No action specified',
      'Low',
      'Deployment Ready',
      'Ready',
      new Date().toLocaleDateString()
    ]);
  });

  // Safe Deployments
  safeDeployments.forEach(action => {
    actionData.push([
      action.developer || 'Unknown',
      action.story_id || 'N/A',
      action.action || 'No action specified',
      'Medium',
      'Needs Setup',
      'Pending',
      new Date().toLocaleDateString()
    ]);
  });

  if (actionData.length > 1) {
    addSheetWithColorTheme(wb, '🎯 Actions', actionData, '6c757d');
  }

  // Set tab colors for all sheets
  setTabColors(wb);
}

function addSheetWithColorTheme(wb, sheetName, data, headerColor) {
  const ws = XLSX.utils.aoa_to_sheet(data);
  
  // Define color scheme matching PDF/UI
  const colorMap = {
    '2a5da6': '2A5DA6', // Blue - Summary/Headers
    'dc3545': 'DC3545', // Red - Blocked
    'fd7e14': 'FD7E14', // Orange - Conflict
    '198754': '198754', // Green - Safe
    '0d6efd': '0D6EFD', // Blue - Safe with Commit
    '6c757d': '6C757D'  // Gray - Actions
  };

  const hexColor = colorMap[headerColor] || '2A5DA6';

  // Set column widths based on content
  if (!ws['!cols']) ws['!cols'] = [];
  
  data[0].forEach((_, colIndex) => {
    const maxLength = data.reduce((max, row) => {
      const cellValue = row[colIndex] ? row[colIndex].toString() : '';
      return Math.max(max, cellValue.length);
    }, 0);
    
    ws['!cols'][colIndex] = { 
      width: Math.min(Math.max(maxLength + 2, 12), 50) 
    };
  });

  // Apply styling to header row (row 0)
  if (data.length > 0) {
    const headerRange = XLSX.utils.decode_range(ws['!ref']);
    
    for (let col = headerRange.s.c; col <= headerRange.e.c; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
      if (!ws[cellAddress]) continue;
      
      // Initialize style object if it doesn't exist
      if (!ws[cellAddress].s) {
        ws[cellAddress].s = {};
      }
      
      // Set header cell styling
      ws[cellAddress].s = {
        fill: {
          patternType: 'solid',
          fgColor: { rgb: hexColor }
        },
        font: {
          color: { rgb: 'FFFFFF' },
          bold: true,
          sz: 12,
          name: 'Arial'
        },
        alignment: {
          horizontal: 'center',
          vertical: 'center',
          wrapText: true
        },
        border: {
          top: { style: 'thin', color: { rgb: '000000' } },
          left: { style: 'thin', color: { rgb: '000000' } },
          bottom: { style: 'thin', color: { rgb: '000000' } },
          right: { style: 'thin', color: { rgb: '000000' } }
        }
      };
    }

    // Apply alternating row colors for data rows
    for (let row = 1; row < data.length; row++) {
      for (let col = headerRange.s.c; col <= headerRange.e.c; col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
        if (!ws[cellAddress]) continue;
        
        if (!ws[cellAddress].s) {
          ws[cellAddress].s = {};
        }
        
        const isEvenRow = row % 2 === 0;
        ws[cellAddress].s = {
          fill: {
            patternType: 'solid',
            fgColor: { rgb: isEvenRow ? 'F8F9FA' : 'FFFFFF' }
          },
          font: {
            color: { rgb: '000000' },
            sz: 10,
            name: 'Arial'
          },
          alignment: {
            horizontal: 'left',
            vertical: 'center',
            wrapText: true
          },
          border: {
            top: { style: 'thin', color: { rgb: 'DDDDDD' } },
            left: { style: 'thin', color: { rgb: 'DDDDDD' } },
            bottom: { style: 'thin', color: { rgb: 'DDDDDD' } },
            right: { style: 'thin', color: { rgb: 'DDDDDD' } }
          }
        };

        // Add special formatting for numeric columns and status columns
        const cellValue = data[row][col];
        if (typeof cellValue === 'number') {
          ws[cellAddress].s.alignment = { horizontal: 'center', vertical: 'center' };
        }
        
        // Color code priority and status columns
        if (typeof cellValue === 'string') {
          if (cellValue === 'High') {
            ws[cellAddress].s.font = { ...ws[cellAddress].s.font, color: { rgb: 'DC3545' }, bold: true };
          } else if (cellValue === 'Medium') {
            ws[cellAddress].s.font = { ...ws[cellAddress].s.font, color: { rgb: 'FD7E14' }, bold: true };
          } else if (cellValue === 'Low' || cellValue === 'Ready') {
            ws[cellAddress].s.font = { ...ws[cellAddress].s.font, color: { rgb: '198754' }, bold: true };
          } else if (cellValue === 'Pending') {
            ws[cellAddress].s.font = { ...ws[cellAddress].s.font, color: { rgb: '6C757D' } };
          }
        }
      }
    }
  }

  // Freeze header row
  ws['!freeze'] = { x: 0, y: 1 };

  // Store the tab color in the worksheet for later use
  ws.tabColor = hexColor;

  wb.SheetNames.push(sheetName);
  wb.Sheets[sheetName] = ws;

  return ws;
}

function setTabColors(wb) {
  // This function sets the tab colors for each sheet
  // Note: Tab coloring is a feature that might require specific XLSX write options
  // We'll add the tabColor property to each worksheet
  
  wb.SheetNames.forEach(sheetName => {
    const ws = wb.Sheets[sheetName];
    if (ws.tabColor) {
      // Store tab color in the worksheet properties
      if (!ws['!worksheet']) {
        ws['!worksheet'] = {};
      }
      // This is a custom property that some XLSX writers might use
      ws['!tabColor'] = ws.tabColor;
    }
  });
}

// Enhanced function with proper tab coloring support
function addSheetWithTabColor(wb, sheetName, data, tabColor) {
  const ws = addSheetWithColorTheme(wb, sheetName, data, tabColor);
  
  // Set tab color using the proper method for SheetJS
  if (!wb.Workbook) wb.Workbook = {};
  if (!wb.Workbook.Sheets) wb.Workbook.Sheets = [];
  
  // Find the sheet index
  const sheetIndex = wb.SheetNames.indexOf(sheetName);
  if (sheetIndex !== -1) {
    if (!wb.Workbook.Sheets[sheetIndex]) {
      wb.Workbook.Sheets[sheetIndex] = {};
    }
    wb.Workbook.Sheets[sheetIndex].TabColor = {
      rgb: tabColor
    };
  }
  
  return ws;
}

// Update the helper functions to use the enhanced version
function createTechnicalWorkbookWithTabColors(wb, reportData, analysis) {
  // This is the enhanced version with proper tab coloring
  // Replace the addSheetWithColorTheme calls with addSheetWithTabColor
  
  // ... [Same implementation as createTechnicalWorkbook but using addSheetWithTabColor]
}

// Helper functions for calculations (same as in report-generator)
function calculateDeploymentScore(analysis) {
  const summary = analysis.summary || {};
  const blockedStories = summary.stories_blocked || 0;
  const conflictStories = summary.stories_with_conflicts || 0;
  const safeStories = summary.stories_safe || 0;
  const totalStories = blockedStories + conflictStories + safeStories;
  
  if (totalStories === 0) return 100;
  
  const baseScore = (safeStories / totalStories) * 100;
  const conflictPenalty = conflictStories * 3;
  const blockedPenalty = blockedStories * 10;
  
  return Math.max(0, Math.round(baseScore - conflictPenalty - blockedPenalty));
}

function calculateRiskLevel(analysis) {
  const summary = analysis.summary || {};
  const blockedStories = summary.stories_blocked || 0;
  const conflictStories = summary.stories_with_conflicts || 0;
  const safeStories = summary.stories_safe || 0;
  const totalStories = blockedStories + conflictStories + safeStories;
  
  if (totalStories === 0) return 'Unknown';
  
  const riskRatio = (blockedStories + conflictStories) / totalStories;
  
  if (riskRatio > 0.4) return 'High';
  if (riskRatio > 0.2) return 'Medium';
  return 'Low';
}