// ui/src/ui/components/report-generator.js

// -----------------------------
// Utilities
// -----------------------------
function toDateSafe(d) {
  if (!d || d === 'N/A') return null;
  const t = new Date(d);
  return isNaN(t.getTime()) ? null : t;
}
function isoOrNA(d) {
  const t = toDateSafe(d);
  return t ? t.toISOString() : 'N/A';
}
function formatDate(d) {
  const t = toDateSafe(d);
  return t ? t.toISOString() : 'N/A';
}
function normalizeType(t) {
  if (!t) return 'Unknown';
  const s = String(t).replace(/\s+/g, '').toLowerCase();
  if (s.startsWith('dataraptor')) return 'DataRaptor';
  if (s.startsWith('integrationprocedure') || s === 'ip') return 'IntegrationProcedure';
  if (s.startsWith('omniscript')) return 'OmniScript';
  if (s.startsWith('lightningcomponentbundle') || s === 'lwc') return 'LightningComponentBundle';
  if (s.startsWith('vlocitycard')) return 'VlocityCard';
  if (s.startsWith('apexclass')) return 'ApexClass';
  return t;
}
function typeFromName(name) {
  if (!name) return null;
  const head = String(name).split('.')[0];
  return head || null;
}

// -----------------------------
// Public API
// -----------------------------
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
  const blockedStories = allStories.filter(story => story.classification_tag === 'Blocked');

  return blockedStories.map(story => {
    // collect from components (existing behavior)
    const blockingComponents = [];
    const blockingReasons = [];
    const productionBlockers = [];

    (story.components || []).forEach(component => {
      const componentName = component.api_name || component.id || 'Unknown Component';

      // Reason 1: old commit vs prod
      if (component.has_old_commit) {
        blockingComponents.push(componentName);
        blockingReasons.push(
          `Old commit vs Prod (Prod: ${formatDate(component.production_commit_date)}, Story: ${formatDate(component.story_commit_date)})`
        );
      }

      // Reason 2: explicit status flag on component (if present)
      if (component.status && /block/i.test(component.status)) {
        blockingComponents.push(componentName);
        blockingReasons.push(`Status: ${component.status}`);
      }

      // Conflicting with Production (existing)
      if (component.production_story_id) {
        productionBlockers.push({
          production_story_id: component.production_story_id,
          production_story_title: component.production_story_title,
          production_developer: component.production_developer,
          production_commit_date: component.production_commit_date
        });
      }
    });

    // If analyzer already provided story-level reasons, merge them (no duplicates)
    const storyLevelReasons = Array.isArray(story.blocked_reasons) ? story.blocked_reasons : [];
    const mergedReasons = Array.from(new Set([...blockingReasons, ...storyLevelReasons]));

    return {
      story_id: story.story_id,
      title: story.title,
      developer: story.developer,
      jira_key: story.jira_key,
      component_count: story.component_count,
      classification_tag: story.classification_tag,

      // ⬇ used by preview
      blocking_components: blockingComponents,
      blocking_reasons: mergedReasons,
      production_blockers: productionBlockers,

      has_deployment_task: !!story.has_deployment_task,
      data_sources: story.data_sources || []
    };
  });
}


