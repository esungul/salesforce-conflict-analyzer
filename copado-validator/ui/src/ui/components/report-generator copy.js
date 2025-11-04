// ui/src/ui/components/report-generator.js
export function generateDeploymentReport(analysis, options = {}) {
  console.log('🔍 Analysis structure for report:', analysis);
  
  const reportType = options.reportType || 'executive';
  
  try {
    if (reportType === 'executive') {
      return generateExecutiveReport(analysis, options);
    } else if (reportType === 'technical') {
      return generateTechnicalReport(analysis, options);
    } else {
      return generateDeveloperReport(analysis, options);
    }
  } catch (error) {
    console.error('Error generating report:', error);
    // Return a fallback report structure
    return {
      title: `Deployment Report - ${reportType}`,
      type: reportType,
      generatedAt: new Date().toLocaleString(),
      summary: {
        totalStories: 0,
        blockedStories: 0,
        conflictStories: 0,
        safeStories: 0,
        deploymentScore: 0,
        riskLevel: 'Unknown'
      },
      criticalActions: ['Analysis data structure issue detected'],
      recommendations: ['Check the analysis data format and try again']
    };
  }
}

function extractBlockedStories(analysis) {
  const allStories = analysis.all_stories || [];
  const blockedStories = allStories.filter(story => 
    story.classification_tag === 'Blocked'
  );
  
  return blockedStories.map(story => {
    const blockingComponents = [];
    const blockingReasons = [];
    const productionBlockers = [];
    
    // Extract blocking reasons from components
    story.components?.forEach(component => {
      if (component.has_old_commit) {
        const componentName = component.api_name || component.id || 'Unknown Component';
        blockingComponents.push(componentName);
        
        const reason = {
          component: componentName,
          type: component.type,
          production_commit_date: component.production_commit_date,
          story_commit_date: component.story_commit_date,
          production_story_id: component.production_story_id,
          production_story_title: component.production_story_title,
          reason: `Component has old commit (Production: ${formatDate(component.production_commit_date)}, Story: ${formatDate(component.story_commit_date)})`
        };
        
        blockingReasons.push(reason.reason);
        
        if (component.production_story_id) {
          productionBlockers.push({
            production_story_id: component.production_story_id,
            production_story_title: component.production_story_title,
            production_developer: component.production_developer,
            production_commit_date: component.production_commit_date
          });
        }
      }
    });
    
    return {
      story_id: story.story_id,
      title: story.title,
      developer: story.developer,
      jira_key: story.jira_key,
      component_count: story.component_count,
      classification_tag: story.classification_tag,
      blocking_components: blockingComponents,
      blocking_reasons: blockingReasons,
      production_blockers: productionBlockers,
      has_deployment_task: story.has_deployment_task || false,
      data_sources: story.data_sources || []
    };
  });
}

function extractConflictStories(analysis) {
  const allStories = analysis.all_stories || [];
  const conflictStories = allStories.filter(story => 
    story.classification_tag === 'Conflict'
  );
  
  return conflictStories.map(story => {
    const conflicts = [];
    const conflictComponents = [];
    const resolutionStatus = new Set();
    
    story.components?.forEach(component => {
      const componentName = component.api_name || component.id || 'Unknown Component';
      conflictComponents.push(componentName);
      
      if (component.status) {
        resolutionStatus.add(component.status);
      }
      
      // Extract conflicts from conflicting_stories
      if (component.conflicting_stories && component.conflicting_stories.length > 0) {
        component.conflicting_stories.forEach(conflict => {
          conflicts.push({
            component_name: componentName,
            component_type: component.type,
            resolution_status: component.status || 'Potential Conflict',
            conflicting_story: {
              id: conflict.story_id,
              developer: conflict.developer,
              jira_key: conflict.jira_key,
              commit_date: conflict.commit_date,
              title: conflict.title
            },
            production_commit_date: component.production_commit_date,
            story_commit_date: component.story_commit_date,
            commit_hash: component.commit_hash,
            has_old_commit: component.has_old_commit
          });
        });
      } else if (component.production_story_id) {
        // Conflict with production
        conflicts.push({
          component_name: componentName,
          component_type: component.type,
          resolution_status: component.status || 'Potential Conflict',
          conflicting_story: {
            id: component.production_story_id,
            developer: 'Production',
            jira_key: 'N/A',
            commit_date: component.production_commit_date,
            title: component.production_story_title
          },
          production_commit_date: component.production_commit_date,
          story_commit_date: component.story_commit_date,
          commit_hash: component.commit_hash,
          has_old_commit: component.has_old_commit
        });
      }
    });
    
    return {
      story_id: story.story_id,
      title: story.title,
      developer: story.developer,
      jira_key: story.jira_key,
      component_count: story.component_count,
      classification_tag: story.classification_tag,
      conflict_components: conflictComponents,
      resolution_status: Array.from(resolutionStatus),
      conflicts: conflicts,
      has_deployment_task: story.has_deployment_task || false,
      data_sources: story.data_sources || []
    };
  });
}

