// ui/src/ui/components/report-generator.js
export function generateDeploymentReport(analysis, options = {}) {
  const summary = analysis.summary || {};
  const allStories = analysis.all_stories || [];
  const conflictStories = analysis.component_conflicts || [];
  const blockedStories = analysis.blocked_stories || [];
  
  // Calculate totals
  const totalStories = allStories.length + conflictStories.length + blockedStories.length;
  const readyStories = allStories.length;
  const conflictStoryCount = conflictStories.length;
  const blockedStoryCount = blockedStories.length;
  
  // Calculate percentages
  const readyPercent = totalStories > 0 ? Math.round((readyStories / totalStories) * 100) : 0;
  const conflictPercent = totalStories > 0 ? Math.round((conflictStoryCount / totalStories) * 100) : 0;
  const blockedPercent = totalStories > 0 ? Math.round((blockedStoryCount / totalStories) * 100) : 0;
  
  // Generate critical actions
  const criticalActions = generateCriticalActions(analysis);
  
  // Generate team assignments
  const teamAssignments = generateTeamAssignments(analysis);
  
  // Generate timeline data
  const timeline = generateTimelineData(analysis);
  
  // Generate recommendations
  const recommendations = generateRecommendations(analysis, criticalActions);
  
  return {
    title: getReportTitle(options.reportType),
    type: options.reportType,
    generatedAt: new Date().toLocaleString(),
    summary: {
      totalStories,
      readyStories,
      conflictStories: conflictStoryCount,
      blockedStories: blockedStoryCount,
      readyPercent,
      conflictPercent,
      blockedPercent,
      componentConflicts: summary.components_with_conflicts || 0
    },
    criticalActions,
    teamAssignments,
    timeline,
    recommendations
  };
}

function getReportTitle(reportType) {
  const titles = {
    executive: 'Deployment Readiness Report - Executive Summary',
    developer: 'Developer Assignment Report - Team Focus',
    technical: 'Technical Analysis Report - Component Health'
  };
  return titles[reportType] || titles.executive;
}

function generateCriticalActions(analysis) {
  const actions = [];
  const conflictStories = analysis.component_conflicts || [];
  const blockedStories = analysis.blocked_stories || [];
  
  // Count conflicts by developer
  const developerConflicts = {};
  conflictStories.forEach(conflict => {
    const dev = conflict.developer;
    developerConflicts[dev] = (developerConflicts[dev] || 0) + 1;
  });
  
  // Generate actions based on data
  if (conflictStories.length > 0) {
    const topDeveloper = Object.entries(developerConflicts)
      .sort(([,a], [,b]) => b - a)[0];
    
    if (topDeveloper) {
      actions.push(`Contact ${topDeveloper[0]} to resolve ${topDeveloper[1]} component conflicts`);
    }
    
    actions.push(`Coordinate team on ${conflictStories.length} conflicting stories`);
  }
  
  if (blockedStories.length > 0) {
    actions.push(`Resolve production dependencies blocking ${blockedStories.length} stories`);
  }
  
  if (analysis.all_stories && analysis.all_stories.length > 0) {
    actions.push(`Deploy ${analysis.all_stories.length} ready stories immediately`);
  }
  
  // Add component-level actions if data available
  const totalComponents = analysis.summary?.components_with_conflicts || 0;
  if (totalComponents > 0) {
    actions.push(`Address ${totalComponents} total component conflicts across all stories`);
  }
  
  return actions.slice(0, 5); // Return top 5 actions
}

function generateTeamAssignments(analysis) {
  const developers = {};
  
  // Process safe stories
  (analysis.all_stories || []).forEach(story => {
    const dev = story.developer || 'Unknown';
    if (!developers[dev]) {
      developers[dev] = { ready: 0, conflicts: 0, blocked: 0, actions: [] };
    }
    developers[dev].ready++;
  });
  
  // Process conflict stories
  (analysis.component_conflicts || []).forEach(conflict => {
    const dev = conflict.developer || 'Unknown';
    if (!developers[dev]) {
      developers[dev] = { ready: 0, conflicts: 0, blocked: 0, actions: [] };
    }
    developers[dev].conflicts++;
    
    // Add specific actions for conflict stories
    if (conflict.components && conflict.components[0]) {
      const component = conflict.components[0];
      developers[dev].actions.push(
        `Resolve ${component.type} conflict in ${component.api_name}`
      );
    }
  });
  
  // Process blocked stories
  (analysis.blocked_stories || []).forEach(blocked => {
    const dev = blocked.developer || 'Unknown';
    if (!developers[dev]) {
      developers[dev] = { ready: 0, conflicts: 0, blocked: 0, actions: [] };
    }
    developers[dev].blocked++;
    
    // Add specific actions for blocked stories
    developers[dev].actions.push(
      `Update ${blocked.component_count || 0} components with production changes`
    );
  });
  
  // Convert to array and add general actions
  return Object.entries(developers).map(([name, data]) => ({
    name,
    ...data,
    actions: data.actions.slice(0, 3) // Limit to 3 specific actions
  }));
}

function generateTimelineData(analysis) {
  const allDates = [];
  
  // Collect dates from all stories
  [...(analysis.all_stories || []), ...(analysis.component_conflicts || []), ...(analysis.blocked_stories || [])]
    .forEach(story => {
      if (story.components) {
        story.components.forEach(comp => {
          if (comp.story_commit_date) allDates.push(new Date(comp.story_commit_date));
          if (comp.production_commit_date) allDates.push(new Date(comp.production_commit_date));
        });
      }
    });
  
  if (allDates.length === 0) {
    return {
      earliestDate: 'No data',
      latestDate: 'No data',
      periodDays: 0
    };
  }
  
  const sortedDates = allDates.sort((a, b) => a - b);
  const earliest = sortedDates[0];
  const latest = sortedDates[sortedDates.length - 1];
  const periodDays = Math.round((latest - earliest) / (1000 * 60 * 60 * 24));
  
  return {
    earliestDate: earliest.toLocaleDateString(),
    latestDate: latest.toLocaleDateString(),
    periodDays: periodDays > 0 ? periodDays : 1
  };
}

function generateRecommendations(analysis, criticalActions) {
  const recommendations = [];
  const summary = analysis.summary || {};
  
  if (summary.stories_safe > 0) {
    recommendations.push(`Consider deploying ${summary.stories_safe} ready stories in the next release cycle`);
  }
  
  if (summary.stories_with_conflicts > 0) {
    recommendations.push(`Schedule conflict resolution sessions for ${summary.stories_with_conflicts} stories this week`);
  }
  
  if (summary.stories_blocked > 0) {
    recommendations.push(`Prioritize production dependency updates for ${summary.stories_blocked} blocked stories`);
  }
  
  if (summary.components_with_conflicts > 0) {
    recommendations.push(`Establish component ownership for ${summary.components_with_conflicts} conflicting components`);
  }
  
  // Add timing recommendations based on data volume
  const totalWork = summary.stories_with_conflicts + summary.stories_blocked;
  if (totalWork > 10) {
    recommendations.push('Consider splitting deployment into multiple phases due to volume of changes');
  } else if (totalWork <= 3) {
    recommendations.push('All issues can likely be resolved within 1-2 days with focused effort');
  }
  
  return recommendations;
}