function extractConflictStories(analysis) {
  const allStories = analysis.all_stories || [];
  const conflictStories = allStories.filter(story => story.classification_tag === 'Conflict');

  const mapped = conflictStories.map(story => {
    const conflicts = [];
    const conflictComponents = [];
    const resolutionStatus = new Set();

    (story.components || []).forEach(component => {
      const componentName = component.api_name || component.id || 'Unknown Component';
      conflictComponents.push(componentName);
      if (component.status) resolutionStatus.add(component.status);

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
      conflicts,
      has_deployment_task: story.has_deployment_task || false,
      data_sources: story.data_sources || []
    };
  });

  console.log('🧭 extractConflictStories → stories:', mapped.length);
  return mapped;
}

function extractSafeStories(analysis) {
  const allStories = analysis.all_stories || [];
  const safeStories = allStories.filter(story => story.classification === 'safe');

  return safeStories.map(story => {
    const deploymentDetails = story.deployment_details || {};
    const copadoStatus = [];
    (story.components || []).forEach(component => {
      if (component.status) copadoStatus.push(`${component.api_name || 'Component'}: ${component.status}`);
    });

    return {
      story_id: story.story_id,
      title: story.title,
      developer: story.developer,
      jira_key: story.jira_key,
      component_count: story.component_count,
      classification_tag: story.classification_tag,
      has_commits: false,
      commit_hash: 'N/A',
      commit_date: 'N/A',
      has_deployment_task: true,
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

// Replace your existing extractSafeWithCommitStories with this version
function extractSafeWithCommitStories(analysis) {
  const allStories = analysis.all_stories || [];
  const safeWithCommitStories = allStories.filter(s => s.classification_tag === 'Safe with commit');

  return safeWithCommitStories.map(story => {
    const deploymentDetails = story.deployment_details || {};
    const components = Array.isArray(story.components) ? story.components : [];

    // find latest commit across components
    let latestDate = null;
    let latestHash = 'N/A';
    for (const c of components) {
      const d = c?.story_commit_date || c?.commit_date || null;
      const h = c?.commit_hash || 'N/A';
      if (d) {
        const dt = new Date(d);
        if (!isNaN(dt)) {
          if (!latestDate || dt > latestDate) {
            latestDate = dt;
            latestHash = h;
          }
        }
      }
    }

    return {
      story_id: story.story_id,
      title: story.title,
      developer: story.developer,
      jira_key: story.jira_key,
      component_count: story.component_count,
      classification_tag: story.classification_tag,
      has_commits: true,
      commit_hash: latestHash,
      commit_date: latestDate ? latestDate.toISOString() : 'N/A',
      has_deployment_task: !!story.has_deployment_task,
      task_type: deploymentDetails.task_type || 'N/A',
      timing: deploymentDetails.timing || 'N/A',
      // keep fields we already return for consistency
      current_status: deploymentDetails.current_status || 'N/A',
      validation: deploymentDetails.validation || 'N/A',
      data_sources: story.data_sources || [],
      environment: story.environment || 'N/A',
      deployment_details: deploymentDetails
    };
  });
}



// -----------------------------
// Core Report Generators
// -----------------------------
function generateExecutiveReport(analysis, options) {
  const blockedStories = extractBlockedStories(analysis);
  const conflictStories = extractConflictStories(analysis);
  const safeStories = extractSafeStories(analysis);
  const safeWithCommitStories = extractSafeWithCommitStories(analysis);

  const totalStories =
    blockedStories.length + conflictStories.length + safeStories.length + safeWithCommitStories.length;

  // These can be expanded later
  const deploymentScore = 0;
  const riskLevel = 'Unknown';

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
      componentsWithConflicts: analysis?.summary?.components_with_conflicts || 0
    },
    blockedAnalysis: blockedStories,
    conflictAnalysis: conflictStories,
    criticalActions: [],
    recommendations: []
  };
}

function generateTechnicalReport(analysis, options) {
  const blockedStories = extractBlockedStories(analysis);
  const conflictStories = extractConflictStories(analysis);
  const safeStories = extractSafeStories(analysis);
  const safeWithCommitStories = extractSafeWithCommitStories(analysis);

  const componentConflicts = generateComponentConflictReport(conflictStories) || [];

  return {
    title: 'Technical Analysis Report - Component Health',
    type: 'technical',
    generatedAt: new Date().toLocaleString(),
    technicalSummary: {
      totalStories: blockedStories.length + conflictStories.length + safeStories.length + safeWithCommitStories.length,
      blockedStories: blockedStories.length,
      conflictStories: conflictStories.length,
      safeStories: safeStories.length,
      safeWithCommitStories: safeWithCommitStories.length,
      conflictedComponents: analysis?.summary?.components_with_conflicts || 0,
      componentConflicts: componentConflicts.length
    },
    blockedStories,
    conflictStories,
    safeStories,
    safeWithCommitStories,
    componentAnalysis: { notes: 'Component analysis placeholder' },
    componentConflicts,
    resolutionPriority: []
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
    developerAssignments: [], // wire up later if needed
    blockedActions: blockedStories,
    conflictActions: conflictStories,
    safeDeployments: safeStories,
    safeWithCommitDeployments: safeWithCommitStories
  };
}

// -----------------------------
// Component-centric conflict builder (robust v2)
// -----------------------------
function generateComponentConflictReport(conflictStories) {
  console.group('🔍 generateComponentConflictReport (v2)');
  console.log('Received conflict stories:', Array.isArray(conflictStories) ? conflictStories.length : 0);

  const componentsMap = new Map();
  if (!Array.isArray(conflictStories)) return [];

  for (const story of conflictStories) {
    const storyId = story?.story_id;
    const storyDev = story?.developer || 'Unknown';
    const conflictsArr = Array.isArray(story?.conflicts) ? story.conflicts : [];

    for (const conflict of conflictsArr) {
      // 1) Component name
      const compName =
        conflict?.component_name ||
        // loose fallback: try to discover from conflict_components list when types are embedded there
        (Array.isArray(story?.conflict_components)
          ? story.conflict_components.find(n => n?.includes(conflict?.component_type || ''))
          : null) ||
        conflict?.component_type ||
        'Unknown Component';

      // 2) Component type (prefer name prefix, then field)
      const typeFromNm = normalizeType(typeFromName(compName));
      const typeFromFld = normalizeType(conflict?.component_type);
      const compType = typeFromNm || typeFromFld || 'Unknown';

      const key = `${compType}|${compName}`;
      if (!componentsMap.has(key)) {
        componentsMap.set(key, {
          componentType: compType,
          componentName: compName,
          storiesMap: new Map(), // story_id -> { story_id, developer, commit_date, commit_hash }
          latest: null
        });
      }
      const entry = componentsMap.get(key);

      // Current story info
      const curCommitDate =
        conflict?.story_commit_date ||
        conflict?.story_commit ||
        conflict?.commit_date ||
        null;
      const curCommitHash = conflict?.commit_hash || 'N/A';

      if (storyId && !entry.storiesMap.has(storyId)) {
        entry.storiesMap.set(storyId, {
          story_id: storyId,
          developer: storyDev,
          commit_date: curCommitDate,
          commit_hash: curCommitHash
        });
      }

      // Conflicting story
      const cs = conflict?.conflicting_story;
      if (cs?.id && cs.id !== storyId && !entry.storiesMap.has(cs.id)) {
        entry.storiesMap.set(cs.id, {
          story_id: cs.id,
          developer: cs.developer || 'Unknown',
          commit_date: cs.commit_date || null,
          commit_hash: 'N/A'
        });
      }

      // Track latest by commit date
      const consider = (sObj) => {
        const d = toDateSafe(sObj?.commit_date);
        if (!d) return;
        if (!entry.latest) entry.latest = { ...sObj };
        else {
          const ld = toDateSafe(entry.latest.commit_date);
          if (!ld || d > ld) entry.latest = { ...sObj };
        }
      };
      consider(entry.storiesMap.get(storyId));
      if (cs?.id) consider(entry.storiesMap.get(cs.id));
    }
  }

  // Finalize
  const result = [];
  for (const [, v] of componentsMap) {
    const stories = Array.from(v.storiesMap.values());
    const developers = Array.from(new Set(stories.map(s => s.developer || 'Unknown'))).join(', ');
    const involvedStories = stories.map(s => s.story_id).join(', ');
    const latest = v.latest;

    result.push({
      componentType: v.componentType,
      componentName: v.componentName,
      uniqueStories: stories.length,
      developers,
      latestStory: latest?.story_id || 'N/A',
      latestDeveloper: latest?.developer || 'N/A',
      latestCommitDate: latest?.commit_date ? isoOrNA(latest.commit_date) : 'N/A',
      latestCommitHash: latest?.commit_hash || 'N/A',
      involvedStories
    });
  }

  // Sort by newest first
  result.sort((a, b) => {
    const da = toDateSafe(a.latestCommitDate);
    const db = toDateSafe(b.latestCommitDate);
    if (da && db) return db - da;
    if (da) return -1;
    if (db) return 1;
    return (a.componentName || '').localeCompare(b.componentName || '');
  });

  const typeCounts = result.reduce((acc, r) => {
    acc[r.componentType] = (acc[r.componentType] || 0) + 1;
    return acc;
  }, {});
  console.log('✅ Unique components:', result.length, '→ by type:', typeCounts);
  console.groupEnd();
  return result;
}