// Update the extractSafeStories function to include deployment details
function extractSafeStories(analysis) {
  const allStories = analysis.all_stories || [];
  const safeStories = allStories.filter(story => 
    story.classification === 'safe'
  );
  
  return safeStories.map(story => {
    const commitInfo = extractCommitInfo(story);
    const copadoStatus = [];
    
    story.components?.forEach(component => {
      if (component.status) {
        copadoStatus.push(`${component.api_name || 'Component'}: ${component.status}`);
      }
    });

    // Extract deployment details - safe stories always have deployment tasks
    const deploymentDetails = story.deployment_details || {};
    
    return {
      story_id: story.story_id,
      title: story.title,
      developer: story.developer,
      jira_key: story.jira_key,
      component_count: story.component_count,
      classification_tag: story.classification_tag,
      has_commits: false, // Safe stories don't have commits
      commit_hash: 'N/A',
      commit_date: 'N/A',
      has_deployment_task: true, // Safe stories always have deployment tasks
      task_type: deploymentDetails.task_type || 'manual',
      timing: deploymentDetails.timing || 'N/A',
      current_status: deploymentDetails.current_status || 'Draft',
      validation: deploymentDetails.validation || 'Not Started',
      copado_status: copadoStatus,
      data_sources: story.data_sources || [],
      environment: story.environment || 'N/A',
      deployment_details: deploymentDetails
    };
  });
}

// Update extractSafeWithCommitStories to include deployment details
function extractSafeWithCommitStories(analysis) {
  const allStories = analysis.all_stories || [];
  const safeWithCommitStories = allStories.filter(story => 
    story.classification_tag === 'Safe with commit'
  );
  
  return safeWithCommitStories.map(story => {
    const commitInfo = extractCommitInfo(story);
    const copadoStatus = [];
    const componentDetails = [];
    
    story.components?.forEach(component => {
      if (component.status) {
        copadoStatus.push(`${component.api_name || 'Component'}: ${component.status}`);
      }
      
      componentDetails.push({
        name: component.api_name || component.id,
        type: component.type,
        status: component.status,
        story_commit_date: component.story_commit_date,
        production_commit_date: component.production_commit_date,
        commit_hash: component.commit_hash
      });
    });

    // Extract deployment details
    const deploymentDetails = story.deployment_details || {};
    
    return {
      story_id: story.story_id,
      title: story.title,
      developer: story.developer,
      jira_key: story.jira_key,
      component_count: story.component_count,
      classification_tag: story.classification_tag,
      has_commits: true,
      commit_hash: commitInfo.hash,
      commit_date: commitInfo.date,
      has_deployment_task: story.has_deployment_task || false,
      task_type: deploymentDetails.task_type || 'N/A',
      timing: deploymentDetails.timing || 'N/A',
      current_status: deploymentDetails.current_status || 'N/A',
      validation: deploymentDetails.validation || 'N/A',
      copado_status: copadoStatus,
      component_details: componentDetails,
      data_sources: story.data_sources || [],
      environment: story.environment || 'N/A',
      deployment_details: deploymentDetails
    };
  });
}



