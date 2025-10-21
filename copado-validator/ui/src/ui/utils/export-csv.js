// ui/src/ui/utils/export-csv.js
export function exportToCSV(reportData, analysis) {
  const csvContent = generateCSVContent(reportData, analysis);
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `deployment-report-${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function generateCSVContent(reportData, analysis) {
  const lines = [];
  
  lines.push('DEBUG - ACTUAL DATA STRUCTURE');
  lines.push('Data Source,Property,Value');

    if (analysis.all_stories && analysis.all_stories.length > 0) {
    const firstStory = analysis.all_stories[0];
    lines.push('Safe Stories Count,' + analysis.all_stories.length);
    Object.keys(firstStory).forEach(key => {
      lines.push(`Safe Story - ${key},${firstStory[key]}`);
    });
  } else {
    lines.push('Safe Stories,NO_DATA,No safe stories found');
  }
    lines.push('');
  lines.push('STORY BREAKDOWN');
  lines.push('Type,Story ID,Jira Key,Title,Developer,Components,Status,Debug Info');
  
  // Safe Stories with detailed debug
  (analysis.all_stories || []).forEach((story, index) => {
    const availableProps = Object.keys(story).join('|');
    const storyId = story.id || story.key || story.name || story.story_id || 'MISSING_ID';
    const jiraKey = story.jira_key || story.key || '';
    const title = story.title || story.name || '';
    const developer = story.developer || story.created_by || 'Unknown';
    const componentCount = story.component_count || 0;
    
    lines.push(`Ready,${storyId},${jiraKey},"${title}","${developer}",${componentCount},Safe,Props:${availableProps}`);
  });

  // Header
  lines.push('DEPLOYMENT READINESS REPORT');
  lines.push(`Generated: ${reportData.generatedAt}`);
  lines.push(`Report Type: ${reportData.type}`);
  lines.push('');
  
  // Summary Section
  lines.push('EXECUTIVE SUMMARY');
  lines.push('Category,Count,Percentage');
  lines.push(`Total Stories,${reportData.summary.totalStories},100%`);
  lines.push(`Ready to Deploy,${reportData.summary.readyStories},${reportData.summary.readyPercent}%`);
  lines.push(`With Conflicts,${reportData.summary.conflictStories},${reportData.summary.conflictPercent}%`);
  lines.push(`Blocked,${reportData.summary.blockedStories},${reportData.summary.blockedPercent}%`);
  lines.push('');
  
  // Critical Actions
  lines.push('CRITICAL ACTIONS');
  lines.push('Priority,Action');
  reportData.criticalActions.forEach((action, index) => {
    lines.push(`${index + 1},"${action}"`);
  });
  lines.push('');
  
  // Team Assignments
  lines.push('TEAM ASSIGNMENTS');
  lines.push('Developer,Ready Stories,Conflict Stories,Blocked Stories,Total Stories');
  reportData.teamAssignments.forEach(dev => {
    const total = dev.ready + dev.conflicts + dev.blocked;
    lines.push(`"${dev.name}",${dev.ready},${dev.conflicts},${dev.blocked},${total}`);
  });
  lines.push('');
  
  // Story Breakdown
  lines.push('STORY BREAKDOWN');
  lines.push('Type,Story ID,Jira Key,Title,Developer,Components,Status');
  
  // Safe Stories - FIXED: Use the same mapping as stories-enhanced.js
  (analysis.all_stories || []).forEach(story => {
    // Use the EXACT same logic as in stories-enhanced.js createStoryCard function
    const storyId = story.id || story.key || story.name || story.story_id || 'MISSING_ID';
    const jiraKey = story.jira_key || story.key || '';
    const title = story.title || story.name || '';
    const developer = story.developer || story.created_by || 'Unknown';
    const componentCount = story.component_count || 0;
    
    lines.push(`Ready,${storyId},${jiraKey},"${title}","${developer}",${componentCount},Safe`);
  });
  
  // Conflict Stories
  (analysis.component_conflicts || []).forEach(conflict => {
    const storyId = conflict.story_id || conflict.id || 'MISSING_ID';
    const jiraKey = conflict.jira_key || conflict.key || '';
    const title = conflict.title || conflict.name || '';
    const developer = conflict.developer || 'Unknown';
    const componentCount = conflict.component_count || conflict.components?.length || 0;
    
    lines.push(`Conflict,${storyId},${jiraKey},"${title}","${developer}",${componentCount},Has Conflicts`);
  });
  
  // Blocked Stories
  (analysis.blocked_stories || []).forEach(blocked => {
    const storyId = blocked.story_id || blocked.id || 'MISSING_ID';
    const jiraKey = blocked.jira_key || blocked.key || '';
    const title = blocked.title || blocked.name || '';
    const developer = blocked.developer || 'Unknown';
    const componentCount = blocked.component_count || blocked.components?.length || 0;
    
    lines.push(`Blocked,${storyId},${jiraKey},"${title}","${developer}",${componentCount},Blocked by Production`);
  });
  
  lines.push('');
  
  // Recommendations
  lines.push('RECOMMENDATIONS');
  lines.push('Priority,Recommendation');
  reportData.recommendations.forEach((rec, index) => {
    lines.push(`${index + 1},"${rec}"`);
  });
  
  return lines.join('\n');
}