function generateExecutiveReport(analysis, options) {
  const blockedStories = extractBlockedStories(analysis);
  const conflictStories = extractConflictStories(analysis);
  const safeStories = extractSafeStories(analysis);
  const safeWithCommitStories = extractSafeWithCommitStories(analysis);
  
  const totalStories = blockedStories.length + conflictStories.length + 
                      safeStories.length + safeWithCommitStories.length;
  
  const deploymentScore = calculateDeploymentScore(analysis);
  const riskLevel = calculateRiskLevel(analysis);
  
  return {
    title: 'Deployment Readiness Report - Executive Summary',
    type: 'executive',
    generatedAt: new Date().toLocaleString(),
    summary: {
      totalStories,
      blockedStories: blockedStories.length,
      conflictStories: conflictStories.length,
      safeStories: safeStories.length,
      safeWithCommitStories: safeWithCommitStories.length,
      deploymentScore,
      riskLevel,
      componentsWithConflicts: analysis.summary?.components_with_conflicts || 0
    },
    blockedAnalysis: generateBlockedAnalysis(blockedStories),
    conflictAnalysis: generateConflictAnalysis(conflictStories),
    criticalActions: generateExecutiveActions(blockedStories, conflictStories),
    recommendations: generateExecutiveRecommendations(analysis)
  };
}

function generateTechnicalReport(analysis, options) {
  const blockedStories = extractBlockedStories(analysis);
  const conflictStories = extractConflictStories(analysis);
  const safeStories = extractSafeStories(analysis);
  const safeWithCommitStories = extractSafeWithCommitStories(analysis);
  
  return {
    title: 'Technical Analysis Report - Component Health',
    type: 'technical',
    generatedAt: new Date().toLocaleString(),
    technicalSummary: {
      totalStories: blockedStories.length + conflictStories.length + 
                   safeStories.length + safeWithCommitStories.length,
      blockedStories: blockedStories.length,
      conflictStories: conflictStories.length,
      safeStories: safeStories.length,
      safeWithCommitStories: safeWithCommitStories.length,
      conflictedComponents: analysis.summary?.components_with_conflicts || 0
    },
    blockedStories: blockedStories,
    conflictStories: conflictStories,
    safeStories: safeStories,
    safeWithCommitStories: safeWithCommitStories,
    componentAnalysis: generateComponentAnalysis(analysis),
    resolutionPriority: generateResolutionPriority(conflictStories)
  };
}

function generateDeveloperReport(analysis, options) {
  const blockedStories = extractBlockedStories(analysis);
  const conflictStories = extractConflictStories(analysis);
  const safeStories = extractSafeStories(analysis);
  const safeWithCommitStories = extractSafeWithCommitStories(analysis);
  
  return {
    title: 'Developer Assignment Report - Action Focused',
    type: 'developer',
    generatedAt: new Date().toLocaleString(),
    developerAssignments: generateDetailedAssignments(analysis),
    blockedActions: generateBlockedActions(blockedStories),
    conflictActions: generateConflictActions(conflictStories),
    safeDeployments: generateSafeDeployments(safeStories),
    safeWithCommitDeployments: generateSafeWithCommitDeployments(safeWithCommitStories)
  };
}

// Enhanced analysis functions
function generateBlockedAnalysis(blockedStories) {
  const analysis = {
    totalBlocked: blockedStories.length,
    commonReasons: {},
    productionBlockers: new Set(),
    blockingComponents: new Set(),
    byDeveloper: {}
  };
  
  blockedStories.forEach(story => {
    // Count common reasons
    story.blocking_reasons.forEach(reason => {
      analysis.commonReasons[reason] = (analysis.commonReasons[reason] || 0) + 1;
    });
    
    // Track production blockers
    story.production_blockers.forEach(blocker => {
      analysis.productionBlockers.add(blocker.production_story_id);
    });
    
    // Track blocking components
    story.blocking_components.forEach(component => {
      analysis.blockingComponents.add(component);
    });
    
    // Group by developer
    if (!analysis.byDeveloper[story.developer]) {
      analysis.byDeveloper[story.developer] = [];
    }
    analysis.byDeveloper[story.developer].push(story);
  });
  
  return analysis;
}

function generateConflictAnalysis(conflictStories) {
  const analysis = {
    totalConflicts: conflictStories.length,
    resolutionStatus: {},
    conflictComponents: new Set(),
    conflictHotspots: {},
    byDeveloper: {}
  };
  
  conflictStories.forEach(story => {
    // Count resolution status
    story.resolution_status.forEach(status => {
      analysis.resolutionStatus[status] = (analysis.resolutionStatus[status] || 0) + 1;
    });
    
    // Track conflict components
    story.conflict_components.forEach(component => {
      analysis.conflictComponents.add(component);
      analysis.conflictHotspots[component] = (analysis.conflictHotspots[component] || 0) + 1;
    });
    
    // Group by developer
    if (!analysis.byDeveloper[story.developer]) {
      analysis.byDeveloper[story.developer] = [];
    }
    analysis.byDeveloper[story.developer].push(story);
  });
  
  return analysis;
}

// New action generators for safe with commit
function generateSafeWithCommitDeployments(safeWithCommitStories) {
  const deployments = [];
  
  safeWithCommitStories.forEach(story => {
    if (story.has_deployment_task) {
      deployments.push({
        developer: story.developer,
        story_id: story.story_id,
        action: 'Ready for deployment - Has commits and deployment task',
        priority: 'Low',
        type: 'Deployment Ready',
        details: `Has ${story.component_count} components with commits`
      });
    } else {
      deployments.push({
        developer: story.developer,
        story_id: story.story_id,
        action: 'Create deployment task for committed story',
        priority: 'Medium',
        type: 'Needs Deployment Task',
        details: `Story has commits but no deployment task`
      });
    }
  });
  
  return deployments;
}

// Enhanced utility functions
function formatDate(dateString) {
  if (!dateString) return 'N/A';
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return 'Invalid Date';
  }
}

function extractCommitInfo(story) {
  // Try to extract commit info from components first
  if (story.components && story.components.length > 0) {
    const componentWithCommit = story.components.find(comp => comp.story_commit_date);
    if (componentWithCommit) {
      return {
        hash: componentWithCommit.commit_hash || 'N/A',
        date: formatDate(componentWithCommit.story_commit_date)
      };
    }
  }
  
  return {
    hash: 'N/A',
    date: 'N/A'
  };
}



//////////////LAST



// Core Data Extraction Functions - UPDATED for your data structure
function extractBlockedReasons(blockedStories) {
  if (!Array.isArray(blockedStories)) return [];
  
  return blockedStories.map(story => {
    const reasons = [];
    const productionBlockers = new Set();
    const copadoMessages = new Set();
    const blockingComponents = [];
    
    // Extract from components array
    story.components?.forEach(component => {
      const componentName = component.api_name || 'Unknown Component';
      
      // Extract Copado status messages
      if (component.status) {
        copadoMessages.add(component.status);
        reasons.push(`${component.status} - ${componentName}`);
      }
      
      // Check for has_old_commit and production details
      if (component.has_old_commit || component.production_story_id) {
        const blockerInfo = {
          component: componentName,
          production_story_id: component.production_story_id,
          production_story_title: component.production_story_title,
          production_commit_date: formatDate(component.production_commit_date),
          production_developer: component.production_developer,
          has_old_commit: component.has_old_commit
        };
        
        blockingComponents.push(componentName);
        
        if (component.production_story_id) {
          productionBlockers.add(JSON.stringify(blockerInfo));
        }
        
        reasons.push(`Component ${componentName} blocked by production story ${component.production_story_id}`);
      }
    });
    
    return {
      story_id: story.story_id || story.id,
      developer: story.developer,
      title: story.title,
      jira_key: story.jira_key,
      component_count: story.component_count,
      classification_tag: story.classification_tag,
      blocking_reasons: [...new Set(reasons)],
      production_blockers: Array.from(productionBlockers).map(b => JSON.parse(b)),
      blocking_components: blockingComponents,
      copado_messages: Array.from(copadoMessages),
      has_deployment_task: story.has_deployment_task || story.deployment_task_available || false,
      data_sources: story.data_sources || []
    };
  });
}

function extractConflictDetails(conflictStories) {
  if (!Array.isArray(conflictStories)) return [];
  
  return conflictStories.map(story => {
    const conflicts = [];
    const resolutionStatus = new Set();
    const conflictComponents = new Set();
    
    story.components?.forEach(component => {
      const componentName = component.api_name || 'Unknown Component';
      const status = component.status || "Needs Review";
      resolutionStatus.add(status);
      conflictComponents.add(componentName);
      
      // Extract conflicting stories with component details
      if (component.conflicting_stories && component.conflicting_stories.length > 0) {
        component.conflicting_stories.forEach(conflictingStory => {
          conflicts.push({
            component_name: componentName,
            resolution_status: status,
            conflicting_story: {
              id: conflictingStory.story_id,
              developer: conflictingStory.developer,
              jira_key: conflictingStory.jira_key,
              commit_date: formatDate(conflictingStory.commit_date),
              title: conflictingStory.title
            },
            production_commit: formatDate(component.production_commit_date),
            story_commit: formatDate(component.story_commit_date),
            has_old_commit: component.has_old_commit
          });
        });
      } else if (component.production_story_id) {
        // Conflicts with production
        conflicts.push({
          component_name: componentName,
          resolution_status: status,
          conflicting_story: {
            id: component.production_story_id,
            developer: 'Production',
            jira_key: 'N/A',
            commit_date: formatDate(component.production_commit_date),
            title: component.production_story_title
          },
          production_commit: formatDate(component.production_commit_date),
          story_commit: formatDate(component.story_commit_date),
          has_old_commit: component.has_old_commit
        });
      }
    });
    
    return {
      story_id: story.story_id || story.id,
      developer: story.developer,
      title: story.title,
      jira_key: story.jira_key,
      component_count: story.component_count,
      classification_tag: story.classification_tag,
      resolution_status: Array.from(resolutionStatus),
      conflict_components: Array.from(conflictComponents),
      conflicts: conflicts,
      has_deployment_task: story.has_deployment_task || story.deployment_task_available || false,
      data_sources: story.data_sources || []
    };
  });
}

function extractDeploymentReadiness(safeStories) {
  if (!Array.isArray(safeStories)) return [];
  
  return safeStories.map(story => {
    // Extract commit information from components or story
    const commitInfo = extractCommitInfo(story);
    const hasCommits = story.data_sources?.includes('commits') || false;
    
    // Extract deployment task info - check multiple possible properties
    const hasDeploymentTask = story.has_deployment_task || 
                             story.deployment_task_available || 
                             story.data_sources?.includes('deployment_tasks') ||
                             false;
    
    // Extract deployment details if available
    const deploymentStatus = story.deployment_details?.current_status || 'N/A';
    const taskType = story.deployment_details?.task_type || 'N/A';
    const timing = story.deployment_details?.timing || 'N/A';
    
    // Extract Copado status from components or classification
    const copadoStatus = [];
    story.components?.forEach(component => {
      if (component.status) {
        copadoStatus.push(`${component.api_name || 'Component'}: ${component.status}`);
      }
    });
    
    // Also use classification_tag as copado status
    if (story.classification_tag) {
      copadoStatus.push(story.classification_tag);
    }
    
    return {
      story_id: story.story_id || story.id,
      developer: story.developer,
      title: story.title,
      jira_key: story.jira_key,
      component_count: story.component_count,
      classification_tag: story.classification_tag,
      has_commits: hasCommits,
      commit_hash: commitInfo.hash,
      commit_date: commitInfo.date,
      has_deployment_task: hasDeploymentTask,
      deployment_status: deploymentStatus,
      task_type: taskType,
      deployment_timing: timing,
      copado_status: copadoStatus,
      data_sources: story.data_sources || [],
      environment: story.environment || 'N/A'
    };
  });
}

function extractDeploymentTaskDetails(deploymentTasks) {
  if (!Array.isArray(deploymentTasks)) return [];
  
  return deploymentTasks.map(task => {
    return {
      story_id: task.story_id,
      developer: task.developer,
      title: task.title,
      jira_key: task.jira_key,
      environment: task.environment || 'N/A',
      release: task.release || 'N/A',
      story_type: task.story_type || 'deployment_task',
      deployment_status: task.deployment_details?.current_status || 'Draft',
      task_type: task.deployment_details?.task_type || 'manual',
      timing: task.deployment_details?.timing || 'N/A',
      validation: task.deployment_details?.validation || 'Not Validated'
    };
  });
}



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

function calculateTotalComponents(analysis) {
  const allStories = [
    ...(analysis.all_stories || analysis.safe || []),
    ...(analysis.component_conflicts || analysis.conflicts || []),
    ...(analysis.blocked_stories || analysis.blocked || [])
  ];
  
  if (allStories.length === 0) return 0;
  
  const totalComponents = allStories.reduce((sum, story) => 
    sum + (story.component_count || 0), 0);
  
  return totalComponents;
}

function generateSafeAnalysis(safeDetails) {
  const analysis = {
    totalSafe: safeDetails.length,
    withDeploymentTasks: 0,
    withCommits: 0,
    deploymentReady: 0,
    byDeveloper: {}
  };
  
  safeDetails.forEach(story => {
    if (story.has_deployment_task) analysis.withDeploymentTasks++;
    if (story.has_commits) analysis.withCommits++;
    if (story.has_commits && story.has_deployment_task) analysis.deploymentReady++;
    
    // Group by developer
    if (!analysis.byDeveloper[story.developer]) {
      analysis.byDeveloper[story.developer] = [];
    }
    analysis.byDeveloper[story.developer].push(story);
  });
  
  return analysis;
}

// Action Generation Functions
function generateExecutiveActions(blockedDetails, conflictDetails, safeDetails) {
  const actions = [];
  
  // Blocked story actions
  if (blockedDetails.length > 0) {
    const topBlockedReasons = Object.entries(
      blockedDetails.reduce((acc, story) => {
        story.blocking_reasons.forEach(reason => {
          acc[reason] = (acc[reason] || 0) + 1;
        });
        return acc;
      }, {})
    ).sort((a, b) => b[1] - a[1])[0];
    
    if (topBlockedReasons) {
      actions.push(`Address "${topBlockedReasons[0]}" affecting ${topBlockedReasons[1]} stories`);
    }
    
    // Add specific component blocking actions
    const componentBlockers = blockedDetails.reduce((acc, story) => {
      story.blocking_components.forEach(component => {
        acc[component] = (acc[component] || 0) + 1;
      });
      return acc;
    }, {});
    
    const topComponent = Object.entries(componentBlockers).sort((a, b) => b[1] - a[1])[0];
    if (topComponent) {
      actions.push(`Focus on component "${topComponent[0]}" blocking ${topComponent[1]} stories`);
    }
    
    actions.push(`Resolve ${blockedDetails.length} blocked stories before deployment`);
  }
  
  // Conflict story actions
  if (conflictDetails.length > 0) {
    const autoResolved = conflictDetails.filter(story => 
      story.resolution_status.includes('Auto-resolved')
    ).length;
    
    const manualResolution = conflictDetails.length - autoResolved;
    
    if (manualResolution > 0) {
      actions.push(`Manually resolve ${manualResolution} conflicts requiring attention`);
    }
    
    if (autoResolved > 0) {
      actions.push(`Verify ${autoResolved} auto-resolved conflicts before deployment`);
    }
  }
  
  // Safe story actions
  if (safeDetails.length > 0) {
    const readyForDeployment = safeDetails.filter(story => 
      story.has_commits && story.has_deployment_task
    ).length;
    
    const needsDeploymentTasks = safeDetails.filter(story => 
      story.has_commits && !story.has_deployment_task
    ).length;
    
    if (readyForDeployment > 0) {
      actions.push(`Deploy ${readyForDeployment} ready stories immediately`);
    }
    
    if (needsDeploymentTasks > 0) {
      actions.push(`Create deployment tasks for ${needsDeploymentTasks} stories with commits`);
    }
  }
  
  return actions.slice(0, 5);
}

function generateBlockedActions(blockedStories) {
  const actions = [];
  const blockedDetails = extractBlockedReasons(blockedStories);
  
  blockedDetails.forEach(story => {
    story.blocking_reasons.forEach(reason => {
      actions.push({
        developer: story.developer,
        story_id: story.story_id,
        action: `Resolve: ${reason}`,
        priority: 'High',
        type: 'Blocked'
      });
    });
    
    story.production_blockers.forEach(blocker => {
      actions.push({
        developer: story.developer,
        story_id: story.story_id,
        action: `Coordinate with ${blocker.production_developer} on ${blocker.production_story_id}`,
        priority: 'High',
        type: 'Production Blocker'
      });
    });
  });
  
  return actions;
}

function generateConflictActions(conflictStories) {
  const actions = [];
  const conflictDetails = extractConflictDetails(conflictStories);
  
  conflictDetails.forEach(story => {
    if (story.resolution_status.includes('Auto-resolved')) {
      actions.push({
        developer: story.developer,
        story_id: story.story_id,
        action: 'Verify auto-resolved conflicts',
        priority: 'Medium',
        type: 'Conflict Verification'
      });
    } else {
      story.conflicts.forEach(conflict => {
        actions.push({
          developer: story.developer,
          story_id: story.story_id,
          action: `Resolve conflict with ${conflict.conflicting_story.id} on ${conflict.component_name}`,
          priority: 'High',
          type: 'Conflict Resolution'
        });
      });
    }
  });
  
  return actions;
}

function generateSafeDeployments(safeStories) {
  const deployments = [];
  const safeDetails = extractDeploymentReadiness(safeStories);
  
  safeDetails.forEach(story => {
    if (story.has_commits && story.has_deployment_task) {
      deployments.push({
        developer: story.developer,
        story_id: story.story_id,
        action: 'Ready for deployment',
        priority: 'Low',
        type: 'Deployment Ready',
        details: `Has commits and deployment task (${story.task_type})`
      });
    } else if (story.has_commits && !story.has_deployment_task) {
      deployments.push({
        developer: story.developer,
        story_id: story.story_id,
        action: 'Create deployment task',
        priority: 'Medium',
        type: 'Needs Deployment Task'
      });
    } else if (!story.has_commits && story.has_deployment_task) {
      deployments.push({
        developer: story.developer,
        story_id: story.story_id,
        action: 'Add commits to story',
        priority: 'Medium',
        type: 'Needs Commits'
      });
    }
  });
  
  return deployments;
}

function generateDetailedAssignments(analysis) {
  const assignments = [];
  const allStories = [
    ...(analysis.all_stories || analysis.safe || []),
    ...(analysis.component_conflicts || analysis.conflicts || []),
    ...(analysis.blocked_stories || analysis.blocked || [])
  ];
  
  const developers = {};
  
  allStories.forEach(story => {
    const dev = story.developer || 'Unassigned';
    if (!developers[dev]) {
      developers[dev] = {
        ready: 0,
        conflicts: 0,
        blocked: 0,
        stories: []
      };
    }
    
    const status = getStoryStatus(story);
    developers[dev][status]++;
    developers[dev].stories.push({
      id: story.story_id || story.id,
      title: story.title,
      status: status
    });
  });
  
  return Object.entries(developers).map(([name, data]) => ({
    developer: name,
    ...data,
    total: data.ready + data.conflicts + data.blocked
  }));
}

function getStoryStatus(story) {
  if (story.classification_tag === 'Blocked') return 'blocked';
  if (story.classification_tag === 'Conflict') return 'conflicts';
  return 'ready';
}

function generateComponentAnalysis(analysis) {
  const componentMap = new Map();
  const allStories = [
    ...(analysis.all_stories || analysis.safe || []),
    ...(analysis.component_conflicts || analysis.conflicts || []),
    ...(analysis.blocked_stories || analysis.blocked || [])
  ];
  
  allStories.forEach(story => {
    story.components?.forEach(component => {
      const key = component.api_name || component.id;
      if (!componentMap.has(key)) {
        componentMap.set(key, {
          name: key,
          type: component.type,
          conflictCount: 0,
          storyCount: 0,
          blockedCount: 0,
          stories: [],
          developers: new Set()
        });
      }
      
      const compData = componentMap.get(key);
      compData.storyCount++;
      compData.stories.push(story.story_id || story.id);
      if (story.developer) compData.developers.add(story.developer);
      
      if (story.classification_tag === 'Conflict') {
        compData.conflictCount++;
      } else if (story.classification_tag === 'Blocked') {
        compData.blockedCount++;
      }
    });
  });
  
  return Array.from(componentMap.values()).map(comp => ({
    ...comp,
    developers: Array.from(comp.developers),
    conflictRate: comp.storyCount > 0 ? (comp.conflictCount / comp.storyCount) * 100 : 0
  }));
}

function generateResolutionPriority(analysis) {
  const conflictStories = analysis.component_conflicts || analysis.conflicts || [];
  const conflictDetails = extractConflictDetails(conflictStories);
  
  return conflictDetails
    .map(story => {
      let priorityScore = 0;
      
      // Higher priority for stories with manual resolution needed
      if (!story.resolution_status.includes('Auto-resolved')) {
        priorityScore += 10;
      }
      
      // Higher priority for stories with more conflicts
      priorityScore += story.conflicts.length * 2;
      
      // Higher priority for stories affecting multiple components
      priorityScore += story.component_count;
      
      return {
        ...story,
        priorityScore,
        priority: priorityScore > 15 ? 'High' : priorityScore > 8 ? 'Medium' : 'Low'
      };
    })
    .sort((a, b) => b.priorityScore - a.priorityScore);
}

function generateStoryBreakdown(analysis) {
  const blockedStories = analysis.blocked_stories || analysis.blocked || [];
  const conflictStories = analysis.component_conflicts || analysis.conflicts || [];
  const safeStories = analysis.all_stories || analysis.safe || [];
  
  return {
    total: blockedStories.length + conflictStories.length + safeStories.length,
    blocked: blockedStories.length,
    conflicts: conflictStories.length,
    safe: safeStories.length,
    deploymentTasks: (analysis.deployment_task_stories || []).length
  };
}

function generateExecutiveRecommendations(analysis) {
  const recommendations = [];
  const summary = analysis.summary || {};
  const blockedStories = summary.stories_blocked || 0;
  const conflictStories = summary.stories_with_conflicts || 0;
  const safeStories = summary.stories_safe || 0;
  
  if (blockedStories > 0) {
    recommendations.push(`Prioritize resolving ${blockedStories} blocked stories as they block deployment`);
  }
  
  if (conflictStories > 0) {
    const autoResolved = (analysis.component_conflicts || []).filter(story => 
      story.components?.some(comp => comp.status === 'Auto-resolved')
    ).length;
    
    const manualConflicts = conflictStories - autoResolved;
    
    if (manualConflicts > 0) {
      recommendations.push(`Schedule conflict resolution for ${manualConflicts} stories requiring manual intervention`);
    }
    
    if (autoResolved > 0) {
      recommendations.push(`Verify ${autoResolved} auto-resolved conflicts in testing environment`);
    }
  }
  
  if (safeStories > 0) {
    const withDeploymentTasks = (analysis.all_stories || []).filter(story => 
      story.has_deployment_task || story.deployment_task_available
    ).length;
    
    if (withDeploymentTasks > 0) {
      recommendations.push(`Proceed with deploying ${withDeploymentTasks} ready stories with deployment tasks`);
    }
    
    if (safeStories > withDeploymentTasks) {
      recommendations.push(`Create deployment tasks for ${safeStories - withDeploymentTasks} stories without tasks`);
    }
  }
  
  return recommendations;
}

// Export enhanced functions
export {
  extractBlockedStories,
  extractConflictStories,
  extractSafeStories,
  extractSafeWithCommitStories,
  generateExecutiveReport,
  generateTechnicalReport,
  generateDeveloperReport
};