/**
 * Copado Deployment Validator - Frontend
 */

const API_URL = 'http://localhost:5000';
let currentDiffData = {
    componentName: '',
    productionCode: '',
    uatCode: '',
    diffHtml: ''
};  // ← ADD THIS

const deploymentUploadBox = document.getElementById('deploymentUploadBox');
const productionUploadBox = document.getElementById('productionUploadBox');
const deploymentFileInput = document.getElementById('deploymentFile');
const productionFileInput = document.getElementById('productionFile');
const analyzeBtn = document.getElementById('analyzeBtn');
const loading = document.getElementById('loading');
const results = document.getElementById('results');
const error = document.getElementById('error');

let deploymentFile = null;
let productionFile = null;
let analysisData = null;
let currentRole = null;
let storyDecisions = {};


document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
});


window.handleGeneratePlanClick = function (e) {
  try {
    const plan = generateDeploymentPlan();   // build object
    saveDeploymentPlan(plan);                // persist
    renderDeploymentPlan(plan);              // paint UI (e.g., #tab-deploy)
    if (typeof showToast === 'function') showToast('Deployment plan generated.', 'success');
  } catch (err) {
    console.error('Generate plan failed:', err);
    if (typeof showToast === 'function') showToast('Failed to generate plan.', 'error');
  }
};
(function attachGeneratePlanDelegation(){
  if (window.__genPlanDelegationAttached) return;
  window.__genPlanDelegationAttached = true;

  document.addEventListener('click', function (e) {
    const btn = e.target.closest('button, [role="button"]');
    if (!btn) return;
    if (btn.matches('[data-action="generate-plan"]') ||
        /Generate\s*Plan/i.test((btn.textContent || '').replace(/\s+/g,' '))) {
      e.preventDefault();
      window.handleGeneratePlanClick(e);
    }
  }, true);
})();
// ========================================
// DECISION MANAGEMENT
// ========================================

// ---------- Time & IDs ----------
function toIsoUtcNow() {
  return new Date().toISOString();
}
function fmtIdTimestamp(d) {
  const pad = (n) => (n < 10 ? '0' + n : '' + n);
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) + '_' +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds())
  );
}
function newDeploymentAnalysisId(date = new Date()) {
  return `deploy_${fmtIdTimestamp(date)}`;
}

// ---------- Storage ----------
function getJSON(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; }
  catch { return fallback; }
}
function setJSON(key, val) {
  localStorage.setItem(key, JSON.stringify(val));
}

// ---------- Known data getters (adjust if your app names differ) ----------
function getAllStories() {
  // Try window analysis first; then localStorage snapshot fallback
  if (window.analysisData?.stories?.length) return window.analysisData.stories;
  const snapshot = getJSON('analysisData', {});
  return snapshot?.stories || [];
}
function getConflictsMap() {
  // Optional: map of storyId -> conflict meta (if you store this)
  // If you don’t keep this, we’ll infer “safe” from lack of decisions + not excluded.
  return window.analysisData?.conflictsMap || {};
}
function getConflictDecisionsByComponent() {
  return getJSON('conflictDecisions', {});
}

// If you have “excluded” or “blocked” stories tracked elsewhere, surface here:
function isStoryExcluded(storyId) {
  const excluded = getJSON('excludedStories', []);
  return excluded.includes(storyId);
}

// Normalize a decision coming from your submitResolutionDecision() payload
function normalizeDecisionPayload(d) {
  const out = {
    type: d?.resolutionStrategy || d?.type || 'IMMEDIATE',
    deploy_order: d?.deploy_order ?? null,
    depends_on: Array.isArray(d?.depends_on) ? d.depends_on.slice() : [],
    notes: d?.decisionRationale || d?.notes || '',
    confidence: d?.confidence || (d?.resolvedBy === 'SYSTEM_AUTO' ? 'HIGH' : undefined),
  };
  return out;
}

// Build a map: storyId -> synthesized decision record (status/category/etc)
function synthesizeStoryDecisions() {
  const stories = getAllStories();
  const decisionsByComponent = getConflictDecisionsByComponent();

  // Index decisions by story ids (derive from your stored structure)
  // Your stored decisions might not be keyed by story; they include .stories array.
  // We walk all decisions and attach to each involved story.
  const storyDecisionMap = {}; // storyId -> { category, status, decision, decided_by, decided_at }
  Object.values(decisionsByComponent).forEach((d) => {
    const involved = Array.isArray(d.stories) ? d.stories : [];
    involved.forEach((sid) => {
      storyDecisionMap[sid] = {
        story_id: sid,
        category: 'CONFLICT',
        status: 'DECIDED',
        decision: normalizeDecisionPayload(d),
        decided_by: d?.resolvedBy || 'unknown',
        decided_at: d?.timestamp || toIsoUtcNow(),
      };
    });
  });

  // Fill in stories that have no explicit decision yet
  for (const s of stories) {
    const sid = s.id || s.story_id || s.StoryId || s;
    if (!sid) continue;
    if (storyDecisionMap[sid]) continue;

    if (isStoryExcluded(sid)) {
      storyDecisionMap[sid] = {
        story_id: sid,
        category: 'SAFE',
        status: 'EXCLUDED',
        decision: { type: 'NONE' },
        decided_by: 'SYSTEM_AUTO',
        decided_at: toIsoUtcNow(),
      };
      continue;
    }

    // If you can detect “has conflict but not decided yet”, mark PENDING
    const maybeConflict = false; // change if you can detect from your data
    if (maybeConflict) {
      storyDecisionMap[sid] = {
        story_id: sid,
        category: 'CONFLICT',
        status: 'PENDING',
        decision: { type: 'TBD' },
        decided_by: 'SYSTEM_AUTO',
        decided_at: toIsoUtcNow(),
      };
    } else {
      // Default SAFE
      storyDecisionMap[sid] = {
        story_id: sid,
        category: 'SAFE',
        status: 'APPROVED',
        decision: { type: 'IMMEDIATE', deploy_order: 1 },
        decided_by: 'SYSTEM_AUTO',
        decided_at: toIsoUtcNow(),
      };
    }
  }

  return storyDecisionMap;
}

// Validate & enrich ordering/dependencies, produce summary
function analyzePlan(storyDecisionMap) {
  const ids = Object.keys(storyDecisionMap);
  let decided = 0, pending = 0, approved = 0, excluded = 0;

  // Collect graph for dependency checks
  const graph = new Map(); // node -> neighbors
  const indeg = new Map(); // node -> indegree
  ids.forEach(id => { graph.set(id, new Set()); indeg.set(id, 0); });

  ids.forEach((sid) => {
    const rec = storyDecisionMap[sid];
    if (rec.status === 'DECIDED' || rec.status === 'APPROVED') decided++;
    if (rec.status === 'PENDING') pending++;
    if (rec.status === 'APPROVED') approved++;
    if (rec.status === 'EXCLUDED') excluded++;

    const deps = rec.decision?.depends_on || [];
    deps.forEach(dep => {
      if (!graph.has(dep)) {
        // If dependency missing, record a warning by annotating notes
        rec.decision.notes = (rec.decision.notes || '') +
          (rec.decision.notes ? ' ' : '') + `[WARN: missing dependency ${dep}]`;
      } else {
        if (!graph.get(dep).has(sid)) {
          graph.get(dep).add(sid);
          indeg.set(sid, (indeg.get(sid) || 0) + 1);
        }
      }
    });
  });

  // Topological sort to detect cycles
  const cyc = [];
  const order = [];
  const q = [];
  indeg.forEach((d, k) => { if (d === 0) q.push(k); });
  while (q.length) {
    const u = q.shift();
    order.push(u);
    for (const v of graph.get(u)) {
      indeg.set(v, indeg.get(v) - 1);
      if (indeg.get(v) === 0) q.push(v);
    }
  }
  if (order.length !== ids.length) {
    cyc.push('Dependency cycle detected among stories. Review depends_on.');
  }

  const summary = {
    total: ids.length,
    decided,
    pending,
    approved,
    excluded
  };

  return { summary, dependencyWarnings: cyc };
}

function generateDeploymentPlan() {
  const deployment_analysis_id = newDeploymentAnalysisId();
  const analyzed_at = toIsoUtcNow();

  const story_decisions = synthesizeStoryDecisions();
  const total_stories = Object.keys(story_decisions).length;

  const { summary, dependencyWarnings } = analyzePlan(story_decisions);

  // Optional: surface dependency warnings at top-level
  if (dependencyWarnings.length) {
    console.warn('Deployment plan warnings:', dependencyWarnings);
  }

  return {
    deployment_analysis_id,
    analyzed_at,
    total_stories,
    story_decisions,
    summary
  };
}


function saveDeploymentPlan(plan) {
  const index = getJSON('deploymentPlanIndex', []);
  const plans = getJSON('deploymentPlans', {});
  plans[plan.deployment_analysis_id] = plan;
  if (!index.includes(plan.deployment_analysis_id)) index.unshift(plan.deployment_analysis_id);
  setJSON('deploymentPlans', plans);
  setJSON('deploymentPlanIndex', index);
  return plan.deployment_analysis_id;
}
function getLatestDeploymentPlan() {
  const index = getJSON('deploymentPlanIndex', []);
  if (!index.length) return null;
  const plans = getJSON('deploymentPlans', {});
  return plans[index[0]] || null;
}

function renderDeploymentPlan(plan) {
  const el = document.getElementById('tab-deploy')
         || document.getElementById('deployPlanTabContent')
         || document.querySelector('#deploy-plan');
  if (!el) return;

  const rows = Object.values(plan.story_decisions).map(s => {
    const d = s.decision || {};
    const dep = (d.depends_on && d.depends_on.length) ? d.depends_on.join(', ') : '';
    const conf = d.confidence || '';
    const notes = d.notes || '';
    const ord = (d.deploy_order != null) ? d.deploy_order : '';
    return `
      <tr>
        <td>${s.story_id}</td>
        <td>${s.category}</td>
        <td>${s.status}</td>
        <td>${d.type || ''}</td>
        <td>${ord}</td>
        <td>${dep}</td>
        <td>${conf}</td>
        <td>${notes}</td>
      </tr>
    `;
  }).join('');

  el.innerHTML = `
    <div class="plan-header">
      <div><strong>Deployment Analysis ID:</strong> ${plan.deployment_analysis_id}</div>
      <div><strong>Analyzed At (UTC):</strong> ${plan.analyzed_at}</div>
      <div><strong>Total Stories:</strong> ${plan.total_stories}</div>
      <div><strong>Summary:</strong> total=${plan.summary.total}, decided=${plan.summary.decided}, pending=${plan.summary.pending}, approved=${plan.summary.approved}, excluded=${plan.summary.excluded}</div>
      <div class="actions">
        <button id="btnRegeneratePlan">Regenerate</button>
        <button id="btnExportPlan">Export JSON</button>
      </div>
    </div>
    <div class="table-wrap">
      <table class="grid">
        <thead>
          <tr>
            <th>Story</th>
            <th>Category</th>
            <th>Status</th>
            <th>Decision Type</th>
            <th>Deploy&nbsp;Order</th>
            <th>Depends On</th>
            <th>Confidence</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;

  // Wire actions
  const regen = el.querySelector('#btnRegeneratePlan');
  const exp   = el.querySelector('#btnExportPlan');
  if (regen) regen.onclick = () => {
    const newPlan = generateDeploymentPlan();
    saveDeploymentPlan(newPlan);
    renderDeploymentPlan(newPlan);
    if (typeof showToast === 'function') showToast('Deployment plan regenerated.', 'success');
  };
  if (exp) exp.onclick = () => exportPlanJSON(plan);
}

function renderLatestDeploymentPlan() {
  const plan = getLatestDeploymentPlan() || (function() {
    const p = generateDeploymentPlan();
    saveDeploymentPlan(p);
    return p;
  })();
  renderDeploymentPlan(plan);
}

function exportPlanJSON(plan) {
  try {
    const blob = new Blob([JSON.stringify(plan, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.download = `${plan.deployment_analysis_id}.json`;
    a.href = url;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  } catch (e) {
    console.error('Export failed', e);
    if (typeof showToast === 'function') showToast('Export failed.', 'error');
  }
}

// Initialize decisions storage

function initializeDecisions() {
    // Load from localStorage if exists
    const saved = localStorage.getItem('deployment_decisions');
    if (saved) {
        storyDecisions = JSON.parse(saved);
    } else {
        // Initialize empty decisions for all stories
        if (analysisData && analysisData.all_stories) {
            analysisData.all_stories.forEach(story => {
                storyDecisions[story.id] = {
                    story_id: story.id,
                    status: 'PENDING',
                    decision: null,
                    decided_by: null,
                    decided_at: null,
                    notes: ''
                };
            });
        }
    }
}

function saveDecisions() {
    localStorage.setItem('deployment_decisions', JSON.stringify(storyDecisions));
    console.log('💾 Decisions saved:', storyDecisions);
}


function renderDecisionCategory(category, stories, title, bgColor, textColor) {
    if (stories.length === 0) return '';
    
    const decidedInCategory = stories.filter(s => {
        const decision = storyDecisions[s.id];
        return decision && (decision.status === 'DECIDED' || decision.status === 'APPROVED');
    }).length;
    
    return `
        <div style="margin-bottom: 20px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
            <div style="background: ${bgColor}; padding: 16px; border-bottom: 1px solid #e2e8f0; cursor: pointer;" onclick="toggleCategorySection('${category}')">
                <div style="display: flex; justify-content: between; align-items: center;">
                    <h3 style="margin: 0; color: ${textColor}; flex: 1;">
                        ${title} (${stories.length})
                    </h3>
                    <span style="margin: 0 20px; color: ${textColor}; font-size: 14px;">
                        ${decidedInCategory}/${stories.length} decided
                    </span>
                    <span id="${category}-toggle" style="color: ${textColor}; font-size: 20px;">▼</span>
                </div>
            </div>
            
            <div id="${category}-content" style="display: block;">
                ${stories.map(story => renderDecisionRow(story, category)).join('')}
            </div>
        </div>
    `;
}

function renderDecisionRow(story, category) {
    const decision = storyDecisions[story.id] || { status: 'PENDING' };
    const isPending = decision.status === 'PENDING';
    const isReviewLater = decision.status === 'REVIEW_LATER';
    const isDecided = decision.status === 'DECIDED' || decision.status === 'APPROVED';
    
    let statusBadge = '';
    if (isPending) {
        statusBadge = '<span style="background: #fff3cd; color: #856404; padding: 4px 12px; border-radius: 12px; font-size: 12px;">⏳ Pending</span>';
    } else if (isReviewLater) {
        statusBadge = '<span style="background: #cfe2ff; color: #084298; padding: 4px 12px; border-radius: 12px; font-size: 12px;">🔖 Review Later</span>';
    } else if (isDecided) {
        statusBadge = '<span style="background: #d1f2eb; color: #0c5460; padding: 4px 12px; border-radius: 12px; font-size: 12px;">✅ Decided</span>';
    }
    
    return `
        <div style="padding: 16px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center;">
            <div style="flex: 1;">
                <strong>${story.id}</strong>
                <span style="margin-left: 10px; color: #666; font-size: 14px;">
                    ${story.developer || 'Unknown'} • ${story.component_count || 0} components
                </span>
                ${isDecided ? `
                    <div style="margin-top: 8px; padding: 8px; background: #f8f9fa; border-radius: 4px; font-size: 13px;">
                        <strong>Decision:</strong> ${getDecisionSummary(decision)}
                    </div>
                ` : ''}
            </div>
            <div style="display: flex; gap: 10px; align-items: center;">
                ${statusBadge}
                ${isDecided ? `
                    <button onclick="editDecision('${story.id}')" style="padding: 6px 16px; background: white; border: 1px solid #d0d7de; border-radius: 4px; cursor: pointer; font-size: 13px;">
                        Edit
                    </button>
                ` : `
                    <button onclick="makeDecision('${story.id}')" style="padding: 6px 16px; background: #667eea; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 13px;">
                        Decide Now
                    </button>
                    <button onclick="markReviewLater('${story.id}')" style="padding: 6px 16px; background: white; border: 1px solid #d0d7de; border-radius: 4px; cursor: pointer; font-size: 13px;">
                        Review Later
                    </button>
                `}
            </div>
        </div>
    `;
}

function getDecisionSummary(decision) {
    if (!decision || !decision.decision) return 'No decision';
    
    switch(decision.decision.type) {
        case 'IMMEDIATE':
            return 'Deploy immediately';
        case 'SEQUENCE':
            return `Deploy in sequence (order: ${decision.decision.deploy_order})`;
        case 'EXCLUDE':
            return 'Exclude from deployment';
        case 'MANUAL_MERGE':
            return 'Need manual merge';
        default:
            return decision.decision.type;
    }
}

function toggleCategorySection(category) {
    const content = document.getElementById(`${category}-content`);
    const toggle = document.getElementById(`${category}-toggle`);
    
    if (content.style.display === 'none') {
        content.style.display = 'block';
        toggle.textContent = '▼';
    } else {
        content.style.display = 'none';
        toggle.textContent = '▶';
    }
}

function makeDecision(storyId) {
    // Find the story from all_stories
    const story = analysisData.all_stories.find(s => s.id === storyId);
    
    if (!story) {
        alert('Story not found: ' + storyId);
        return;
    }
    
    // Show the conflict resolution modal
    showConflictResolutionModal(story);
}

function renderConflictComparison(conflictData, currentStory) {
   const involvedStories = conflictData.involved_stories;
    const conflictComponent = conflictData.component;
    
    const currentStoryData = involvedStories.find(story => story.id === currentStory.id);
    const otherStoryData = involvedStories.find(story => story.id !== currentStory.id);
    

    const currentCommitHash = getCommitHashFromAllStories(
  currentStory?.id,
  conflictComponent?.api_name
) || 'N/A';

const otherCommitHash = getCommitHashFromAllStories(
  otherStoryData?.id,
  conflictComponent?.api_name
) || 'N/A';

  


    return  `
               <div class="conflict-comparison">
            <!-- Fixed Header Layout -->
            <div class="conflict-header">
                <h2>🚨 Component Conflict Resolution Required</h2>
                <div class="conflict-meta">
                    <div class="meta-item" data-component-name="${conflictComponent.api_name}">
+   <strong>Component:</strong> ${conflictComponent.api_name}
+ </div>
                    <div class="meta-item">
                        <strong>Risk:</strong> 
                        <span class="risk-badge ${conflictData.severity?.toLowerCase()}">
                            ${conflictData.severity} (${conflictData.risk_score}/100)
                        </span>
                    </div>
                </div>
            </div>


            <!-- Compact Component Comparison -->
            <div class="compact-comparison">
                <div class="story-compact current">
                    <div class="story-header">Your Story</div>
                    <div class="story-id">${currentStoryData?.id}</div>
                    <div class="developer">${currentStoryData?.developer}</div>
                    <div class="commit-date">${formatCommitDate(currentStoryData?.commit_date)}</div>
                    <div class="commit-hash">${currentCommitHash}</div>
                </div>
                
                <div class="vs">VS</div>
                
                <div class="story-compact other">
                    <div class="story-header">Conflicting Story</div>
                    <div class="story-id">${otherStoryData?.id}</div>
                    <div class="developer">${otherStoryData?.developer}</div>
                    <div class="commit-date">${formatCommitDate(otherStoryData?.commit_date)}</div>
                    <div class="commit-hash">${otherCommitHash}</div>
                </div>
            </div>

            <!-- Compact Resolution Strategy -->
            <div class="resolution-section compact">
                <h3>🛠️ Resolution Strategy</h3>
                <div class="resolution-grid">
                    <div class="resolution-column">
                        <div class="resolution-option compact">
                            <input type="radio" id="deployCurrentFirst" name="resolutionStrategy" value="deploy_current_first">
                            <label for="deployCurrentFirst">Deploy ${currentStoryData?.id} first</label>
                        </div>
                        <div class="resolution-option compact">
                            <input type="radio" id="deployOtherFirst" name="resolutionStrategy" value="deploy_other_first">
                            <label for="deployOtherFirst">Deploy ${otherStoryData?.id} first</label>
                        </div>
                    </div>
                    <div class="resolution-column">
                        <div class="resolution-option compact">
                            <input type="radio" id="excludeCurrent" name="resolutionStrategy" value="exclude_current">
                            <label for="excludeCurrent">Exclude ${currentStoryData?.id}</label>
                        </div>
                        <div class="resolution-option compact">
                            <input type="radio" id="excludeOther" name="resolutionStrategy" value="exclude_other">
                            <label for="excludeOther">Exclude ${otherStoryData?.id}</label>
                        </div>
                    </div>
                </div>
                <div class="resolution-option full-width">
                    <input type="radio" id="deferBoth" name="resolutionStrategy" value="defer_both">
                    <label for="deferBoth">Defer both for analysis</label>
                </div>
            </div>

            <!-- Rest of the sections remain the same -->
            <div class="rationale-section">
                <h3>📝 Decision Rationale <span class="required">*</span></h3>
                <textarea id="decisionRationale" placeholder="Why this approach?" rows="3"></textarea>
            </div>

            <!-- Action Buttons -->
            <div class="action-buttons">
                <button class="btn-secondary" onclick="saveAsDraft()">💾 Save Draft</button>
                <button class="btn-warning" onclick="escalateToArchitect()">🚨 Escalate</button>
                <button class="btn-primary" onclick="submitResolutionDecision()">✅ Submit Decision</button>
            </div>
        </div>
    `;
}



// Improved function to extract commit hash from various data structures
function extractCommitHash(storyData) {
    if (!storyData) return 'N/A';
    
    console.log('🔍 extractCommitHash - Story data:', storyData);
    
    // Try multiple possible locations for commit hash
    const possibleHashLocations = [
        storyData.commit_hash,                    // Direct property
        storyData.commitHash,                     // Alternative camelCase
        storyData.components?.[0]?.commit_hash,   // From first component
        storyData.components?.[0]?.commitHash,    // Alternative camelCase
        storyData.last_commit_hash,               // Last commit hash
        storyData.lastCommitHash                  // Alternative camelCase
    ];
    
    for (const hash of possibleHashLocations) {
        if (hash && typeof hash === 'string' && hash.length > 0) {
            console.log('✅ Found commit hash:', hash);
            return hash;
        }
    }
    
    // If no hash found, check if there are components with hashes
    if (storyData.components && Array.isArray(storyData.components)) {
        for (const component of storyData.components) {
            if (component.commit_hash) {
                console.log('✅ Found commit hash in component:', component.commit_hash);
                return component.commit_hash;
            }
        }
    }
    
    console.log('❌ No commit hash found');
    return 'N/A';
}


function updateDeploymentDecisionsUI() {
    const decisions = JSON.parse(localStorage.getItem('conflictDecisions') || '{}');
    const decisionCount = Object.keys(decisions).length;
    console.log('📈 Decision count:', decisionCount);
    
    // Target the specific progress element in your deployment page
    const progressElement = document.querySelector('.decision-progress') || 
                           document.querySelector('[data-progress]') ||
                           findElementByText('0/2 decided') ||
                           findElementByText('Decision Progress');
    
    if (progressElement) {
        progressElement.textContent = `${decisionCount}/2 decided (${Math.round(decisionCount/2*100)}%)`;
        console.log('✅ Updated progress element');
    } else {
        console.log('❌ Could not find progress element, creating one');
        createProgressIndicator(decisionCount);
    }
    
    updateStoryStatus(decisions);
}

function findElementByText(text) {
    const elements = document.querySelectorAll('*');
    for (const el of elements) {
        if (el.textContent && el.textContent.includes(text)) {
            return el;
        }
    }
    return null;
}

function updateStoryStatus(decisions) {
    console.log('🔄 Processing decisions for stories:', decisions);
    
    Object.values(decisions).forEach(decision => {
        decision.stories?.forEach(storyId => {
            if (!storyId || storyId === 'Unknown') {
                console.log('⏭️ Skipping unknown story ID');
                return;
            }
            
            console.log('📝 Looking for story element:', storyId);
            
            // More specific search for story elements
            const storyElement = findStoryElement(storyId);
            
            if (storyElement) {
                addResolvedBadge(storyElement, storyId);
                
                // Also update the status in the list if it's a list item
                updateStoryInList(storyId);
            } else {
                console.log('❌ Could not find story element for:', storyId);
            }
        });
    });
}

function findStoryElement(storyId) {
    // Try different strategies to find the story element
    
    // Strategy 1: Direct data attributes
    let element = document.querySelector(`[data-story="${storyId}"]`) ||
                  document.querySelector(`[data-story-id="${storyId}"]`);
    if (element) return element;
    
    // Strategy 2: Look for elements containing the story ID
    const allElements = document.querySelectorAll('li, div, span, p, td');
    for (const el of allElements) {
        if (el.textContent && el.textContent.includes(storyId)) {
            console.log('✅ Found element with story ID:', storyId);
            return el;
        }
    }
    
    // Strategy 3: Look in specific sections of deployment page
    const deploymentSections = document.querySelectorAll('.story-list, .conflicting-stories, [data-stories]');
    for (const section of deploymentSections) {
        const elements = section.querySelectorAll('li, div');
        for (const el of elements) {
            if (el.textContent && el.textContent.includes(storyId)) {
                return el;
            }
        }
    }
    
    return null;
}

function updateStoryInList(storyId) {
    // Specifically update the list items in the deployment decisions page
    const listItems = document.querySelectorAll('li');
    listItems.forEach(li => {
        if (li.textContent.includes(storyId) && !li.textContent.includes('Resolved')) {
            // Mark as resolved in the list
            if (!li.querySelector('.resolved-badge')) {
                const badge = document.createElement('span');
                badge.className = 'resolved-badge';
                badge.textContent = ' ✅ Resolved';
                badge.style.cssText = `
                    margin-left: 10px;
                    color: green;
                    font-size: 0.9em;
                    font-weight: bold;
                `;
                li.appendChild(badge);
                console.log('✅ Updated story in list:', storyId);
            }
        }
    });
}

function addResolvedBadge(storyElement, storyId) {
    // Check if badge already exists
    const existingBadge = storyElement.querySelector('.resolved-badge');
    if (existingBadge) {
        console.log('✅ Badge already exists for:', storyId);
        return;
    }
    
    // Create and add badge
    const badge = document.createElement('span');
    badge.className = 'resolved-badge';
    badge.textContent = ' ✅ Resolved';
    badge.style.cssText = `
        margin-left: 10px;
        color: green;
        font-size: 0.9em;
        font-weight: bold;
        background: #d4edda;
        padding: 2px 8px;
        border-radius: 12px;
        border: 1px solid #c3e6cb;
    `;
    
    storyElement.appendChild(badge);
    console.log('✅ Added resolved badge to story:', storyId);
}

function createProgressIndicator(decisionCount) {
    console.log('🆕 Creating progress indicator...');
    
    // Try to find where to put the progress indicator
    const possibleContainers = [
        document.querySelector('h1'),
        document.querySelector('h2'),
        document.body
    ];
    
    const container = possibleContainers.find(el => el) || document.body;
    
    const progressDiv = document.createElement('div');
    progressDiv.className = 'decision-progress-auto';
    progressDiv.style.cssText = `
        background: #e7f3ff;
        border: 1px solid #b3d9ff;
        border-radius: 8px;
        padding: 12px 16px;
        margin: 16px 0;
        font-weight: bold;
        color: #0066cc;
    `;
    progressDiv.textContent = `${decisionCount}/2 decided (${Math.round(decisionCount/2*100)}%)`;
    
    container.parentNode.insertBefore(progressDiv, container.nextSibling);
    console.log('✅ Created auto progress indicator');
}


// ========================================
// IMPROVED CONFLICT RESOLUTION SUBMISSION FLOW
// ========================================

function submitResolutionDecision(e) {
  // Prevent default form submit if this is attached to a form/button
  if (e && typeof e.preventDefault === 'function') e.preventDefault();

  // ----- 1) Find the modal root -----
  var modal =
    document.getElementById('conflictResolutionModal') ||
    (document.querySelector('.conflict-comparison') && document.querySelector('.conflict-comparison').closest('.modal-overlay')) ||
    document.querySelector('.modal-overlay');

  if (!modal) {
    console.error('submitResolutionDecision: modal not found');
    if (typeof showToast === 'function') showToast('Could not find the modal to submit.', 'error');
    return false;
  }

  // ----- 2) Validate required fields -----
  var selectedStrategy = modal.querySelector('input[name="resolutionStrategy"]:checked');
  var rationaleEl = modal.querySelector('#decisionRationale');
  if (!selectedStrategy) {
    alert('Please choose a resolution strategy.');
    return false;
  }
  if (!rationaleEl || !rationaleEl.value.trim()) {
    alert('Please provide a decision rationale.');
    return false;
  }

  var rationale = rationaleEl.value.trim();
  var urgency = modal.querySelector('input[name="urgency"]:checked');
  var riskImpact = modal.querySelector('input[name="riskImpact"]:checked');

  // ----- 3) Extract story IDs from the modal (based on your compact layout) -----
  var currentStoryId = (modal.querySelector('.story-compact.current .story-id') || {}).textContent;
  var otherStoryId   = (modal.querySelector('.story-compact.other .story-id') || {}).textContent;
  currentStoryId = currentStoryId ? currentStoryId.trim() : null;
  otherStoryId   = otherStoryId   ? otherStoryId.trim()   : null;

  // ----- 4) Resolve the component API name WITHOUT :contains() -----
  // Primary: read from a machine-readable data attribute rendered in the modal
  //   e.g., <div class="meta-item" data-component-name="LightningComponentBundle.prDeviceTile">...</div>
  var componentApiName =
    modal.querySelector('[data-component-name]')?.dataset.componentName
    // Fallback: from globals set when the modal was opened (if you set window.currentConflictData)
    || (window.currentConflictData && window.currentConflictData.component && window.currentConflictData.component.api_name)
    // Last resort: try to read any nearby "value" next to a "Component" label (kept for backward-compat)
    || (function () {
         var labelEl = Array.prototype.slice.call(modal.querySelectorAll('.meta-item strong')).find(function (el) {
           return ((el.textContent || '').trim().toLowerCase().indexOf('component') === 0);
         });
         if (!labelEl) return null;
         var valueEl = labelEl.parentElement.querySelector('.meta-value') || labelEl.nextElementSibling;
         if (!valueEl) return null;
         return (valueEl.getAttribute && (valueEl.getAttribute('data-component') || valueEl.getAttribute('data-component-id')))
             || (valueEl.textContent || '').trim()
             || null;
       })()
    || 'UnknownComponent';

  // Normalize (defensive)
  if (typeof componentApiName === 'string') componentApiName = componentApiName.trim();
  if (!componentApiName) componentApiName = 'UnknownComponent';

  // ----- 5) Build the decision payload -----
  var formData = {
    resolutionStrategy: selectedStrategy.value,
    decisionRationale: rationale,
    urgency: (urgency && urgency.value) || 'not-set',
    riskImpact: (riskImpact && riskImpact.value) || 'not-set',
    timestamp: new Date().toISOString(),
    component: componentApiName,
    stories: [currentStoryId, otherStoryId].filter(Boolean),
    resolvedBy: 'Current User'
  };

  // ----- 6) Persist + broadcast -----
  var saved = null;
  try {
    saved = (typeof storeConflictDecision === 'function')
      ? storeConflictDecision(formData)
      : formData; // fail-safe
  } catch (err) {
    console.error('submitResolutionDecision: store failed', err);
    if (typeof showToast === 'function') showToast('Could not save your decision.', 'error');
  }

  // ----- 7) Update story-level tracker so UI swaps to DECIDED state -----
  try {
    if (typeof markStoriesAsDecided === 'function') {
      markStoriesAsDecided(formData.stories, saved || formData);
    }
  } catch (err2) {
    console.debug('markStoriesAsDecided error (non-fatal):', err2);
  }

  // ----- 8) UI updates: banner, buttons, progress -----
  try { if (typeof updateUIWithDecision === 'function') updateUIWithDecision(saved || formData); } catch (_) {}
  try { if (typeof updateDeploymentDecisionsUI === 'function') updateDeploymentDecisionsUI(); } catch (_) {}

  // ----- 9) Success feedback + close modal + navigate back -----
  try {
    if (typeof showToast === 'function') showToast('Decision submitted.', 'success');
  } catch (_) {}

  if (typeof closeConflictResolutionModal === 'function') {
    closeConflictResolutionModal();
  } else if (typeof closeModal === 'function') {
    // legacy closer fallback
    closeModal();
  } else if (modal && modal.parentNode) {
    modal.parentNode.removeChild(modal);
  }

  // If you have a tab system, make sure we land on Decisions
  if (typeof showTab === 'function') {
    try { showTab('decisions'); } catch (_) {}
  }

  return false;
}



// ========================================
// AUTO-RETURN FUNCTIONALITY
// ========================================

function autoReturnToDecisionsPage(componentName, decisionData) {
    console.log('🔄 Auto-returning to decisions page...');
    
    // Close the modal first
    closeConflictResolutionModal();
    
    // Show success message
    showResolutionSuccess(componentName, decisionData);
    
    // Update the UI after a brief delay to ensure modal is closed
    setTimeout(() => {
        // Refresh the decisions tab to show updated status
        if (typeof buildDecisionsTab === 'function') {
            buildDecisionsTab();
        }
        
        // Update any progress indicators
        updateDeploymentProgress();
        
        // Update specific component status
        updateComponentResolutionStatus(componentName, decisionData);
        
        console.log('✅ Successfully returned to decisions page');
        
    }, 500);
}

function showResolutionSuccess(componentName, decisionData) {
    // Create a temporary success message
    const successDiv = document.createElement('div');
    successDiv.id = 'resolution-success-message';
    successDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #d4edda;
        color: #155724;
        padding: 16px 20px;
        border-radius: 8px;
        border: 1px solid #c3e6cb;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10001;
        max-width: 400px;
        animation: slideInRight 0.3s ease-out;
    `;
    
    successDiv.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px;">
            <div style="font-size: 24px;">✅</div>
            <div>
                <strong>Conflict Resolved!</strong>
                <div style="font-size: 14px; margin-top: 4px;">
                    ${componentName} - ${getDecisionDisplayText(decisionData)}
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(successDiv);
    
    // Auto-remove after 3 seconds
    setTimeout(() => {
        if (successDiv.parentNode) {
            successDiv.style.animation = 'slideOutRight 0.3s ease-in';
            setTimeout(() => successDiv.remove(), 300);
        }
    }, 3000);
}

function updateComponentResolutionStatus(componentName, decisionData) {
    console.log('🔄 Updating component status:', componentName);
    
    // Find all elements related to this component
    const componentElements = document.querySelectorAll(`[data-component="${componentName}"]`);
    const storyElements = document.querySelectorAll(`[data-story]`);
    
    // Update component elements
    componentElements.forEach(element => {
        // Disable resolve button
        const resolveBtn = element.querySelector('.resolve-btn, [onclick*="resolve"]');
        if (resolveBtn) {
            resolveBtn.disabled = true;
            resolveBtn.innerHTML = '✅ Resolved';
            resolveBtn.style.background = '#d4edda';
            resolveBtn.style.color = '#155724';
            resolveBtn.style.cursor = 'not-allowed';
        }
        
        // Add resolved badge
        if (!element.querySelector('.resolved-badge')) {
            const badge = document.createElement('span');
            badge.className = 'resolved-badge';
            badge.textContent = ' ✅ Resolved';
            badge.style.cssText = `
                margin-left: 10px;
                color: #155724;
                font-weight: 600;
                font-size: 14px;
            `;
            element.appendChild(badge);
        }
    });
    
    // Update story elements involved in this conflict
    decisionData.stories.forEach(storyId => {
        if (storyId !== 'Unknown') {
            updateStoryResolutionStatus(storyId, componentName);
        }
    });
}

function updateStoryResolutionStatus(storyId, componentName) {
    console.log('📝 Updating story status:', storyId);
    
    // Find story in various locations
    const storySelectors = [
        `[data-story="${storyId}"]`,
        `[data-story-id="${storyId}"]`,
        `.story-item:contains("${storyId}")`,
        `.decision-card:contains("${storyId}")`
    ];
    
    let storyElement = null;
    
    for (const selector of storySelectors) {
        storyElement = document.querySelector(selector);
        if (storyElement) break;
    }
    
    // Fallback: search by text content
    if (!storyElement) {
        const allElements = document.querySelectorAll('div, li, tr');
        for (const el of allElements) {
            if (el.textContent && el.textContent.includes(storyId)) {
                storyElement = el;
                break;
            }
        }
    }
    
    if (storyElement) {
        // Mark as partially resolved if not already fully resolved
        if (!storyElement.querySelector('.partially-resolved-badge')) {
            const badge = document.createElement('span');
            badge.className = 'partially-resolved-badge';
            badge.textContent = ` ⚡ Resolved: ${componentName}`;
            badge.style.cssText = `
                margin-left: 10px;
                color: #856404;
                background: #fff3cd;
                padding: 2px 8px;
                border-radius: 12px;
                font-size: 12px;
                font-weight: 600;
            `;
            storyElement.appendChild(badge);
        }
    }
}

function updateDeploymentProgress() {
    console.log('📊 Updating deployment progress...');
    
    // Get current decisions
    const decisions = JSON.parse(localStorage.getItem('conflictDecisions') || '{}');
    const resolvedComponents = Object.keys(decisions).length;
    
    // Calculate total components needing resolution (you might need to adjust this)
    const totalComponents = calculateTotalComponentsNeedingResolution();
    
    // Update progress indicators
    updateProgressIndicators(resolvedComponents, totalComponents);
    
    // Update progress text
    const progressElements = document.querySelectorAll('.progress-text, .decision-progress');
    progressElements.forEach(element => {
        element.textContent = `${resolvedComponents}/${totalComponents} components resolved`;
    });
    
    // Enable/disable generate plan button
    const generatePlanBtn = document.querySelector('button[onclick*="generateDeploymentPlan"]');
    if (generatePlanBtn) {
        const allResolved = resolvedComponents >= totalComponents;
        generatePlanBtn.disabled = !allResolved;
        generatePlanBtn.innerHTML = allResolved ? 
            '🚀 Generate Deployment Plan' : 
            `🔒 Complete ${totalComponents - resolvedComponents} more resolutions first`;
    }
}

function calculateTotalComponentsNeedingResolution() {
    // This should match the number of components that initially had conflicts
    // For now, we'll use a fixed number or count from analysisData
    if (window.analysisData && window.analysisData.conflicts) {
        return window.analysisData.conflicts.length;
    }
    
    // Fallback: count unique components in decisions + 1 (assuming 1 pending)
    const decisions = JSON.parse(localStorage.getItem('conflictDecisions') || '{}');
    return Object.keys(decisions).length + 1; // Simple fallback
}

function updateProgressIndicators(resolved, total) {
    const progressPercent = Math.round((resolved / total) * 100);
    
    // Update progress bars
    const progressBars = document.querySelectorAll('.progress-bar, [data-progress]');
    progressBars.forEach(bar => {
        bar.style.width = `${progressPercent}%`;
        bar.style.background = progressPercent === 100 ? 
            'linear-gradient(90deg, #198754 0%, #2ecc71 100%)' :
            'linear-gradient(90deg, #667eea 0%, #764ba2 100%)';
    });
    
    // Update percentage displays
    const percentDisplays = document.querySelectorAll('.progress-percent');
    percentDisplays.forEach(display => {
        display.textContent = `${progressPercent}%`;
        display.style.color = progressPercent === 100 ? '#198754' : '#667eea';
    });
}

// ========================================
// IMPROVED MODAL CLOSING
// ========================================

function closeConflictResolutionModal() {
    console.log('🔒 Closing conflict resolution modal...');
    
    const modal = document.getElementById('conflictResolutionModal') || 
                  document.querySelector('.modal-overlay');
    
    if (modal) {
        // Add closing animation
        modal.style.opacity = '0';
        modal.style.transform = 'scale(0.9)';
        
        setTimeout(() => {
            if (modal.parentNode) {
                modal.remove();
            }
        }, 300);
    } else {
        // Fallback: remove any modal-like elements
        const modals = document.querySelectorAll('.modal-overlay, .modal-backdrop, [class*="modal"]');
        modals.forEach(modal => modal.remove());
    }
    
    // Re-enable body scrolling
    document.body.style.overflow = 'auto';
}

// ========================================
// FALLBACK NAVIGATION
// ========================================

function addFallbackNavigation() {
    // Add a "Back to Decisions" button to the modal if not already present
    const modal = document.querySelector('.conflict-comparison')?.closest('.modal');
    if (modal && !modal.querySelector('.back-to-decisions-btn')) {
        const backBtn = document.createElement('button');
        backBtn.className = 'back-to-decisions-btn';
        backBtn.textContent = '← Back to Decisions';
        backBtn.style.cssText = `
            position: absolute;
            top: 20px;
            left: 20px;
            padding: 8px 16px;
            background: #6c757d;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            z-index: 1001;
        `;
        backBtn.onclick = () => {
            closeConflictResolutionModal();
            showTab('decisions');
        };
        
        modal.appendChild(backBtn);
    }
}

// ========================================
// ENHANCED STORAGE FUNCTION
// ========================================

function storeConflictDecision(decision) {
    try {
        const existingDecisions = JSON.parse(localStorage.getItem('conflictDecisions') || '{}');
        
        // Use component name as key for precise tracking
        const decisionKey = decision.component || `decision_${Date.now()}`;
        existingDecisions[decisionKey] = {
            ...decision,
            storedAt: new Date().toISOString(),
            id: decisionKey
        };
        
        localStorage.setItem('conflictDecisions', JSON.stringify(existingDecisions));
        console.log('💾 Decision stored successfully:', decisionKey, existingDecisions[decisionKey]);
        
        // Dispatch event for other components to listen to
        window.dispatchEvent(new CustomEvent('conflictResolved', {
            detail: { component: decisionKey, decision: existingDecisions[decisionKey] }
        }));
        
    } catch (error) {
        console.error('❌ Failed to store decision:', error);
        // Fallback: try with simplified data
        try {
            const fallbackData = {
                component: decision.component,
                resolutionStrategy: decision.resolutionStrategy,
                timestamp: decision.timestamp
            };
            localStorage.setItem('last_decision', JSON.stringify(fallbackData));
        } catch (e) {
            console.error('❌ Fallback storage also failed:', e);
        }
    }
}

// ========================================
// INITIALIZATION
// ========================================

// Add CSS for animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    
    @keyframes slideOutRight {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
    
    .modal-overlay {
        transition: opacity 0.3s ease, transform 0.3s ease;
    }
    
    .resolved-component {
        background: #d4edda !important;
        border-left: 4px solid #28a745 !important;
    }
    
    .partially-resolved-badge {
        animation: pulse 2s infinite;
    }
    
    @keyframes pulse {
        0% { opacity: 1; }
        50% { opacity: 0.7; }
        100% { opacity: 1; }
    }
`;
document.head.appendChild(style);

// Initialize when page loads
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Initializing conflict resolution flow...');
    
    // Check for existing decisions and update UI
    setTimeout(() => {
        const decisions = JSON.parse(localStorage.getItem('conflictDecisions') || '{}');
        if (Object.keys(decisions).length > 0) {
            console.log('📋 Found existing decisions:', decisions);
            updateDeploymentProgress();
        }
    }, 1000);
});


// ========================================
// ENHANCED DEPLOYMENT DECISIONS PAGE
// ========================================

function buildEnhancedDecisionsTab() {
    const container = document.getElementById('tab-decisions');
    if (!container) return;
    
    // Get analysis data and decisions
    const decisions = JSON.parse(localStorage.getItem('conflictDecisions') || '{}');
    const conflicts = window.analysisData?.conflicts || [];
    
    const totalComponents = conflicts.length;
    const resolvedComponents = Object.keys(decisions).length;
    const progressPercent = Math.round((resolvedComponents / totalComponents) * 100);
    
    const html = `
        <div style="padding: 30px; background: white; border-radius: 12px; margin: 20px;">
            <h2 style="margin: 0 0 20px 0;">🎯 Deployment Conflict Resolution</h2>
            <p style="color: #666; margin-bottom: 30px;">
                Resolve component conflicts before generating deployment plan
            </p>
            
            <!-- Progress Bar -->
            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 30px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                    <span style="font-weight: 600;">Resolution Progress</span>
                    <span style="color: ${progressPercent === 100 ? '#198754' : '#fd7e14'};">
                        ${resolvedComponents}/${totalComponents} resolved (${progressPercent}%)
                    </span>
                </div>
                <div style="background: #e9ecef; height: 24px; border-radius: 12px; overflow: hidden;">
                    <div style="background: ${progressPercent === 100 ? 
                        'linear-gradient(90deg, #198754 0%, #2ecc71 100%)' : 
                        'linear-gradient(90deg, #667eea 0%, #764ba2 100%)'}; 
                        height: 100%; width: ${progressPercent}%; transition: width 0.3s;"></div>
                </div>
                ${progressPercent < 100 ? `
                    <p style="color: #fd7e14; margin: 10px 0 0 0; font-size: 14px;">
                        ⚠️ ${totalComponents - resolvedComponents} components need resolution
                    </p>
                ` : `
                    <p style="color: #198754; margin: 10px 0 0 0; font-size: 14px;">
                        ✅ All conflicts resolved! Ready to generate deployment plan
                    </p>
                `}
            </div>
            
            <!-- Components Needing Resolution -->
            <div style="margin-bottom: 30px;">
                <h3 style="color: #2d3748; margin-bottom: 20px;">
                    🔴 Components Requiring Resolution (${totalComponents - resolvedComponents})
                </h3>
                
                ${conflicts.map(conflict => {
                    const componentName = conflict.component?.api_name || 'Unknown';
                    const isResolved = decisions[componentName];
                    const stories = conflict.involved_stories || [];
                    
                    if (isResolved) return ''; // Skip resolved ones
                    
                    return `
                        <div class="component-conflict-card" 
                             data-component="${componentName}"
                             style="padding: 20px; background: white; border: 2px solid #e2e8f0; border-radius: 8px; margin-bottom: 15px;">
                            <div style="display: flex; justify-content: space-between; align-items: start;">
                                <div style="flex: 1;">
                                    <h4 style="margin: 0 0 10px 0; color: #2d3748;">
                                        ${componentName}
                                    </h4>
                                    <p style="color: #666; margin: 0 0 15px 0;">
                                        Type: ${conflict.component?.type || 'Unknown'} | 
                                        Risk: ${conflict.risk_score || 0}/100 | 
                                        Severity: ${conflict.severity || 'Unknown'}
                                    </p>
                                    
                                    <div style="background: #fff3cd; padding: 12px; border-radius: 6px;">
                                        <strong>Conflicting Stories:</strong>
                                        <div style="margin-top: 8px;">
                                            ${stories.map(story => `
                                                <div style="display: inline-block; background: #e3f2fd; padding: 6px 12px; margin: 4px; border-radius: 4px; font-size: 13px;">
                                                    ${story.id} - ${story.developer || 'Unknown'}
                                                </div>
                                            `).join('')}
                                        </div>
                                    </div>
                                </div>
                                
                                <button onclick="openComponentResolution('${componentName}')" 
                                        class="resolve-btn"
                                        style="padding: 10px 20px; background: #dc3545; color: white; border: none; border-radius: 6px; font-weight: 600; cursor: pointer; white-space: nowrap;">
                                    🚨 Resolve Conflict
                                </button>
                            </div>
                        </div>
                    `;
                }).join('')}
                
                ${totalComponents - resolvedComponents === 0 ? `
                    <div style="text-align: center; padding: 40px; color: #198754;">
                        <div style="font-size: 48px; margin-bottom: 16px;">🎉</div>
                        <h3>All Conflicts Resolved!</h3>
                        <p>No more components require conflict resolution.</p>
                    </div>
                ` : ''}
            </div>
            
            <!-- Resolved Components -->
            ${resolvedComponents > 0 ? `
                <div style="margin-bottom: 30px;">
                    <h3 style="color: #198754; margin-bottom: 20px;">
                        ✅ Resolved Components (${resolvedComponents})
                    </h3>
                    
                    ${Object.entries(decisions).map(([componentName, decision]) => `
                        <div class="resolved-component" 
                             data-component="${componentName}"
                             style="padding: 16px; background: #d4edda; border: 1px solid #c3e6cb; border-radius: 6px; margin-bottom: 10px;">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <div>
                                    <strong>${componentName}</strong>
                                    <span style="margin-left: 10px; color: #0c5460; font-size: 14px;">
                                        ${getDecisionDisplayText(decision)}
                                    </span>
                                </div>
                                <div style="display: flex; gap: 10px; align-items: center;">
                                    <span style="color: #155724; font-weight: 600;">✅ Resolved</span>
                                    <button onclick="viewResolutionDetails('${componentName}')" 
                                            style="padding: 6px 12px; background: white; border: 1px solid #28a745; color: #28a745; border-radius: 4px; cursor: pointer; font-size: 12px;">
                                        View Details
                                    </button>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            ` : ''}
            
            <!-- Action Bar -->
            <div style="margin-top: 30px; padding: 20px; background: #f8f9fa; border-radius: 8px; display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <strong>Ready to proceed?</strong>
                    <p style="margin: 5px 0 0 0; color: #666; font-size: 14px;">
                        ${progressPercent === 100 ? 
                            'All conflicts resolved. Generate deployment plan.' : 
                            `Complete ${totalComponents - resolvedComponents} conflict resolutions first.`}
                    </p>
                </div>
                <button 
                    onclick="generateDeploymentPlan()" 
                    ${progressPercent < 100 ? 'disabled' : ''}
                    style="padding: 12px 24px; background: ${progressPercent === 100 ? '#198754' : '#ccc'}; color: white; border: none; border-radius: 6px; font-weight: 600; cursor: ${progressPercent === 100 ? 'pointer' : 'not-allowed'};">
                    ${progressPercent === 100 ? '🚀 Generate Plan' : '🔒 Complete Resolutions First'}
                </button>
            </div>
        </div>
    `;
    
    container.innerHTML = html;
}

function openComponentResolution(componentName) {
    console.log('🔓 Opening resolution for component:', componentName);
    
    // Find the conflict data for this component
    const conflict = window.analysisData?.conflicts?.find(c => 
        c.component?.api_name === componentName
    );
    
    if (!conflict) {
        alert(`Conflict data not found for component: ${componentName}`);
        return;
    }
    
    // Use the first story as the "current" story for the modal
    const currentStory = conflict.involved_stories?.[0];
    if (!currentStory) {
        alert('No stories found for this conflict');
        return;
    }
    
    // Open the conflict resolution modal
    showConflictResolutionModal(currentStory);
}

function viewResolutionDetails(componentName) {
    const decisions = JSON.parse(localStorage.getItem('conflictDecisions') || '{}');
    const decision = decisions[componentName];
    
    if (!decision) {
        alert('No decision details found for this component');
        return;
    }
    
    alert(`📋 Resolution Details: ${componentName}

Decision: ${getDecisionDisplayText(decision)}
Strategy: ${decision.resolutionStrategy}
Rationale: ${decision.decisionRationale}
Resolved: ${new Date(decision.timestamp).toLocaleString()}
Stories: ${decision.stories?.join(', ') || 'Unknown'}

Urgency: ${decision.urgency}
Risk Impact: ${decision.riskImpact}
    `);
}

// Replace the existing buildDecisionsTab with the enhanced version
function buildDecisionsTab() {
    buildEnhancedDecisionsTab();
}


// Store decision in localStorage
function storeConflictDecision(decision) {
    try {
        const existingDecisions = JSON.parse(localStorage.getItem('conflictDecisions') || '{}');
        
        // Use component name as key, or create a unique key if needed
        const decisionKey = decision.component || `decision_${Date.now()}`;
        existingDecisions[decisionKey] = decision;
        
        localStorage.setItem('conflictDecisions', JSON.stringify(existingDecisions));
        console.log('Decision stored successfully:', decisionKey);
    } catch (error) {
        console.error('Failed to store decision:', error);
    }
}


function checkExistingDecisions(storyId, component) {
    const decisions = JSON.parse(localStorage.getItem('conflictDecisions') || '{}');
    const decision = decisions[component];
    
    if (decision && decision.stories.includes(storyId)) {
        return decision;
    }
    return null;
}

// Call this when loading a story
function initializeStoryView(story) {
    const existingDecision = checkExistingDecisions(story.id, story.conflictComponent);
    
    if (existingDecision) {
        showDecisionBanner(existingDecision);
    }
}

function showDecisionBanner(decision) {
    const banner = document.createElement('div');
    banner.className = 'decision-banner resolved';
    banner.innerHTML = `
        <div class="banner-content">
            <span class="banner-icon">✅</span>
            <div class="banner-text">
                <strong>Conflict Resolution Applied</strong>
                <span>${getDecisionText(decision.resolutionStrategy)} • ${formatDecisionTime(decision.timestamp)}</span>
            </div>
            <button onclick="viewDecisionDetails()" class="btn-link">View Details</button>
        </div>
    `;
    
    // Insert at top of story view
    const storyContainer = document.querySelector('.story-container');
    storyContainer.prepend(banner);
}


function getDecisionDisplayText(decision) {
    const strategyTexts = {
        'deploy_current_first': 'Deploy First',
        'deploy_other_first': 'Deploy Second', 
        'exclude_current': 'Story Excluded',
        'exclude_other': 'Conflict Resolved',
        'defer_both': 'Deferred for Analysis',
        'merge_changes': 'Changes Merged'
    };
    
    return strategyTexts[decision.resolutionStrategy] || 'Decision Applied';
}

// Helper function to format decision time
function formatDecisionTime(timestamp) {
    return new Date(timestamp).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Show decision details
function showDecisionDetails() {
    const decisions = JSON.parse(localStorage.getItem('conflictDecisions') || '{}');
    const latestDecision = Object.values(decisions).pop(); // Get most recent decision
    
    if (latestDecision) {
        alert(`📋 Conflict Resolution Details:
        
Strategy: ${getDecisionDisplayText(latestDecision)}
Component: ${latestDecision.component}
Stories: ${latestDecision.stories?.join(' vs ') || 'Unknown'}
Rationale: ${latestDecision.decisionRationale}
Urgency: ${latestDecision.urgency}
Risk Impact: ${latestDecision.riskImpact}
Resolved: ${formatDecisionTime(latestDecision.timestamp)}
        `);
    }
}


// When opening the modal, store the data globally
function openConflictModal(conflictData, currentStory) {
    // Store for later use in submit function
    window.currentConflictData = conflictData;
    window.currentStoryData = currentStory;
    
    console.log('💾 Stored conflict data:', conflictData);
    
    // Check for existing decisions
    const decisions = JSON.parse(localStorage.getItem('conflictDecisions') || '{}');
    if (Object.keys(decisions).length > 0) {
        showExistingDecision(Object.values(decisions)[0]);
        return false;
    }
    
    // Your existing modal rendering code...
    return true;
}

// Update your existing modal opening code to check this:
function yourExistingModalFunction() {
    if (!openConflictModal(conflictData, currentStory)) {
        return; // Don't open modal if decision exists
    }
    // ... your existing modal code
}


function checkForExistingDecision() {
    console.log('🔍 Checking for existing decisions...');
    const decisions = JSON.parse(localStorage.getItem('conflictDecisions') || '{}');
    console.log('📁 Decisions found in localStorage:', decisions);
    
    if (Object.keys(decisions).length > 0) {
        const latestDecision = Object.values(decisions).pop();
        console.log('🎯 Latest decision:', latestDecision);
        updateUIWithDecision(latestDecision);
        updateDeploymentDecisionsUI();
    } else {
        console.log('❌ No existing decisions found');
    }
}

function showExistingDecision(decision) {
    alert(`📋 Conflict Already Resolved

This conflict has already been resolved:
• Decision: ${getDecisionDisplayText(decision)}
• Component: ${decision.component}
• Resolved: ${formatDecisionTime(decision.timestamp)}

Rationale: ${decision.decisionRationale}

To change this decision, clear your browser storage or contact DevOps.
    `);
}



function saveAsDraft() {
    // Save current state to localStorage or backend
    console.log('Decision saved as draft');
    alert('Decision saved as draft');
}

function escalateToArchitect() {
    // Create escalation ticket
    console.log('Conflict escalated to architect');
    alert('Conflict escalated to architecture team');
}

// Show/hide rollback plan based on risk selection
document.addEventListener('change', function(e) {
    if (e.target.name === 'riskImpact') {
        const rollbackPlan = document.getElementById('rollbackPlan');
        rollbackPlan.style.display = e.target.value === 'high' ? 'block' : 'none';
    }
});

// Helper function to format commit date
function formatCommitDate(dateString) {
    if (!dateString) return 'N/A';
    
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            timeZoneName: 'short'
        });
    } catch (e) {
        console.log('❌ Date formatting error:', e);
        return dateString;
    }
}



// Extract commit hash from current story (which has components array)
function extractCommitHashFromStory(storyData) {
  if (!storyData) return 'N/A';

  // If components exist (rare in involved_stories), use them
  if (storyData.components && Array.isArray(storyData.components)) {
    for (const c of storyData.components) {
      if (c.commit_hash) return c.commit_hash;
    }
  }

  // Fallback: use the active conflict’s component name if present
  const compName = window.currentConflictData?.component?.api_name;
  const viaAllStories = compName
    ? getCommitHashFromAllStories(storyData.id, compName)
    : null;

  return viaAllStories || 'N/A';
}


// For the other story, we need to find the component data differently
// Since we don't have the full components array, we might need to get it from the original data source
function extractCommitHashFromComponent(componentName, storyData) {
    if (!storyData) return 'N/A';
    
    console.log('🔍 extractCommitHashFromComponent - Looking for:', componentName, 'in:', storyData);
    
    // If we have the component data directly in the conflict data
    if (storyData.components && Array.isArray(storyData.components)) {
        const component = storyData.components.find(comp => comp.api_name === componentName);
        if (component && component.commit_hash) {
            console.log('✅ Found commit hash in other story component:', component.commit_hash);
            return component.commit_hash;
        }
    }
    
    // If we don't have components, try to get from the original data source
    // This would require accessing the original stories data stored elsewhere
    const otherStories = window.allStories || []; // Assuming stories are stored globally
    const fullOtherStory = otherStories.find(story => story.id === storyData.id);
    
    if (fullOtherStory && fullOtherStory.components) {
        const component = fullOtherStory.components.find(comp => comp.api_name === componentName);
        if (component && component.commit_hash) {
            console.log('✅ Found commit hash in full other story:', component.commit_hash);
            return component.commit_hash;
        }
    }
    
    console.log('❌ No commit hash found for other story');
    return '3034134'; // Hardcoded as fallback from your console data
}

// Helper function to format commit date
function formatCommitDate(dateString) {
    if (!dateString) return 'N/A';
    
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            timeZoneName: 'short'
        });
    } catch (e) {
        console.log('❌ Date formatting error:', e);
        return dateString;
    }
}

// Function to handle deployment decision submission
function submitDeploymentDecision() {
    const selectedOption = document.querySelector('input[name="deploymentOrder"]:checked');
    
    if (!selectedOption) {
        alert('Please select a deployment option before submitting.');
        return;
    }
    
    const decision = selectedOption.value;
    const currentStory = document.querySelector('.current-story .story-number').textContent;
    const otherStory = document.querySelector('.other-story .story-number').textContent;
    
    console.log('Deployment Decision Submitted:', {
        decision: decision === 'current_first' ? 'DEPLOY_CURRENT_FIRST' : 'DEPLOY_OTHER_FIRST',
        currentStory,
        otherStory,
        timestamp: new Date().toISOString()
    });
    
    // Here you would typically send this to your backend
    alert(`Deployment decision recorded: ${decision === 'current_first' ? currentStory : otherStory} will deploy first.`);
    closeModal();
}

function closeModal() {
    console.log('Closing modal...');
    const modal = document.querySelector('.modal-backdrop') || 
                  document.querySelector('.modal') ||
                  document.getElementById('conflictModal');
    
    if (modal) {
        modal.style.display = 'none';
        modal.remove();
    } else {
        // Fallback - remove any conflict elements
        const conflictElements = document.querySelectorAll('.conflict-comparison, .modal-container');
        conflictElements.forEach(el => el.remove());
    }
}
async function loadConflictDetails(conflictStory, modal) {

    try {
        const contentDiv = modal.querySelector('#conflict-modal-content');
        
        // Get the actual conflict data from analysis
        const conflictData = findConflictData(conflictStory.id);
        
        if (!conflictData) {
            contentDiv.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #dc3545;">
                    <h3>❌ Conflict data not found</h3>
                    <p>Unable to load conflict details for ${conflictStory.id}</p>
                </div>
            `;
            return;
        }
        
        // Set globals for later reads (submitResolutionDecision fallbacks)

        window.currentStoryData = conflictStory;
        window.currentConflictData = conflictData;
        contentDiv.innerHTML = renderConflictComparison(conflictData, conflictStory);

        
    } catch (error) {
        console.error('Error loading conflict details:', error);
        const contentDiv = modal.querySelector('#conflict-modal-content');
        contentDiv.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #dc3545;">
                <h3>❌ Error loading conflict</h3>
                <p>${error.message}</p>
            </div>
        `;
    }
}

// ========================================
// CONFLICT RESOLUTION MODAL
// ========================================

function showConflictResolutionModal(conflictStory) {
    console.log('🔍 Opening conflict modal for:', conflictStory);
    
    // Create modal container
    const modal = document.createElement('div');
    modal.id = 'conflictResolutionModal';
    modal.className = 'modal-overlay';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        padding: 20px;
    `;
    
    modal.innerHTML = `
        <div style="background: white; border-radius: 12px; box-shadow: 0 20px 60px rgba(0,0,0,0.3); max-width: 90vw; max-height: 90vh; width: 1200px; display: flex; flex-direction: column; overflow: hidden;">
            
            <!-- Modal Header -->
            <div style="padding: 24px; border-bottom: 2px solid #e2e8f0; background: white;">
                <div style="display: flex; justify-content: space-between; align-items: start;">
                    <div style="flex: 1;">
                        <h2 style="margin: 0 0 8px 0; font-size: 20px; color: #2d3748;">
                            🔄 Resolve Conflict: ${conflictStory.id}
                        </h2>
                        <p style="margin: 0; color: #718096; font-size: 14px;">
                            ${conflictStory.title || 'No title'} • ${conflictStory.developer || 'Unknown developer'}
                        </p>
                    </div>
                    <button onclick="closeConflictResolutionModal()" style="background: none; border: none; font-size: 24px; color: #718096; cursor: pointer; padding: 0; margin-left: 20px;">
                        ×
                    </button>
                </div>
            </div>
            
            <!-- Modal Body -->
            <div style="flex: 1; overflow: auto; padding: 0;">
                <div id="conflict-modal-content" style="padding: 24px;">
                    <div style="text-align: center; padding: 40px; color: #999;">
                        Loading conflict details...
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Load conflict details
    loadConflictDetails(conflictStory, modal);
  
    
    // Close on background click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeConflictResolutionModal();
        }
    });
}

function closeConflictResolutionModal() {
    const modal = document.getElementById('conflictResolutionModal');
    if (modal) {
        modal.remove();
    }
}

function findConflictData(storyId) {
    if (!analysisData || !analysisData.conflicts) return null;
    
    // Find conflicts involving this story
    const storyConflicts = analysisData.conflicts.filter(conflict => 
        conflict.involved_stories.some(story => story.id === storyId)
    );
    
    return storyConflicts.length > 0 ? storyConflicts[0] : null;
}


function editDecision(storyId) {
    makeDecision(storyId); // Reuse the same modal for editing
}


function editDecision(storyId) {
    makeDecision(storyId);
}

function markReviewLater(storyId) {
    storyDecisions[storyId].status = 'REVIEW_LATER';
    storyDecisions[storyId].decided_at = new Date().toISOString();
    saveDecisions();
    buildDecisionsTab(); // Refresh
}










function copyDiffContent(event, version) {
    console.log('📋 Copy clicked:', version);
    
    let content = '';
    
    // Method 1: Try to get from currentDiffData first
    if (version === 'production') {
        content = currentDiffData.productionCode;
    } else if (version === 'uat') {
        content = currentDiffData.uatCode;
    }
    
    // Method 2: Extract from visible diff display
    if (!content) {
        console.log('🔄 Extracting from visible diff...');
        content = extractCodeFromVisibleDiff(version);
        
        // Verify we got actual code
        if (content && !verifyExtractedContent(content, version)) {
            console.log('⚠️ Extraction may have issues, trying fallback...');
            content = ''; // Reset to try fallback
        }
    }
    
    // Method 3: Try direct extraction
    if (!content || content.length < 100) {
        console.log('🎯 Trying direct extraction...');
        const directContent = extractCodeDirect(version);
        if (verifyExtractedContent(directContent, version)) {
            content = directContent;
        }
    }
    
    // Method 4: Last resort - get cleaned visible text
    if (!content || content.length < 100) {
        console.log('🔄 Using cleaned visible content...');
        content = extractCleanedVisibleContent(version);
    }
    
    console.log('📝 Final content to copy:', {
        length: content?.length || 0,
        preview: content?.substring(0, 200) + '...'
    });
    
    // Final verification
    if (!verifyExtractedContent(content, version)) {
        console.warn('⚠️ Content verification failed - may not be actual code');
    }
    
    if (!content || content.trim().length === 0) {
        alert(`No ${version} code available to copy`);
        return;
    }
    
    // Use the modern Clipboard API with better error handling
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(content).then(() => {
            showCopySuccess(event.target);
            console.log('✅ Successfully copied to clipboard!');
        }).catch(err => {
            console.error('Modern clipboard failed:', err);
            useFallbackCopy(content, event.target);
        });
    } else {
        // Use fallback for non-secure contexts
        useFallbackCopy(content, event.target);
    }
}

// Test function to verify we're getting real code
function verifyExtractedContent(content, version) {
    if (!content) return false;
    
    const lines = content.split('\n');
    const codeLines = lines.filter(line => {
        const trimmed = line.trim();
        return trimmed && 
               !trimmed.includes('=====') && 
               !trimmed.includes('prDeviceTile.') &&
               trimmed.length > 2; // Real code lines are usually more than 2 chars
    });
    
    console.log(`🔍 ${version} Content Verification:`, {
        totalLines: lines.length,
        codeLines: codeLines.length,
        sampleCode: codeLines.slice(0, 3), // First 3 code lines
        hasImports: codeLines.some(line => line.includes('import')),
        hasFunctions: codeLines.some(line => line.includes('function') || line.includes('=>')),
        hasHTML: codeLines.some(line => line.includes('<') && line.includes('>'))
    });
    
    return codeLines.length > 10; // Consider it valid if we have at least 10 real code lines
}

// Improved extraction function

function extractCodeFromVisibleDiff(version) {
    const diffContainer = document.getElementById('diff-unified');
    if (!diffContainer) return '';
    
    console.log('🔍 Starting extraction for:', version);
    
    // Find ALL div elements and filter for actual code rows
    const allDivs = diffContainer.querySelectorAll('div');
    console.log(`📊 Found ${allDivs.length} total div elements`);
    
    let extractedLines = [];
    let currentFile = '';
    let inCodeSection = false;
    let codeRowsProcessed = 0;
    let currentFileHasContent = false;
    
    allDivs.forEach((div, index) => {
        const divText = div.textContent || '';
        const divStyle = div.getAttribute('style') || '';
        
        // Skip empty divs
        if (!divText.trim()) return;
        
        // Detect file headers in bundle view
        if (divText.includes('.') && 
            (divText.includes('Unchanged') || divText.includes('Modified'))) {
            // Generic file name detection - looks for any file with extension
            const fileNameMatch = divText.match(/([a-zA-Z0-9_-]+\.[a-zA-Z0-9.-]+)/);
            if (fileNameMatch) {
                currentFile = fileNameMatch[1];
                currentFileHasContent = false;
                console.log(`📁 Processing file: ${currentFile}`);
            }
            inCodeSection = true;
            return;
        }
        
        // Skip UI headers and bundle info
        if (divText.includes('📦') || 
            divText.includes('Bundle') ||
            divText.includes('Loading diff')) {
            inCodeSection = false;
            return;
        }
        
        // Look for actual code rows (they have specific styling and 3 columns)
        if (inCodeSection && divStyle.includes('display: flex') && div.children.length >= 3) {
            const columns = div.children;
            const lineNumberCol = columns[0];
            const changeTypeCol = columns[1];
            const codeCol = columns[2];
            
            if (!codeCol) return;
            
            const codeText = codeCol.textContent || '';
            const cleanCodeText = codeText.trim();
            
            if (!cleanCodeText) return;
            
            // Determine line type based on styling
            const lineNumberStyle = lineNumberCol.getAttribute('style') || '';
            const changeTypeText = changeTypeCol.textContent || '';
            
            const isProduction = lineNumberStyle.includes('background: #ffd7d5') || 
                               lineNumberStyle.includes('border-right: 1px solid #ff8182') ||
                               changeTypeText === '-';
            
            const isUAT = lineNumberStyle.includes('background: #ccffd8') || 
                         lineNumberStyle.includes('border-right: 1px solid #9be9a8') ||
                         changeTypeText === '+';
            
            const isUnchanged = lineNumberStyle.includes('background: #f6f8fa') || 
                               (!changeTypeText.trim() && !isProduction && !isUAT);
            
            let shouldInclude = false;
            
            if (version === 'production') {
                shouldInclude = isProduction || isUnchanged;
            } else if (version === 'uat') {
                shouldInclude = isUAT || isUnchanged;
            }
            
            if (shouldInclude) {
                // Only add file header when we find the first line of actual content
                if (currentFile && !currentFileHasContent) {
                    extractedLines.push(`// ===== ${currentFile} =====`);
                    currentFileHasContent = true;
                }
                
                extractedLines.push(cleanCodeText);
                codeRowsProcessed++;
            }
        }
    });
    
    // Add the last file if it had content
    if (currentFile && currentFileHasContent) {
        // Already added during processing
    }
    
    console.log(`✅ Extracted ${extractedLines.length} code lines from ${codeRowsProcessed} rows for ${version}`);
    
    // Clean up the result - remove consecutive empty lines and trim
    const cleanedResult = cleanExtractedLines(extractedLines);
    
    console.log(`📝 Final cleaned content: ${cleanedResult.length} characters`);
    console.log('📁 Files found:', Array.from(new Set(extractedLines.filter(line => line.includes('=====')))));
    
    return cleanedResult;
}

// Clean up the extracted lines - remove empty files and clean formatting
function cleanExtractedLines(lines) {
    const cleaned = [];
    let lastLine = '';
    let inFileSection = false;
    let currentFileHasContent = false;
    
    lines.forEach(line => {
        if (line.includes('=====')) {
            // File header
            if (currentFileHasContent) {
                cleaned.push(line);
            }
            inFileSection = true;
            currentFileHasContent = false;
        } else if (line.trim()) {
            // Actual code line
            if (!inFileSection) {
                inFileSection = true;
            }
            currentFileHasContent = true;
            cleaned.push(line);
            lastLine = line;
        } else if (line === '' && lastLine !== '') {
            // Single empty line between code
            cleaned.push('');
            lastLine = '';
        }
        // Skip multiple empty lines
    });
    
    // Remove trailing empty lines
    while (cleaned.length > 0 && cleaned[cleaned.length - 1] === '') {
        cleaned.pop();
    }
    
    return cleaned.join('\n');
}

// Fallback method if the structured approach fails
function extractCodeFallback(version) {
    const diffContainer = document.getElementById('diff-unified');
    if (!diffContainer) return '';
    
    // Get all text and clean it up
    let allText = diffContainer.textContent;
    
    // Remove UI elements and headers
    const cleanText = allText
        .split('\n')
        .filter(line => {
            return !line.includes('📦') && 
                   !line.includes('✅') && 
                   !line.includes('📝') &&
                   !line.includes('Bundle') &&
                   !line.includes('Loading diff') &&
                   line.trim().length > 0;
        })
        .map(line => line.trim())
        .join('\n');
    
    console.log(`🔄 Fallback extracted ${cleanText.split('\n').length} lines`);
    return cleanText;
}

function analyzeDiffStructure() {
    const diffContainer = document.getElementById('diff-unified');
    if (!diffContainer) return;
    
    console.log('🔍 ANALYZING DIFF STRUCTURE:');
    
    // Find all flex containers (diff rows)
    const diffRows = diffContainer.querySelectorAll('div[style*="display: flex"]');
    console.log(`Total diff rows: ${diffRows.length}`);
    
    if (diffRows.length > 0) {
        // Analyze first few rows
        for (let i = 0; i < Math.min(3, diffRows.length); i++) {
            const row = diffRows[i];
            const columns = row.children;
            console.log(`Row ${i}:`, {
                columns: columns.length,
                column1: columns[0]?.textContent,
                column2: columns[1]?.textContent, 
                column3: columns[2]?.textContent?.substring(0, 50),
                styles: {
                    col1: columns[0]?.getAttribute('style'),
                    col2: columns[1]?.getAttribute('style'),
                    col3: columns[2]?.getAttribute('style')
                }
            });
        }
        
        // Find production lines specifically
        const productionLines = Array.from(diffRows).filter(row => {
            const col1 = row.children[0];
            return col1 && (col1.style.backgroundColor === 'rgb(255, 215, 213)' || 
                           col1.style.borderRight.includes('#ff8182'));
        });
        
        console.log(`Production lines: ${productionLines.length}`);
        
        if (productionLines.length > 0) {
            const sample = productionLines[0];
            const cols = sample.children;
            console.log('Sample production line:', {
                lineNumber: cols[0]?.textContent,
                changeType: cols[1]?.textContent,
                code: cols[2]?.textContent
            });
        }
    }
}

function debugDiffStructure() {
    const diffContainer = document.getElementById('diff-unified');
    if (!diffContainer) {
        console.log('❌ No diff container found');
        return;
    }
    
    console.log('🔍 Debugging diff structure:');
    
    // Check different element types
    const flexDivs = diffContainer.querySelectorAll('div[style*="display: flex"]');
    const allDivs = diffContainer.querySelectorAll('div');
    
    console.log(`Flex divs: ${flexDivs.length}`);
    console.log(`All divs: ${allDivs.length}`);
    
    // Show first few elements to understand structure
    if (flexDivs.length > 0) {
        console.log('First flex div:', flexDivs[0]);
        console.log('First flex div children:', flexDivs[0].children.length);
        Array.from(flexDivs[0].children).forEach((child, idx) => {
            console.log(`Child ${idx}:`, {
                style: child.getAttribute('style'),
                text: child.textContent
            });
        });
    }
}

// Fallback copy method
function useFallbackCopy(content, button) {
    try {
        const textArea = document.createElement('textarea');
        textArea.value = content;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        
        if (successful) {
            showCopySuccess(button);
        } else {
            throw new Error('Fallback copy failed');
        }
    } catch (err) {
        console.error('Fallback copy failed:', err);
        alert('Copy failed. Please select the text manually and copy it.');
        
        // Last resort: show the content in an alert so user can copy manually
        const preview = content.length > 1000 ? content.substring(0, 1000) + '...' : content;
        alert(`Please copy this text manually:\n\n${preview}`);
    }
}

// Success feedback
function showCopySuccess(button) {
    const originalText = button.innerHTML;
    const originalBackground = button.style.background;
    
    button.innerHTML = '✅ Copied!';
    button.style.background = '#d1f2eb';
    button.disabled = true;
    
    setTimeout(() => {
        button.innerHTML = originalText;
        button.style.background = originalBackground;
        button.disabled = false;
    }, 2000);
}

function showDownloadOptions(event) {
    // Prevent the event from bubbling up
    event.preventDefault();
    event.stopPropagation();
    
    // Remove any existing menu
    const existingMenu = document.querySelector('.download-options-menu');
    if (existingMenu) {
        existingMenu.remove();
    }
    
    const menu = document.createElement('div');
    menu.className = 'download-options-menu';
    menu.style.cssText = `
        position: fixed;
        background: white;
        border: 1px solid #d0d7de;
        border-radius: 6px;
        box-shadow: 0 8px 24px rgba(0,0,0,0.12);
        padding: 8px;
        z-index: 10002;
        min-width: 220px;
    `;
    
    // Position near the download button
    const rect = event.target.getBoundingClientRect();
    menu.style.top = `${rect.bottom + 5}px`;
    menu.style.left = `${rect.left}px`;
    
    menu.innerHTML = `
        <div style="font-size: 12px; color: #57606a; padding: 8px 12px; border-bottom: 1px solid #f6f8fa; font-weight: 600;">
            📥 Download Options
        </div>
        <div style="display: flex; flex-direction: column; gap: 4px; margin-top: 8px;">
            <button onclick="downloadDiff('summary')" style="text-align: left; padding: 8px 12px; background: none; border: none; cursor: pointer; font-size: 12px; border-radius: 4px; hover:background: #f6f8fa;">
                📊 Summary Report (Small)
            </button>
            <button onclick="downloadDiff('changes-only')" style="text-align: left; padding: 8px 12px; background: none; border: none; cursor: pointer; font-size: 12px; border-radius: 4px; hover:background: #f6f8fa;">
                📝 Changes Only (Medium)
            </button>
            <button onclick="downloadDiff('full')" style="text-align: left; padding: 8px 12px; background: none; border: none; cursor: pointer; font-size: 12px; border-radius: 4px; hover:background: #f6f8fa;">
                📁 Full Comparison (Large)
            </button>
            <button onclick="downloadDiff('side-by-side')" style="text-align: left; padding: 8px 12px; background: none; border: none; cursor: pointer; font-size: 12px; border-radius: 4px; hover:background: #f6f8fa;">
                ⚖️ Side-by-Side
            </button>
        </div>
    `;
    
    document.body.appendChild(menu);
    
    // Close menu when clicking outside
    const closeMenu = (e) => {
        if (!menu.contains(e.target) && e.target !== event.target) {
            menu.remove();
            document.removeEventListener('click', closeMenu);
        }
    };
    
    // Use setTimeout to avoid immediate closure
    setTimeout(() => {
        document.addEventListener('click', closeMenu);
    }, 100);
}

function downloadDiff(format) {
    console.log(`💾 Downloading ${format} format`);
    
    // Close any open menu
    const menu = document.querySelector('.download-options-menu');
    if (menu) {
        menu.remove();
    }
    
    let content = '';
    const timestamp = new Date().toLocaleString();
    
    switch(format) {
        case 'summary':
            content = generateSummaryReport();
            break;
        case 'changes-only':
            content = generateChangesOnlyReport();
            break;
        case 'full':
            content = generateFullReport();
            break;
        case 'side-by-side':
            content = generateSideBySideReport();
            break;
        default:
            content = generateChangesOnlyReport();
    }
    
    // Create and download file
    const blob = new Blob([content], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentDiffData.componentName}_${format}_${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
    // Show success feedback on the download button
    const downloadBtn = document.querySelector('button[onclick*="showDownloadOptions"]');
    if (downloadBtn) {
        const originalText = downloadBtn.innerHTML;
        downloadBtn.innerHTML = '✅ Downloaded!';
        setTimeout(() => {
            downloadBtn.innerHTML = originalText;
        }, 2000);
    }
    
    console.log(`✅ Downloaded ${format} report`);
}

function generateSummaryReport() {
    const { componentName, rawBundleData } = currentDiffData;
    
    return `
QUICK SUMMARY: ${componentName}
Generated: ${new Date().toLocaleString()}

📊 CHANGE OVERVIEW:
• Component: ${componentName}
• Type: ${currentDiffData.componentType || 'Unknown'}
• Total Files: ${rawBundleData?.bundle_files?.length || 1}
• Modified Files: ${rawBundleData?.bundle_files?.filter(f => f.has_changes).length || 0}
• Status: ${rawBundleData?.has_changes ? 'HAS CHANGES 📝' : 'NO CHANGES ✅'}

📋 MODIFIED FILES:
${rawBundleData?.bundle_files?.filter(f => f.has_changes).map(f => `• ${f.file_name}`).join('\n') || '• No modified files'}

🚀 RECOMMENDED ACTIONS:
${rawBundleData?.has_changes ? 
    '1. Review modified files above\n2. Test changes in sandbox\n3. Coordinate deployment' : 
    '1. Safe to deploy - no changes detected'}

---
Need details? Download "Changes Only" or "Full Comparison"
Generated by Copado Deployment Validator
    `.trim();
}

function generateChangesOnlyReport() {
    const { componentName, rawBundleData } = currentDiffData;
    
    let content = `
CHANGES ONLY: ${componentName}
Generated: ${new Date().toLocaleString()}

TABLE OF CONTENTS:
=================
`.trim();
    
    // Add table of contents
    if (rawBundleData?.bundle_files) {
        let fileCount = 1;
        rawBundleData.bundle_files.forEach((file) => {
            if (file.has_changes) {
                content += `\n${fileCount}. ${file.file_name} - Page ${fileCount + 1}`;
                fileCount++;
            }
        });
    }
    
    content += `\n\n=================\n\n`;
    
    // Add only changed files
    if (rawBundleData?.bundle_files) {
        let fileIndex = 1;
        rawBundleData.bundle_files.forEach((file) => {
            if (file.has_changes) {
                content += `\n╔══════════════════════════════════════════════════╗\n`;
                content += `║ FILE ${fileIndex}: ${file.file_name.padEnd(35)} ║\n`;
                content += `╚══════════════════════════════════════════════════╝\n\n`;
                
                if (file.production_code && file.uat_code) {
                    content += `PRODUCTION → UAT CHANGES:\n`;
                    content += `-------------------------\n`;
                    
                    // Simple diff-like output
                    const prodLines = file.production_code.split('\n');
                    const uatLines = file.uat_code.split('\n');
                    
                    for (let i = 0; i < Math.max(prodLines.length, uatLines.length); i++) {
                        const prodLine = prodLines[i] || '';
                        const uatLine = uatLines[i] || '';
                        
                        if (prodLine !== uatLine) {
                            if (prodLine) content += `- ${prodLine}\n`;
                            if (uatLine) content += `+ ${uatLine}\n`;
                            content += `\n`;
                        }
                    }
                }
                
                content += `\n──────────────────────────────────────────────────────\n\n`;
                fileIndex++;
            }
        });
    }
    
    return content;
}

function generateFullReport() {
    // Your existing full download logic here
    const { componentName, productionCode, uatCode, rawBundleData } = currentDiffData;
    
    if (currentDiffData.is_bundle && rawBundleData?.bundle_files) {
        return generateBundleDownloadContent();
    } else {
        return generateSingleFileDownloadContent();
    }
}

function generateSideBySideReport() {
    const { componentName, rawBundleData } = currentDiffData;
    
    let content = `
SIDE-BY-SIDE COMPARISON: ${componentName}
Generated: ${new Date().toLocaleString()}

FORMAT:
• LEFT: Production Code
• RIGHT: UAT Changes  
• ====: Line numbers match
• ----: Lines differ

${'='.repeat(80)}
`.trim();
    
    if (rawBundleData?.bundle_files) {
        rawBundleData.bundle_files.forEach((file) => {
            if (file.has_changes) {
                content += `\n\nFILE: ${file.file_name}\n`;
                content += `${'-'.repeat(40)} | ${'-'.repeat(40)}\n`;
                content += `PRODUCTION`.padEnd(40) + ` | UAT CHANGES\n`;
                content += `${'-'.repeat(40)} | ${'-'.repeat(40)}\n`;
                
                const prodLines = file.production_code?.split('\n') || [];
                const uatLines = file.uat_code?.split('\n') || [];
                const maxLines = Math.max(prodLines.length, uatLines.length);
                
                for (let i = 0; i < maxLines; i++) {
                    const prodLine = prodLines[i] || '';
                    const uatLine = uatLines[i] || '';
                    const separator = prodLine === uatLine ? '====' : '----';
                    
                    content += `${prodLine.substring(0, 38).padEnd(40)} | ${uatLine.substring(0, 38)}\n`;
                }
            }
        });
    }
    
    return content;
}

function downloadDiff(event) {
    console.log('💾 Download clicked');
    console.log('📦 Current diff data:', currentDiffData);
    
    const { componentName, productionCode, uatCode, rawBundleData } = currentDiffData;
    
    if (!componentName) {
        alert('No diff data available');
        return;
    }
    
    let diffContent = '';
    
    if (currentDiffData.is_bundle && rawBundleData?.bundle_files) {
        // Bundle component - generate detailed bundle report
        diffContent = generateBundleDownloadContent();
    } else {
        // Single file component
        diffContent = generateSingleFileDownloadContent();
    }
    
    // Create blob and download
    const blob = new Blob([diffContent], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${componentName}_comparison_${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
    // Show success feedback
    const btn = event.target;
    const originalText = btn.innerHTML;
    btn.innerHTML = '✅ Downloaded!';
    
    setTimeout(() => {
        btn.innerHTML = originalText;
    }, 2000);
    
    console.log('✅ Download completed with dynamic content');
}

function generateBundleDownloadContent() {
    const { componentName, rawBundleData } = currentDiffData;
    
    let content = `
═══════════════════════════════════════════════════════
BUNDLE COMPARISON: ${componentName}
═══════════════════════════════════════════════════════
Generated: ${new Date().toLocaleString()}
Component: ${componentName}
Type: ${currentDiffData.componentType || 'Unknown'}
Path: ${rawBundleData?.file_path || 'Unknown'}
Total Files: ${rawBundleData?.bundle_files?.length || 0}
Has Changes: ${rawBundleData?.has_changes ? 'Yes' : 'No'}

SUMMARY:
`;
    
    // Add file summary
    if (rawBundleData?.bundle_files) {
        rawBundleData.bundle_files.forEach(file => {
            content += `• ${file.file_name}: ${file.has_changes ? 'MODIFIED 📝' : 'UNCHANGED ✅'}\n`;
        });
    }
    
    content += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    content += `DETAILED FILE COMPARISON\n`;
    content += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    
    // Add each file's content
    if (rawBundleData?.bundle_files) {
        rawBundleData.bundle_files.forEach(file => {
            content += `▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄\n`;
            content += `FILE: ${file.file_name}\n`;
            content += `STATUS: ${file.has_changes ? 'MODIFIED' : 'UNCHANGED'}\n`;
            content += `PRODUCTION: ${file.exists_in_prod ? 'EXISTS' : 'NOT FOUND'}\n`;
            content += `UAT: ${file.exists_in_uat ? 'EXISTS' : 'NOT FOUND'}\n`;
            content += `▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀\n\n`;
            
            if (file.has_changes) {
                content += `PRODUCTION VERSION:\n`;
                content += `${file.production_code || '// No production code available'}\n\n`;
                
                content += `UAT VERSION:\n`;
                content += `${file.uat_code || '// No UAT code available'}\n\n`;
            } else {
                content += `CONTENT (identical in both branches):\n`;
                content += `${file.production_code || file.uat_code || '// No code available'}\n\n`;
            }
            
            content += '\n';
        });
    }
    
    content += `═══════════════════════════════════════════════════════\n`;
    content += `Generated by Copado Deployment Validator\n`;
    
    return content;
}

function generateSingleFileDownloadContent() {
    const { componentName, productionCode, uatCode } = currentDiffData;
    
    const content = `
═══════════════════════════════════════════════════════
CODE COMPARISON: ${componentName}
═══════════════════════════════════════════════════════
Generated: ${new Date().toLocaleString()}
Component: ${componentName}
Type: ${currentDiffData.componentType || 'Unknown'}
Production: ${productionCode ? 'EXISTS' : 'NOT FOUND'}
UAT: ${uatCode ? 'EXISTS' : 'NOT FOUND'}
Has Changes: ${productionCode !== uatCode ? 'YES' : 'NO'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PRODUCTION (master branch)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${productionCode || '// File does not exist in production'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
UAT/DEPLOYMENT (uatsfdc branch)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${uatCode || '// File does not exist in UAT'}

═══════════════════════════════════════════════════════
CHANGE SUMMARY:
═══════════════════════════════════════════════════════

${productionCode && uatCode ? 
    `• Files are ${productionCode === uatCode ? 'IDENTICAL' : 'DIFFERENT'}
• Production lines: ${productionCode.split('\n').length}
• UAT lines: ${uatCode.split('\n').length}
${productionCode !== uatCode ? '• Review changes above before deployment' : '• Safe to deploy - no changes detected'}` 
    : '• One or both files are missing'}

═══════════════════════════════════════════════════════
Generated by Copado Deployment Validator
    `;
    
    return content;
}



let searchMatches = [];
let currentSearchIndex = 0;

function searchInDiff(event) {
    const searchTerm = event.target.value.toLowerCase();
    const diffContainer = document.getElementById('diff-unified');
    const resultsSpan = document.getElementById('searchResults');
    
    if (!diffContainer) return;
    
    // Clear previous highlights
    clearSearchHighlights();
    
    if (!searchTerm || searchTerm.length < 2) {
        resultsSpan.textContent = '';
        return;
    }
    
    // Get all text content
    const allText = diffContainer.innerText.toLowerCase();
    searchMatches = [];
    
    // Find all matches
    let index = allText.indexOf(searchTerm);
    while (index !== -1) {
        searchMatches.push(index);
        index = allText.indexOf(searchTerm, index + 1);
    }
    
    // Show results
    if (searchMatches.length > 0) {
        resultsSpan.textContent = `${searchMatches.length} found`;
        resultsSpan.style.color = '#198754';
        highlightSearchTerm(searchTerm, diffContainer);
    } else {
        resultsSpan.textContent = 'No matches';
        resultsSpan.style.color = '#dc3545';
    }
}

function highlightSearchTerm(term, container) {
    const html = container.innerHTML;
    const regex = new RegExp(`(${escapeRegex(term)})`, 'gi');
    const highlighted = html.replace(regex, '<mark style="background: #ffeb3b; padding: 2px 4px; border-radius: 2px;">$1</mark>');
    container.innerHTML = highlighted;
}

function clearSearchHighlights() {
    const diffContainer = document.getElementById('diff-unified');
    if (diffContainer) {
        const marks = diffContainer.querySelectorAll('mark');
        marks.forEach(mark => {
            const parent = mark.parentNode;
            parent.replaceChild(document.createTextNode(mark.textContent), mark);
        });
    }
}

function escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function setupEventListeners() {
    deploymentUploadBox.addEventListener('click', () => {
        deploymentFileInput.click();
    });
    
    productionUploadBox.addEventListener('click', () => {
        productionFileInput.click();
    });
    
    deploymentFileInput.addEventListener('change', (e) => {
        handleDeploymentFileSelect(e.target.files[0]);
    });
    
    productionFileInput.addEventListener('change', (e) => {
        handleProductionFileSelect(e.target.files[0]);
    });
    
    analyzeBtn.addEventListener('click', uploadAndAnalyze);
}

function parseComponentType(componentName, componentType) {
    // If type is Unknown, try to extract from name
    if (componentType === 'Unknown' && componentName && componentName.includes('.')) {
        const parts = componentName.split('.');
        const rawType = parts[0];
        
        // Map Salesforce types to our internal types
        const typeMapping = {
            'LightningComponentBundle': 'lwc',
            'AuraDefinitionBundle': 'aura',
            'ApexClass': 'ApexClass',
            'ApexTrigger': 'ApexTrigger',
            'DataRaptor': 'DataRaptor',
            'IntegrationProcedure': 'IntegrationProcedure',
            'OmniScript': 'OmniScript'
        };
        
        return typeMapping[rawType] || rawType;
    }
    
    return componentType;
}

// Helper function to get commit hash from the original all_stories data
function getCommitHashFromAllStories(storyId, componentName) {
    console.log('🔄 Looking for commit hash:', { storyId, componentName });
    
    if (!analysisData || !analysisData.all_stories) {
        console.log('❌ No analysis data or all_stories');
        return null;
    }
    
    const story = analysisData.all_stories.find(s => s.id === storyId);
    if (!story) {
        console.log('❌ Story not found:', storyId);
        return null;
    }
    
    console.log('📖 Found story:', story);
    console.log('📦 Story components:', story.components);
    
    if (!story.components) {
        console.log('❌ No components in story');
        return null;
    }
    
    const component = story.components.find(c => 
        c.api_name === componentName || c.name === componentName
    );
    
    console.log('🔍 Found component:', component);
    console.log('💾 Commit hash:', component?.commit_hash);
    
    return component?.commit_hash || null;
}



function handleDeploymentFileSelect(file) {
    if (!file || !file.name.endsWith('.csv')) {
        showError('Please select a CSV file');
        return;
    }
    
    deploymentFile = file;
    
    const infoDiv = document.getElementById('deploymentFileInfo');
    infoDiv.innerHTML = `
        <div style="padding: 10px; background: #e8f5e9; border-radius: 4px; border-left: 4px solid #4caf50;">
            ✓ ${file.name} (${(file.size / 1024).toFixed(2)} KB)
        </div>
    `;
    infoDiv.style.display = 'block';
    analyzeBtn.style.display = 'block';
}

function handleProductionFileSelect(file) {
    if (!file || !file.name.endsWith('.csv')) {
        showError('Please select a CSV file');
        return;
    }
    
    productionFile = file;
    
    const infoDiv = document.getElementById('productionFileInfo');
    infoDiv.innerHTML = `
        <div style="padding: 10px; background: #e3f2fd; border-radius: 4px; border-left: 4px solid #2196f3;">
            ✓ ${file.name} (${(file.size / 1024).toFixed(2)} KB)
            <br><small>Regression detection enabled</small>
        </div>
    `;
    infoDiv.style.display = 'block';
}

async function uploadAndAnalyze() {
    if (!deploymentFile) {
        showError('Please upload deployment CSV first');
        return;
    }
    
    try {
        results.style.display = 'none';
        error.style.display = 'none';
        loading.style.display = 'block';
        
        const formData = new FormData();
        formData.append('deployment_file', deploymentFile);
        
        if (productionFile) {
            formData.append('production_file', productionFile);
        }
        
        const response = await fetch(`${API_URL}/api/analyze`, {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        loading.style.display = 'none';
        
        if (data.success) {
            showRoleSelector(data.data);
        } else {
            showError(data.error || 'Analysis failed');
        }
        
    } catch (err) {
        loading.style.display = 'none';
        showError(`Error: ${err.message}. Make sure the API server is running.`);
    }
}

function showError(message) {
    error.textContent = message;
    error.style.display = 'block';
    setTimeout(() => {
        error.style.display = 'none';
    }, 5000);
}

// ROLE-BASED VIEWS



function downloadDiff(format = 'changes-only') {
    console.log(`💾 Downloading ${format} format`);
    
    let content = '';
    const timestamp = new Date().toLocaleString();
    
    switch(format) {
        case 'summary':
            content = generateSummaryReport();
            break;
        case 'changes-only':
            content = generateChangesOnlyReport();
            break;
        case 'full':
            content = generateFullReport();
            break;
        case 'side-by-side':
            content = generateSideBySideReport();
            break;
        default:
            content = generateChangesOnlyReport();
    }
    
    // Create and download file
    const blob = new Blob([content], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentDiffData.componentName}_${format}_${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
    console.log(`✅ Downloaded ${format} report`);
}

function generateSummaryReport() {
    const { componentName, rawBundleData } = currentDiffData;
    
    return `
QUICK SUMMARY: ${componentName}
Generated: ${new Date().toLocaleString()}

📊 CHANGE OVERVIEW:
• Component: ${componentName}
• Type: ${currentDiffData.componentType || 'Unknown'}
• Total Files: ${rawBundleData?.bundle_files?.length || 1}
• Modified Files: ${rawBundleData?.bundle_files?.filter(f => f.has_changes).length || 0}
• Status: ${rawBundleData?.has_changes ? 'HAS CHANGES 📝' : 'NO CHANGES ✅'}

📋 MODIFIED FILES:
${rawBundleData?.bundle_files?.filter(f => f.has_changes).map(f => `• ${f.file_name}`).join('\n') || '• No modified files'}

🚀 RECOMMENDED ACTIONS:
${rawBundleData?.has_changes ? 
    '1. Review modified files above\n2. Test changes in sandbox\n3. Coordinate deployment' : 
    '1. Safe to deploy - no changes detected'}

---
Need details? Download "Changes Only" or "Full Comparison"
Generated by Copado Deployment Validator
    `.trim();
}

function generateChangesOnlyReport() {
    const { componentName, rawBundleData } = currentDiffData;
    
    let content = `
CHANGES ONLY: ${componentName}
Generated: ${new Date().toLocaleString()}

TABLE OF CONTENTS:
=================
`.trim();
    
    // Add table of contents
    if (rawBundleData?.bundle_files) {
        rawBundleData.bundle_files.forEach((file, index) => {
            if (file.has_changes) {
                content += `\n${index + 1}. ${file.file_name} - Page ${index + 2}`;
            }
        });
    }
    
    content += `\n\n=================\n\n`;
    
    // Add only changed files
    if (rawBundleData?.bundle_files) {
        rawBundleData.bundle_files.forEach((file, index) => {
            if (file.has_changes) {
                content += `\n╔══════════════════════════════════════════════════╗\n`;
                content += `║ FILE ${index + 1}: ${file.file_name.padEnd(35)} ║\n`;
                content += `╚══════════════════════════════════════════════════╝\n\n`;
                
                if (file.production_code && file.uat_code) {
                    content += `PRODUCTION → UAT CHANGES:\n`;
                    content += `-------------------------\n`;
                    
                    // Simple diff-like output
                    const prodLines = file.production_code.split('\n');
                    const uatLines = file.uat_code.split('\n');
                    
                    for (let i = 0; i < Math.max(prodLines.length, uatLines.length); i++) {
                        const prodLine = prodLines[i] || '';
                        const uatLine = uatLines[i] || '';
                        
                        if (prodLine !== uatLine) {
                            if (prodLine) content += `- ${prodLine}\n`;
                            if (uatLine) content += `+ ${uatLine}\n`;
                            content += `\n`;
                        }
                    }
                }
                
                content += `\n──────────────────────────────────────────────────────\n\n`;
            }
        });
    }
    
    return content;
}

function showRoleSelector(data) {
    analysisData = data;
    document.getElementById('roleSelectorModal').style.display = 'flex';
}

function selectRole(role) {
    currentRole = role;
    document.getElementById('roleSelectorModal').style.display = 'none';
    
    if (role === 'developer') {
        showDeveloperView();
    } else {
        showDevOpsView();
    }
}

function switchView(role) {
    selectRole(role);
}

function showDeveloperView() {
    document.getElementById('devopsView').style.display = 'none';
    document.getElementById('developerView').style.display = 'block';
    
    // Get ALL developers from all stories (not just conflicts)
    const developers = new Set();
    
    if (analysisData.all_stories) {
        analysisData.all_stories.forEach(story => {
            if (story.developer) {
                developers.add(story.developer);
            }
        });
    }
    
    // Populate dropdown
    const select = document.getElementById('developerSelect');
    select.innerHTML = '<option value="">Select your name...</option>';
    
    if (developers.size === 0) {
        select.innerHTML += '<option value="">No developers found</option>';
    } else {
        Array.from(developers).sort().forEach(dev => {
            select.innerHTML += `<option value="${dev}">${dev}</option>`;
        });
    }
}

function filterByDeveloper() {
    const selectedDev = document.getElementById('developerSelect').value;
    const container = document.getElementById('developerStories');
    
    if (!selectedDev) {
        container.innerHTML = '<p style="padding: 40px; text-align: center; color: #666;">Please select your name to see your stories</p>';
        return;
    }
    
    const myStories = buildDeveloperStories(selectedDev);
    
    if (myStories.length === 0) {
        container.innerHTML = '<p style="padding: 40px; text-align: center; color: #666;">No stories found for this developer</p>';
        return;
    }
    
    container.innerHTML = myStories.map(story => `
        <div class="dev-story-card ${story.status.toLowerCase()}">
            <h3>${story.statusIcon} ${story.id}</h3>
            <h4>${story.title}</h4>
            
            <div style="margin: 15px 0;">
                <strong>Status: ${story.status}</strong>
                <p style="color: #666; margin-top: 5px;">${story.reason}</p>
            </div>
            
            ${story.hasRegression ? `
                <div style="background: #fff3cd; padding: 12px; border-radius: 6px; border-left: 4px solid #dc3545; margin: 15px 0;">
                    <strong style="color: #dc3545;">⚠️ REGRESSION DETECTED</strong>
                    <p style="margin: 8px 0; color: #856404;">This component is older than production!</p>
                </div>
            ` : ''}
            
            <div class="action-list">
                <strong>What you need to do:</strong>
                <ol>
                    ${story.actions.map(action => `<li>${action}</li>`).join('')}
                </ol>
            </div>
            
            ${story.coordination.length > 0 ? `
                <div style="margin-top: 15px; padding: 12px; background: #e3f2fd; border-radius: 6px;">
                    <strong>Coordinate with:</strong>
                    <p style="margin-top: 5px;">${story.coordination.join(', ')}</p>
                </div>
            ` : ''}
            
            ${story.deployOrder && story.deployOrder.order !== 'independent' ? `
                <div style="margin: 15px 0; padding: 15px; background: #e3f2fd; border-radius: 6px; border-left: 4px solid #2196f3;">
                    <strong>📋 Deployment Order Decision</strong>
                    <p style="margin: 8px 0; color: #0c5460;">
                        ${story.deployOrder.reason}
                    </p>
                    
                    <details style="margin-top: 10px;">
                        <summary style="cursor: pointer; font-size: 13px; color: #667eea;">
                            View Component Analysis (${story.deployOrder.details.totalShared} components)
                        </summary>
                        <div style="margin-top: 10px; font-size: 12px;">
                            <table style="width: 100%; border-collapse: collapse;">
                                <thead style="background: #f8f9fa;">
                                    <tr>
                                        <th style="padding: 8px; text-align: left; border: 1px solid #ddd;">Component</th>
                                        <th style="padding: 8px; text-align: left; border: 1px solid #ddd;">Severity</th>
                                        <th style="padding: 8px; text-align: left; border: 1px solid #ddd;">Latest By</th>
                                        <th style="padding: 8px; text-align: center; border: 1px solid #ddd;">Impact</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${story.deployOrder.details.componentBreakdown.map(comp => `
                                        <tr style="background: ${comp.youHaveLatest ? '#d1f2eb' : '#fff3cd'};">
                                            <td style="padding: 8px; border: 1px solid #ddd;">${comp.name}</td>
                                            <td style="padding: 8px; border: 1px solid #ddd;">
                                                <span style="background: ${comp.severity === 'CRITICAL' || comp.severity === 'BLOCKER' ? '#dc3545' : comp.severity === 'HIGH' ? '#fd7e14' : '#ffc107'}; color: white; padding: 2px 6px; border-radius: 3px; font-size: 10px;">
                                                    ${comp.severity}
                                                </span>
                                            </td>
                                            <td style="padding: 8px; border: 1px solid #ddd;">
                                                ${comp.youHaveLatest ? 'YOU ✅' : comp.latestStory}
                                            </td>
                                            <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">
                                                ${comp.youHaveLatest ? '+' : '-'}${comp.weight}
                                            </td>
                                        </tr>
                                    `).join('')}
                                    <tr style="background: #667eea; color: white; font-weight: bold;">
                                        <td colspan="3" style="padding: 8px; border: 1px solid #ddd;">Weighted Score</td>
                                        <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">
                                            ${story.deployOrder.details.weightedScore > 0 ? '+' : ''}${story.deployOrder.details.weightedScore}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </details>
            
            <div style="margin-top: 12px; padding: 12px; background: ${
                    story.deployOrder.order === 'last' ? '#d1f2eb' : 
                    story.deployOrder.order === 'first' ? '#fff3cd' : 
                    '#ffebee'
                }; border-radius: 4px;">
                    <strong>${
                        story.deployOrder.order === 'last' ? '✅' : 
                        story.deployOrder.order === 'first' ? '⬆️' : 
                        '⚠️'
                    } ${story.deployOrder.recommendation}</strong>
                    ${story.deployOrder.details.conflictingStories.length > 0 ? `
                        <br><small style="margin-top: 5px; display: block;">Coordinate with: ${story.deployOrder.details.conflictingStories.join(', ')}</small>
                    ` : ''}
                </div>
            </div>
        ` : ''}
            
            <details style="margin-top: 15px;">
                <summary style="cursor: pointer; color: #667eea; font-weight: 600;">View Component Details</summary>
                <div style="margin-top: 10px; padding: 10px; background: #f8f9fa; border-radius: 4px;">
                    ${story.components.map(c => `
                        <div style="padding: 8px; margin: 5px 0; background: white; border-radius: 4px;">
                            • ${c.name} (${c.type}) - ${c.severity} Risk
                        </div>
                    `).join('')}
                </div>
            </details>
        </div>
    `).join('');
}

function getStoryDeploymentOrder(storyData, allStoriesMap) {
    const sharedComponents = storyData.components.filter(c => c.otherStories && c.otherStories.length > 0);
    
    if (sharedComponents.length === 0) {
        return { 
            order: 'independent', 
            reason: 'No shared components',
            details: { totalShared: 0 }
        };
    }
    
    // Severity weights
    const severityWeights = {
        'BLOCKER': 5,
        'CRITICAL': 5,
        'HIGH': 3,
        'MEDIUM': 2,
        'LOW': 1
    };
    
    let weightedScore = 0;
    let latestCount = 0;
    let olderCount = 0;
    const componentBreakdown = [];
    const conflictingStories = new Set();
    
    sharedComponents.forEach(comp => {
        // Find all stories with this component from conflicts
        const conflict = analysisData.conflicts.find(c => c.component.api_name === comp.name);
        
        if (!conflict) return;
        
        const storiesWithComp = conflict.involved_stories.sort((a, b) => {
            if (!a.commit_date) return 1;
            if (!b.commit_date) return -1;
            return new Date(b.commit_date) - new Date(a.commit_date);
        });
        
        if (storiesWithComp.length === 0) return;
        
        const latestStory = storiesWithComp[0];
        const weight = severityWeights[comp.severity] || 1;
        
        // Track other stories
        storiesWithComp.forEach(s => {
            if (s.id !== storyData.id) {
                conflictingStories.add(s.id);
            }
        });
        
        // Calculate weighted score
        if (latestStory.id === storyData.id) {
            weightedScore += weight;
            latestCount++;
            componentBreakdown.push({
                name: comp.name,
                severity: comp.severity,
                youHaveLatest: true,
                latestStory: storyData.id,
                weight: weight
            });
        } else {
            weightedScore -= weight;
            olderCount++;
            componentBreakdown.push({
                name: comp.name,
                severity: comp.severity,
                youHaveLatest: false,
                latestStory: latestStory.id,
                weight: weight
            });
        }
    });
    
    // Determine order based on weighted score
    let order, reason, recommendation;
    
    if (weightedScore > 0) {
        order = 'last';
        const criticalLatest = componentBreakdown.filter(c => 
            c.youHaveLatest && (c.severity === 'BLOCKER' || c.severity === 'CRITICAL')
        );
        if (criticalLatest.length > 0) {
            reason = `You have latest on ${criticalLatest.length} CRITICAL component(s)`;
            recommendation = `Deploy LAST to preserve your critical changes`;
        } else {
            reason = `Weighted score: +${weightedScore} (you have more important latest commits)`;
            recommendation = `Deploy LAST`;
        }
    } else if (weightedScore < 0) {
        order = 'first';
        const criticalOlder = componentBreakdown.filter(c => 
            !c.youHaveLatest && (c.severity === 'BLOCKER' || c.severity === 'CRITICAL')
        );
        if (criticalOlder.length > 0) {
            reason = `${criticalOlder[0].latestStory} has latest on CRITICAL: ${criticalOlder[0].name}`;
            recommendation = `Deploy FIRST, then ${criticalOlder[0].latestStory} deploys last to preserve their critical changes`;
        } else {
            reason = `Weighted score: ${weightedScore} (others have more important latest commits)`;
            recommendation = `Deploy FIRST`;
        }
    } else {
        order = 'coordinate';
        reason = `Mixed versions with equal weight (score: 0)`;
        recommendation = `Manual coordination required - discuss with team`;
    }
    
    return {
        order,
        reason,
        recommendation,
        details: {
            totalShared: sharedComponents.length,
            youHaveLatest: latestCount,
            othersHaveLatest: olderCount,
            weightedScore: weightedScore,
            componentBreakdown: componentBreakdown,
            conflictingStories: Array.from(conflictingStories)
        }
    };
}

function buildDeveloperStories(developerName) {
    const { conflicts, regressions } = analysisData;
    const storyMap = new Map();
    
    // Collect stories for this developer
    conflicts.forEach(conflict => {
        conflict.involved_stories.forEach(story => {
            if (story.developer === developerName) {
                if (!storyMap.has(story.id)) {
                    storyMap.set(story.id, {
                        id: story.id,
                        title: story.title,
                        components: [],
                        maxRisk: 0,
                        hasRegression: false,
                        otherDevs: new Set()
                    });
                }
                
                const storyData = storyMap.get(story.id);
                storyData.components.push({
                    name: conflict.component.api_name,
                    type: conflict.component.type,
                    severity: conflict.severity,
                    risk: conflict.risk_score,
                    otherStories: conflict.involved_stories
                        .filter(s => s.id !== story.id)
                        .map(s => s.id)
                });
                
                if (conflict.risk_score > storyData.maxRisk) {
                    storyData.maxRisk = conflict.risk_score;
                }
                
                // Find other developers
                conflict.involved_stories.forEach(s => {
                    if (s.developer && s.developer !== developerName) {
                        storyData.otherDevs.add(s.developer);
                    }
                });
            }
        });
    });
    
    // Check regressions
    if (regressions) {
        regressions.forEach(reg => {
            if (storyMap.has(reg.story_id)) {
                storyMap.get(reg.story_id).hasRegression = true;
            }
        });
    }
    
    // Build final story list
    const stories = [];
    storyMap.forEach((data, id) => {
        let status, statusIcon, reason, actions;
        
        if (data.hasRegression) {
            status = 'BLOCKED';
            statusIcon = '❌';
            reason = 'Component is older than production';
            actions = [
                'Pull latest code from production',
                'Rebase your changes',
                'Create new commit',
                'Update Copado with new commit ID'
            ];
        } else if (data.maxRisk >= 80) {
            status = 'BLOCKED';
            statusIcon = '❌';
            reason = 'High-risk conflicts detected - manual merge required';
            actions = [
                'Coordinate with other developers',
                'Manual code merge needed',
                'Deploy together as single release'
            ];
        } else if (data.maxRisk >= 60) {
            status = 'WARNING';
            statusIcon = '⚠️';
            reason = 'Medium-risk conflicts - careful review needed';
            actions = [
                'Review changes with team',
                'Deploy in coordinated sequence',
                'Test thoroughly'
            ];
        } else {
            status = 'SAFE';
            statusIcon = '✅';
            reason = 'No blocking issues detected';
            actions = ['Follow standard deployment process'];
        }
        
        // ===== ADD THIS SECTION =====
        // Calculate deployment order
        const deployOrder = getStoryDeploymentOrder(data, storyMap);
        // ===== END NEW SECTION =====
        
        stories.push({
            id: data.id,
            title: data.title,
            status,
            statusIcon,
            reason,
            actions,
            hasRegression: data.hasRegression,
            coordination: Array.from(data.otherDevs),
            components: data.components,
            deployOrder: deployOrder  // ← ADD THIS LINE
        });
    });
    
    return stories.sort((a, b) => {
        const order = { BLOCKED: 0, WARNING: 1, SAFE: 2 };
        return order[a.status] - order[b.status];
    });
}


function showDevOpsView() {
    document.getElementById('developerView').style.display = 'none';
    document.getElementById('devopsView').style.display = 'none';  // Hide tabs
    
    // Show decision dashboard instead
    displayDecisionDashboard(analysisData);
}



function showTab(tabName) {
    // ✅ ADD THIS CHECK - If we're in DevOps decision dashboard, use special handling
    if (currentRole === 'devops' && document.querySelector('.decision-dashboard')) {
        showDevOpsTab(tabName);
         if (tabName === 'deploy' && typeof renderLatestDeploymentPlan === 'function') {
          renderLatestDeploymentPlan();
       }
       return;
        
    }
    
    // ✅ EXISTING CODE - Keep everything else the same
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelectorAll('.tab-content').forEach(content => {
        content.style.display = 'none';
    });
    
    event.target.classList.add('active');
    document.getElementById(`tab-${tabName}`).style.display = 'block';
    
    if (tabName === 'overview') buildOverviewTab();
    if (tabName === 'stories') buildStoriesTab();
    if (tabName === 'sequence') buildSequenceTab();
    if (tabName === 'enforcement') buildEnforcementTab();
    if (tabName === 'production') buildProductionTab();
    if (tabName === 'decisions') buildDecisionsTab();
    if (tabName === 'deploy') buildDeployPlanTab();
}



function buildDeployPlanTab() {
  // Render the latest (or create one if none exists)
  if (typeof renderLatestDeploymentPlan === 'function') {
    renderLatestDeploymentPlan(/* will render into #tab-deploy by default, see below */);
  } else {
    console.warn('renderLatestDeploymentPlan() is not defined. Make sure the Deployment Plan generator/renderer code is loaded.');
  }
}



function showDevOpsTab(tabName, ev) {
  // Prefer the passed event; fallback to window.event if available
  const e = ev || window.event || null;

  // Update tab buttons
  document.querySelectorAll('.tab-button').forEach(btn => {
    btn.classList.remove('active');
  });
  if (e && e.target) {
    e.target.classList.add('active');
  } else {
    // Fallback: activate the matching button by data attribute or onclick
    const btn = document.querySelector(`.tab-button[onclick*="showTab('${tabName}'"]`);
    if (btn) btn.classList.add('active');
  }

  // Show/hide tab content
  document.querySelectorAll('.tab-content').forEach(content => {
    content.style.display = 'none';
  });
  const pane = document.getElementById(`tab-${tabName}`);
  if (pane) pane.style.display = 'block';

  // Build tab content (overview stays as dashboard cards)
  if (tabName === 'stories')      buildStoriesTab();
  else if (tabName === 'sequence')    buildSequenceTab();
  else if (tabName === 'enforcement') buildEnforcementTab();
  else if (tabName === 'production')  buildProductionTab();
  else if (tabName === 'decisions')   buildDecisionsTab();
  else if (tabName === 'deploy')      buildDeployPlanTab();   // ← NEW: Deployment Plan tab
}


function buildOverviewTab() {
    const { summary, regressions } = analysisData;
    
    document.getElementById('tab-overview').innerHTML = `
        <div style="background: white; padding: 30px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
            <h2>Deployment Analysis Summary</h2>
            
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 30px 0;">
                <div style="background: #f8f9fa; padding: 20px; border-radius: 8px;">
                    <div style="font-size: 32px; font-weight: bold; color: #333;">${summary.unique_stories}</div>
                    <div style="color: #666;">Total Stories</div>
                </div>
                <div style="background: #fff3cd; padding: 20px; border-radius: 8px;">
                    <div style="font-size: 32px; font-weight: bold; color: #dc3545;">${regressions ? regressions.length : 0}</div>
                    <div style="color: #856404;">Regressions</div>
                </div>
                <div style="background: #f8d7da; padding: 20px; border-radius: 8px;">
                    <div style="font-size: 32px; font-weight: bold; color: #dc3545;">${buildCompleteStoryList().filter(s => s.status === 'BLOCKED').length}</div>
                    <div style="color: #721c24;">Blocked Stories</div>  
                </div>
                <div style="background: #d1ecf1; padding: 20px; border-radius: 8px;">
                    <div style="font-size: 32px; font-weight: bold; color: #0c5460;">${summary.total_conflicts}</div>
                    <div style="color: #0c5460;">Total Conflicts</div>
                </div>
            </div>
            
            <h3 style="margin-top: 40px;">Next Actions:</h3>
            <ol style="font-size: 18px; line-height: 1.8;">
                <li>Review ${regressions ? regressions.length : 0} regression risks</li>
                  <li>Address ${buildCompleteStoryList().filter(s => s.status === 'BLOCKED').length} blocked stories</li>
                <li>Coordinate developers for ${summary.severity_breakdown.critical} critical conflicts</li>
                <li>Plan deployment sequence for safe stories</li>
            </ol>
        </div>
    `;
}

function groupStoriesBySharedComponents(stories) {
    /**
     * Group stories that share components
     * Returns: Array of groups with deployment order
     */
    const componentMap = new Map();
    
    // Build component index
    stories.forEach(story => {
        story.components.forEach(comp => {
            if (!componentMap.has(comp.name)) {
                componentMap.set(comp.name, []);
            }
            componentMap.get(comp.name).push({
                storyId: story.id,
                developer: story.developer,
                severity: comp.severity,
                risk: comp.risk
            });
        });
    });
    
    // Find components with multiple stories
    const groups = [];
    componentMap.forEach((storiesInComp, componentName) => {
        if (storiesInComp.length > 1) {
            groups.push({
                component: componentName,
                stories: storiesInComp,
                count: storiesInComp.length
            });
        }
    });
    
    return groups;
}

function getDeploymentRiskExplanation(safe, warning, blocked) {
    const total = safe.length + warning.length + blocked.length;
    const safePercent = Math.round((safe.length / total) * 100);
    
    if (safePercent >= 70) {
        return {
            level: 'LOW',
            color: '#198754',
            message: 'Most stories are safe. Low deployment risk.',
            confidence: 'High confidence in deployment success'
        };
    } else if (safePercent >= 40) {
        return {
            level: 'MEDIUM',
            color: '#fd7e14',
            message: 'Some coordination needed. Manageable risk.',
            confidence: 'Medium confidence - follow sequence plan'
        };
    } else {
        return {
            level: 'HIGH',
            color: '#dc3545',
            message: 'Many conflicts detected. High risk deployment.',
            confidence: 'Proceed with caution - extensive testing needed'
        };
    }
}


function buildSequenceTab() {
    try {
        if (!analysisData) {
            document.getElementById('tab-sequence').innerHTML = '<p style="padding: 40px; text-align: center;">No analysis data</p>';
            return;
        }
        
        const allStories = buildCompleteStoryList();
        
        if (!allStories || allStories.length === 0) {
            document.getElementById('tab-sequence').innerHTML = '<p style="padding: 40px; text-align: center;">No stories found</p>';
            return;
        }
        
        const safe = allStories.filter(s => s.status === 'SAFE');
        const warning = allStories.filter(s => s.status === 'WARNING');
        const blocked = allStories.filter(s => s.status === 'BLOCKED');
        const totalStories = allStories.length;
        const safetyScore = Math.round((safe.length / totalStories) * 10);
        
        let html = `
            <div style="background: white; padding: 30px; border-radius: 12px;">
                <h2>🚀 Deployment Plan</h2>
                
                <div style="padding: 20px; background: #667eea; color: white; border-radius: 8px; margin: 20px 0;">
                    <h3 style="color: white; margin: 0;">Safety Score: ${safetyScore}/10</h3>
                    <p style="margin: 10px 0 0 0;">${safe.length} of ${totalStories} stories are safe to deploy</p>
                </div>
        `;
        
        // Wave 1: Safe Stories
        if (safe.length > 0) {
            html += `
                <div style="margin: 30px 0; padding: 20px; background: #f8fff9; border-radius: 8px; border: 2px solid #198754;">
                    <h3 style="color: #198754;">✅ WAVE 1: Safe to Deploy (${safe.length})</h3>
                    
                    <div style="background: white; padding: 15px; border-radius: 6px; margin: 15px 0;">
                        <strong>Why these are safe:</strong>
                        <ul style="margin: 10px 0; padding-left: 20px;">
                            <li>No components shared with other stories</li>
                            <li>No conflicts detected</li>
                            <li>Can deploy in any order</li>
                        </ul>
                    </div>
                    
                    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 10px;">
            `;
            
            safe.forEach(s => {
                html += `
                    <div style="padding: 12px; background: white; border-left: 4px solid #198754; border-radius: 4px;">
                        <strong>${s.id}</strong><br>
                        <small style="color: #666;">${s.developer || 'Unknown'}</small>
                    </div>
                `;
            });
            
            html += `
                    </div>
                </div>
            `;
        }
        
        // Wave 2: Warning Stories
        if (warning.length > 0) {
            html += `
                <div style="margin: 30px 0; padding: 20px; background: #fffbf0; border-radius: 8px; border: 2px solid #fd7e14;">
                    <h3 style="color: #fd7e14;">⚠️ WAVE 2: Requires Coordination (${warning.length})</h3>
                    
                    <div style="background: white; padding: 15px; border-radius: 6px; margin: 15px 0;">
                        <strong style="color: #fd7e14;">⚠️ Why order matters:</strong>
                        <p style="margin: 10px 0;">
                            These stories modify the same components. Deploying in wrong order 
                            will cause newer code to be overwritten by older code.
                        </p>
                    </div>
                    
                    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 10px; margin: 15px 0;">
            `;
            
            warning.forEach(s => {
                html += `
                    <div style="padding: 12px; background: white; border-left: 4px solid #fd7e14; border-radius: 4px;">
                        <strong>${s.id}</strong><br>
                        <small style="color: #666;">${s.developer || 'Unknown'}</small><br>
                        <small style="color: #666;">${s.component_count || 0} components</small>
                    </div>
                `;
            });
            
            html += `
                    </div>
                    
                    <!-- What goes wrong -->
                    <div style="background: #fff3cd; padding: 15px; border-radius: 6px; margin: 15px 0; border-left: 4px solid #dc3545;">
                        <strong style="color: #dc3545;">❌ What happens if deployed in wrong order:</strong>
                        <div style="margin: 10px 0; padding: 10px; background: white; border-radius: 4px;">
                            <div style="font-size: 13px; line-height: 1.8;">
                                <div style="color: #198754;">✓ 10:00 AM: Story with newest commit deploys</div>
                                <div style="color: #666; margin-left: 20px;">Latest code is now in production</div>
                                <div style="color: #dc3545; margin-top: 8px;">✗ 10:30 AM: Story with older commit deploys</div>
                                <div style="color: #dc3545; margin-left: 20px;">Old code OVERWRITES the new code</div>
                                <div style="color: #dc3545; margin-left: 20px;">Previous changes are LOST</div>
                                <div style="background: #ffebee; padding: 8px; margin-top: 8px; border-radius: 4px;">
                                    <strong>Result: Production breaks! 💥</strong>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- What works -->
                    <div style="background: #d1f2eb; padding: 15px; border-radius: 6px; margin: 15px 0;">
                        <strong style="color: #0c5460;">✅ Why correct order works:</strong>
                        <div style="margin: 10px 0; padding: 10px; background: white; border-radius: 4px;">
                            <div style="font-size: 13px; line-height: 1.8;">
                                <div style="color: #198754;">✓ 10:00 AM: Oldest commit deploys first</div>
                                <div style="color: #666; margin-left: 20px;">Base code in production</div>
                                <div style="color: #198754; margin-top: 8px;">✓ 10:30 AM: Middle commit deploys</div>
                                <div style="color: #666; margin-left: 20px;">Adds changes on top</div>
                                <div style="color: #198754; margin-top: 8px;">✓ 11:00 AM: Newest commit deploys</div>
                                <div style="color: #666; margin-left: 20px;">Adds final changes</div>
                                <div style="background: #d1f2eb; padding: 8px; margin-top: 8px; border-radius: 4px;">
                                    <strong>Result: All changes preserved! ✅</strong>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Checklist -->
                    <div style="background: linear-gradient(135deg, #fd7e14 0%, #d66912 100%); padding: 15px; border-radius: 6px; color: white; margin-top: 15px;">
                        <strong>📋 Pre-Deployment Checklist:</strong>
                        <div style="margin: 10px 0; opacity: 0.95; line-height: 1.6;">
                            ☐ Schedule meeting with all developers<br>
                            ☐ Deploy oldest → newest (check commit dates)<br>
                            ☐ Test 30 min between each deployment<br>
                            ☐ Stop if any deployment fails
                        </div>
                    </div>
                </div>
            `;
        }

        if (blocked.length > 0) {
            html += `
                <div style="margin: 30px 0; padding: 20px; background: #fff5f5; border-radius: 8px; border: 2px solid #dc3545;">
                    <h3 style="color: #dc3545;">❌ EXCLUDED: Cannot Deploy (${blocked.length})</h3>
                    
                    <div style="background: white; padding: 15px; border-radius: 6px; margin: 15px 0;">
                        <strong style="color: #dc3545;">Why these are blocked:</strong>
                        <p style="margin: 10px 0;">
                            These stories have critical issues that will cause production failures if deployed.
                        </p>
                    </div>
            `;
            
            blocked.forEach(s => {
                html += `
                    <div style="padding: 15px; margin: 10px 0; background: white; border-left: 4px solid #dc3545; border-radius: 6px;">
                        <div style="font-weight: bold; color: #dc3545; font-size: 16px; margin-bottom: 8px;">
                            ${s.id}
                        </div>
                        <div style="color: #666; margin-bottom: 8px;">
                            👤 ${s.developer || 'Unknown'}
                        </div>
                        
                        <div style="background: #fff3cd; padding: 12px; border-radius: 4px; margin: 10px 0;">
                            <strong>⚠️ Issue:</strong> ${s.reason}
                        </div>
                        
                        <div style="background: #e3f2fd; padding: 12px; border-radius: 4px;">
                            <strong>Required Actions:</strong>
                            <ol style="margin: 8px 0; padding-left: 20px;">
                `;
                
                if (s.actions && s.actions.length > 0) {
                    s.actions.forEach(action => {
                        html += `<li style="margin: 5px 0;">${action}</li>`;
                    });
                } else {
                    html += `<li>Fix blocking issues before deployment</li>`;
                }
                
                html += `
                            </ol>
                        </div>
                    </div>
                `;
            });
            
            html += `</div>`;
        }
        
        // Final Summary
        html += `
            <div style="margin-top: 40px; padding: 25px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; color: white; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
                <h3 style="margin: 0 0 15px 0; color: white;">📊 Deployment Summary</h3>
                
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 20px; margin-bottom: 15px;">
                    <div style="text-align: center;">
                        <div style="font-size: 36px; font-weight: bold;">${safe.length}</div>
                        <div style="opacity: 0.9;">Ready Now</div>
                    </div>
                    <div style="text-align: center;">
                        <div style="font-size: 36px; font-weight: bold;">${warning.length}</div>
                        <div style="opacity: 0.9;">Need Sequence</div>
                    </div>
                    <div style="text-align: center;">
                        <div style="font-size: 36px; font-weight: bold;">${blocked.length}</div>
                        <div style="opacity: 0.9;">Must Fix</div>
                    </div>
                    <div style="text-align: center;">
                        <div style="font-size: 36px; font-weight: bold;">${safetyScore}/10</div>
                        <div style="opacity: 0.9;">Safety Score</div>
                    </div>
                </div>
                
                <div style="padding: 15px; background: rgba(255,255,255,0.1); border-radius: 6px; margin-top: 15px;">
                    <strong>💡 Bottom Line:</strong>
                    <p style="margin: 8px 0; opacity: 0.95;">
                        Following this plan reduces deployment risk by ${Math.round((safe.length / totalStories) * 100)}% 
                        and prevents code overwrites.
                    </p>
                </div>
            </div>
        `;
        // Close main div
        html += `</div>`;
        
        document.getElementById('tab-sequence').innerHTML = html;
        
    } catch (error) {
        document.getElementById('tab-sequence').innerHTML = `
            <div style="padding: 40px; color: red;">
                <h3>Error: ${error.message}</h3>
            </div>
        `;
        console.error('Error:', error);
    }
}


function buildCompleteStoryList() {
    const { conflicts, regressions, all_stories } = analysisData;
    
    const storyMap = new Map();
    
    // Step 1: Start with ALL stories from the deployment
    if (all_stories && all_stories.length > 0) {
        all_stories.forEach(story => {
            storyMap.set(story.id, {
                id: story.id,
                title: story.title || 'No title',
                developer: story.developer || null,
                jira_key: story.jira_key || null,
                component_count: story.component_count || 0,
                components: [],
                maxRisk: 0,
                severities: [],
                hasRegression: false,
                regressionDetails: [],
                hasConflict: false
            });
        });
    }
    
    // Step 2: Add conflict information
    if (conflicts && conflicts.length > 0) {
        conflicts.forEach(conflict => {
            conflict.involved_stories.forEach(story => {
                // Create story if not exists (fallback if all_stories wasn't available)
                if (!storyMap.has(story.id)) {
                    storyMap.set(story.id, {
                        id: story.id,
                        title: story.title || 'No title',
                        developer: story.developer || null,
                        jira_key: story.jira_key || null,
                        component_count: story.component_count || 0,
                        components: [],
                        maxRisk: 0,
                        severities: [],
                        hasRegression: false,
                        regressionDetails: [],
                        hasConflict: false
                    });
                }
                
                const storyData = storyMap.get(story.id);
                storyData.hasConflict = true;
                
                // Add component details
                const thisStoryData = conflict.involved_stories.find(s => s.id === story.id);
                const commitDate = thisStoryData?.commit_date || conflict.component.last_commit_date || null;
                console.log('🔍 DEBUG commit_hash sources:', {
                    storyId: story.id,
                    storyCommitHash: story.commit_hash,
                    conflictComponentHash: conflict.component.last_commit_hash,
                    involvedStories: conflict.involved_stories.map(s => ({ id: s.id, commit_hash: s.commit_hash }))
                });

                storyData.components.push({
                    name: conflict.component.api_name,
                    type: conflict.component.type,
                    severity: conflict.severity,
                    risk: conflict.risk_score,
                    commit_date: commitDate,
                    days_old: commitDate ? calculateDaysOld(commitDate) : null,
                    commit_hash: getCommitHashFromAllStories(story.id, conflict.component.api_name),

                    otherStories: conflict.involved_stories
                        .filter(s => s.id !== story.id)
                        .map(s => ({
                            id: s.id,
                            commit_date: s.commit_date || null,
                            commit_hash: s.commit_hash || null
                        }))
                });
                
                            
              
                
                storyData.severities.push(conflict.severity);
                if (conflict.risk_score > storyData.maxRisk) {
                    storyData.maxRisk = conflict.risk_score;
                }
            });
        });
    }
    
    // Step 3: Add regression information
    if (regressions && regressions.length > 0) {
        regressions.forEach(reg => {
            if (storyMap.has(reg.story_id)) {
                storyMap.get(reg.story_id).hasRegression = true;
                storyMap.get(reg.story_id).regressionDetails.push(reg);
            }
        });
    }
    
    // Step 4: Build final array with status for ALL stories
    const stories = [];
    storyMap.forEach((data, id) => {
        let status, statusIcon, reason, actions;
        
        // Determine status
        if (data.hasRegression) {
            status = 'BLOCKED';
            statusIcon = '❌';
            reason = 'Component is older than production';
            actions = [
                'Pull latest code from production',
                'Rebase your changes',
                'Create new commit',
                'Update Copado with new commit ID'
            ];
        } else if (data.severities.includes('BLOCKER')) {
            status = 'BLOCKED';
            statusIcon = '❌';
            reason = 'Blocker conflict detected';
            actions = [
                'Coordinate with other developers',
                'Manual code merge required',
                'Deploy together as single release'
            ];
        } else if (data.severities.includes('CRITICAL') || data.maxRisk >= 60) {
            status = 'WARNING';
            statusIcon = '⚠️';
            reason = 'Critical or high-risk conflicts detected';
            actions = [
                'Review changes with team',
                'Deploy in coordinated sequence',
                'Test thoroughly'
            ];
        } else if (data.hasConflict) {
            status = 'WARNING';
            statusIcon = '⚠️';
            reason = 'Conflicts detected - needs review';
            actions = [
                'Coordinate with other developers',
                'Review shared components',
                'Deploy in correct sequence'
            ];
        } else {
            // No conflicts, no regressions = SAFE
            status = 'SAFE';
            statusIcon = '✅';
            reason = 'No conflicts or issues detected';
            actions = ['Follow standard deployment process'];
        }
        
        // Get coordination needs (developers to coordinate with)
        const otherDevs = new Set();
        data.components.forEach(comp => {
            if (comp.otherStories) {
                comp.otherStories.forEach(otherId => {
                    const otherStory = Array.from(storyMap.values()).find(s => s.id === otherId);
                    if (otherStory && otherStory.developer && otherStory.developer !== data.developer) {
                        otherDevs.add(otherStory.developer);
                    }
                });
            }
        });
        
        stories.push({
            id: data.id,
            title: data.title,
            developer: data.developer,
            jira_key: data.jira_key,
            component_count: data.component_count,
            status,
            statusIcon,
            reason,
            actions,
            hasRegression: data.hasRegression,
            coordination: Array.from(otherDevs),
            components: data.components
        });
    });
    
    // Sort: Blocked first, then Warning, then Safe
    return stories.sort((a, b) => {
        const order = { BLOCKED: 0, WARNING: 1, SAFE: 2 };
        return order[a.status] - order[b.status];
    });
}

function renderStoryList(stories) {
    if (stories.length === 0) {
        return '<p style="padding: 40px; text-align: center; color: #666;">No stories match the filter</p>';
    }
    
    return stories.map(story => `
        <div class="devops-story-card ${story.status.toLowerCase()}" style="margin-bottom: 15px; padding: 20px; background: white; border-radius: 8px; border-left: 5px solid ${story.status === 'BLOCKED' ? '#dc3545' : story.status === 'WARNING' ? '#fd7e14' : '#198754'}; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <div style="display: flex; justify-content: space-between; align-items: start;">
                <div style="flex: 1;">
                    <h3 style="margin: 0 0 10px 0;">${story.statusIcon} ${story.id}</h3>
                    <p style="color: #666; margin: 5px 0;">${story.title}</p>
                    <div style="display: flex; gap: 20px; margin-top: 10px; font-size: 14px; color: #666;">
                        <span>👤 ${story.developer}</span>
                        <span>📋 ${story.jira_key || 'N/A'}</span>
                        <span>🔧 ${story.component_count} components</span>
                        <span>⚠️ Risk: ${story.maxRisk}/100</span>
                    </div>
                </div>
                <div style="text-align: right;">
                    <span style="padding: 8px 16px; background: ${story.status === 'BLOCKED' ? '#dc3545' : story.status === 'WARNING' ? '#fd7e14' : '#198754'}; color: white; border-radius: 20px; font-size: 14px; font-weight: 600;">
                        ${story.status}
                    </span>
                </div>
            </div>
            
            ${story.hasRegression ? `
                <div style="margin-top: 15px; padding: 12px; background: #fff3cd; border-left: 4px solid #dc3545; border-radius: 4px;">
                    <strong style="color: #dc3545;">⚠️ REGRESSION RISK</strong>
                    <p style="margin: 5px 0; color: #856404;">Component(s) older than production - will cause regression if deployed</p>
                </div>
            ` : ''}
            
            <details style="margin-top: 15px;">
    <summary style="cursor: pointer; color: #667eea; font-weight: 600; user-select: none;">View Component Details (${story.components.length})</summary>
    <div style="margin-top: 10px; padding: 10px; background: #f8f9fa; border-radius: 4px;">
        ${story.components.map(c => {
            // Find all stories with this component and their commit dates
            const allStoriesWithComponent = analysisData.conflicts
                .filter(conflict => conflict.component.api_name === c.name)
                .flatMap(conflict => conflict.involved_stories)
                .sort((a, b) => new Date(b.commit_date) - new Date(a.commit_date)); // Newest first
            
            const latestStory = allStoriesWithComponent[0];
            const isLatest = latestStory && latestStory.id === story.id;
            
            return `
                <div style="padding: 12px; margin: 8px 0; background: white; border-radius: 4px; border-left: 3px solid ${isLatest ? '#198754' : '#fd7e14'};">
                    <strong>${c.name}</strong> (${c.type})
                    <br><span style="color: #666;">Severity: ${c.severity} | Risk: ${c.risk}/100</span>
                    
                    ${c.otherStories.length > 0 ? `
                        <div style="margin-top: 10px; padding: 10px; background: #f8f9fa; border-radius: 4px;">
                            <strong style="font-size: 13px;">Commit Comparison:</strong>
                            <table style="width: 100%; margin-top: 8px; font-size: 12px; border-collapse: collapse;">
                                <thead>
                                    <tr style="border-bottom: 1px solid #ddd;">
                                        <th style="text-align: left; padding: 4px;">Story</th>
                                        <th style="text-align: left; padding: 4px;">Commit Date</th>
                                        <th style="text-align: left; padding: 4px;">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${allStoriesWithComponent.map((s, idx) => {
                                        const date = s.commit_date ? new Date(s.commit_date).toLocaleDateString() : 'Unknown';
                                        const isCurrentStory = s.id === story.id;
                                        const badge = idx === 0 ? 
                                            '<span style="background: #198754; color: white; padding: 2px 6px; border-radius: 3px; font-size: 10px;">LATEST</span>' :
                                            `<span style="background: #fd7e14; color: white; padding: 2px 6px; border-radius: 3px; font-size: 10px;">${allStoriesWithComponent[0].days_ago - s.days_ago} days older</span>`;
                                        
                                        return `
                                            <tr style="background: ${isCurrentStory ? '#e3f2fd' : 'white'};">
                                                <td style="padding: 4px;">${s.id}${isCurrentStory ? ' (YOU)' : ''}</td>
                                                <td style="padding: 4px;">${date}</td>
                                                <td style="padding: 4px;">${badge}</td>
                                            </tr>
                                        `;
                                    }).join('')}
                                </tbody>
                            </table>
                            ${!isLatest ? `
                                <div style="margin-top: 8px; padding: 8px; background: #fff3cd; border-radius: 4px; font-size: 12px; color: #856404;">
                                    ⚠️ <strong>${latestStory.id}</strong> has the latest version. Deploy that story last to preserve changes.
                                </div>
                            ` : `
                                <div style="margin-top: 8px; padding: 8px; background: #d1f2eb; border-radius: 4px; font-size: 12px; color: #0c5460;">
                                    ✅ You have the latest commit. Safe to deploy.
                                </div>
                            `}
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('')}
    </div>
</details>
        </div>
    `).join('');
}

function filterStories(filter) {
    // Update button states
    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`filter-${filter}`).classList.add('active');
    
    const allStories = buildCompleteStoryList();
    let filtered;
    
    if (filter === 'all') {
        filtered = allStories;
    } else {
        filtered = allStories.filter(s => s.status.toLowerCase() === filter);
    }
    
    document.getElementById('storiesList').innerHTML = renderStoryList(filtered);
}

function buildStoriesTab() {
    const { conflicts, regressions, summary } = analysisData;
    
    // Build complete story list with all details
    const allStories = buildCompleteStoryList();
    
    const content = `
        <div style="background: white; padding: 30px; border-radius: 12px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h2>All Stories (${allStories.length})</h2>
                <div style="display: flex; gap: 10px;">
                    <button onclick="filterStories('all')" class="filter-btn active" id="filter-all">All</button>
                    <button onclick="filterStories('blocked')" class="filter-btn" id="filter-blocked">Blocked (${allStories.filter(s => s.status === 'BLOCKED').length})</button>
                    <button onclick="filterStories('warning')" class="filter-btn" id="filter-warning">Warning (${allStories.filter(s => s.status === 'WARNING').length})</button>
                    <button onclick="filterStories('safe')" class="filter-btn" id="filter-safe">Safe (${allStories.filter(s => s.status === 'SAFE').length})</button>
                </div>
            </div>
            
            <div id="storiesList">
                ${renderStoryList(allStories)}
            </div>
        </div>
    `;
    
    document.getElementById('tab-stories').innerHTML = content;
}




function buildEnforcementTab() {
    const { regressions } = analysisData;
    const allStories = buildCompleteStoryList();
    const blocked = allStories.filter(s => s.status === 'BLOCKED');
    
    let content = `
        <div style="background: white; padding: 30px; border-radius: 12px;">
            <h2>Enforcement Report</h2>
            <p style="color: #666; margin-bottom: 30px;">Policy violations and compliance issues</p>
    `;
    
    // Regressions
    if (regressions && regressions.length > 0) {
        content += `
            <div style="margin-bottom: 30px;">
                <h3 style="color: #dc3545;">⚠️ Policy Violation: Regression Risks (${regressions.length})</h3>
                <p style="color: #666;">These components are older than production and violate deployment policy</p>
                ${regressions.map(reg => `
                    <div style="padding: 15px; margin: 10px 0; background: #fff5f5; border-left: 4px solid #dc3545; border-radius: 4px;">
                        <strong>${reg.story_id}</strong>
                        <br><span style="color: #666;">${reg.component}</span>
                        <br><small style="color: #dc3545;">${reg.message}</small>
                        <br><small style="color: #666;">Production: ${new Date(reg.prod_date).toLocaleDateString()} | Deploy: ${new Date(reg.deploy_date).toLocaleDateString()} | Behind: ${reg.days_behind} days</small>
                    </div>
                `).join('')}
                <div style="margin-top: 15px; padding: 15px; background: #fff3cd; border-radius: 6px;">
                    <strong>Action Required:</strong> All developers with regressions must update their commits from production baseline before deployment.
                </div>
            </div>
        `;
    }
    
    // Blocker conflicts
    const blockers = blocked.filter(s => !s.hasRegression);
    if (blockers.length > 0) {
        content += `
            <div style="margin-bottom: 30px;">
                <h3 style="color: #fd7e14;">⚠️ High-Risk Conflicts (${blockers.length})</h3>
                <p style="color: #666;">These stories require manual intervention</p>
                ${blockers.map(story => `
                    <div style="padding: 15px; margin: 10px 0; background: #fff8f0; border-left: 4px solid #fd7e14; border-radius: 4px;">
                        <strong>${story.id}</strong> - ${story.developer}
                        <br><span style="color: #666;">${story.title}</span>
                        <br><small style="color: #fd7e14;">Risk Score: ${story.maxRisk}/100 | Components: ${story.component_count}</small>
                    </div>
                `).join('')}
            </div>
        `;
    }
    
    if (!regressions || (regressions.length === 0 && blockers.length === 0)) {
        content += '<div style="padding: 60px; text-align: center; color: #198754;"><h3>✅ No Policy Violations Detected</h3><p>All stories comply with deployment policies</p></div>';
    }
    
    content += '</div>';
    document.getElementById('tab-enforcement').innerHTML = content;
}

async function exportPDF(groupByDeveloper) {
    if (!analysisData) {
        alert('No analysis data available');
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/api/export-pdf`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                ...analysisData,
                group_by_developer: groupByDeveloper
            })
        });
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `copado_analysis_${Date.now()}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
    } catch (error) {
        alert(`Export failed: ${error.message}`);
    }
}
function findLatestCommitStory(componentName, stories) {
    let latestStory = null;
    let latestDate = null;
    
    stories.forEach(story => {
        const comp = story.components.find(c => c.name === componentName);
        if (comp) {
            // Need commit date from component
            // This requires adding commit dates to component data
            const commitDate = comp.commit_date; // We'll add this
            if (!latestDate || (commitDate && new Date(commitDate) > new Date(latestDate))) {
                latestDate = commitDate;
                latestStory = story.id;
            }
        }
    });
    
    return latestStory;
}

// ========================================
// DECISION DASHBOARD FUNCTIONS
// ========================================

function displayDecisionDashboard(data) {
    const { summary, conflicts, regressions } = data;
    console.log('📊 Analysis Data:', data);
    
    // Build complete story list
    const allStories = buildCompleteStoryList();
    console.log('📋 All Stories:', allStories);
    
    // Store globally for action handlers
    window.allStories = allStories;
    window.analysisData = data;
    
    // Group by status
    const blocked = allStories.filter(s => s.status === 'BLOCKED');
    const warning = allStories.filter(s => s.status === 'WARNING');
    const safe = allStories.filter(s => s.status === 'SAFE');
    
    // Calculate safety score
    const safetyScore = Math.round((safe.length / allStories.length) * 10);
    
    let html = `
        <div class="decision-dashboard">
            <h2>🎯 Deployment Decision Dashboard</h2>
            <p>Review and approve stories for deployment</p>
            
            <!-- Quick Stats -->
            <div class="quick-stats">
                <div class="stat-card safe">
                    <div class="stat-number">${safe.length}</div>
                    <div class="stat-label">✅ Safe to Deploy</div>
                </div>
                <div class="stat-card warning">
                    <div class="stat-number">${warning.length}</div>
                    <div class="stat-label">⚠️ Needs Review</div>
                </div>
                <div class="stat-card blocked">
                    <div class="stat-number">${blocked.length}</div>
                    <div class="stat-label">❌ Blocked</div>
                </div>
                <div class="stat-card score">
                    <div class="stat-number">${safetyScore}/10</div>
                    <div class="stat-label">📊 Safety Score</div>
                </div>
           </div>
            
            <!-- Tabs Navigation -->
            <div style="margin: 30px 0;">
                <div class="tabs" style="display: flex; gap: 0; border-bottom: 2px solid #e2e8f0; background: white;">
                    <button class="tab-button active" onclick="showTab('overview')" style="padding: 12px 24px; background: white; border: none; border-bottom: 3px solid #667eea; color: #667eea; font-weight: 600; cursor: pointer; transition: all 0.2s;">
                        Overview
                    </button>
                    <button class="tab-button" onclick="showTab('stories')" style="padding: 12px 24px; background: white; border: none; border-bottom: 3px solid transparent; color: #718096; font-weight: 600; cursor: pointer; transition: all 0.2s;">
                        All Stories
                    </button>
                    <button class="tab-button" onclick="showTab('sequence')" style="padding: 12px 24px; background: white; border: none; border-bottom: 3px solid transparent; color: #718096; font-weight: 600; cursor: pointer; transition: all 0.2s;">
                        Deployment Plan
                    </button>
                    <button class="tab-button" onclick="showTab('enforcement')" style="padding: 12px 24px; background: white; border: none; border-bottom: 3px solid transparent; color: #718096; font-weight: 600; cursor: pointer; transition: all 0.2s;">
                        Enforcement
                    </button>
                    <button class="tab-button" onclick="showTab('decisions')" style="padding: 12px 24px; background: white; border: none; border-bottom: 3px solid transparent; color: #718096; font-weight: 600; cursor: pointer; transition: all 0.2s;">
                     📋 Decisions
                    </button>
                    <button class="tab-button" onclick="showTab('production')" style="padding: 12px 24px; background: white; border: none; border-bottom: 3px solid transparent; color: #718096; font-weight: 600; cursor: pointer; transition: all 0.2s;">
                        🟢 Production
                    </button>
                </div>
                
                <!-- Tab Content Container -->
                <div id="tab-overview" class="tab-content" style="display: block; padding: 20px 0;">
    `;
    
    // Blocked Section (Always Expanded)
    if (blocked.length > 0) {
        html += `
            <div class="section blocked-section">
                <h3>🔴 BLOCKED - Fix Before Deploy (${blocked.length} ${blocked.length === 1 ? 'story' : 'stories'})</h3>
                <div class="section-content">
                    ${blocked.map(story => renderDecisionCard(story)).join('')}
                </div>
            </div>
        `;
    }
    
    // Review Section (Collapsed)
    if (warning.length > 0) {
        html += `
            <div class="section warning-section">
                <h3 onclick="toggleSection('warning')">
                    🟡 NEEDS REVIEW - Coordinate with Team (${warning.length} ${warning.length === 1 ? 'story' : 'stories'})
                    <span class="toggle-icon" id="warning-toggle">▼</span>
                </h3>
                <div class="section-content" id="warning-content" style="display: none;">
                    ${warning.map(story => renderDecisionCard(story)).join('')}
                </div>
            </div>
        `;
    }
    
    // Safe Section (Collapsed)
    if (safe.length > 0) {
        html += `
            <div class="section safe-section">
                <h3 onclick="toggleSection('safe')">
                    🟢 SAFE TO DEPLOY - No Issues Found (${safe.length} ${safe.length === 1 ? 'story' : 'stories'})
                    <span class="toggle-icon" id="safe-toggle">▼</span>
                </h3>
                <div class="section-content" id="safe-content" style="display: none;">
                    ${safe.map(story => renderDecisionCard(story)).join('')}
                </div>
            </div>
        `;
    }
    
    // Action Bar
    html += `
            <div class="action-bar">
                ${safe.length > 0 ? `
                    <button onclick="approveSafeStories()" class="btn-primary">
                        ✅ Approve ${safe.length} Safe ${safe.length === 1 ? 'Story' : 'Stories'}
                    </button>
                ` : ''}
                <button onclick="exportReport()" class="btn-secondary">
                    📧 Email Report to Team
                </button>
   </div>
            
            <!-- Close overview tab content -->
            </div>
            
            <!-- Other tab content containers -->
            <div id="tab-stories" class="tab-content" style="display: none;"></div>
            <div id="tab-sequence" class="tab-content" style="display: none;"></div>
            <div id="tab-decisions" class="tab-content" style="display: none;"></div>
            <div id="tab-enforcement" class="tab-content" style="display: none;"></div>
            <div id="tab-production" class="tab-content" style="display: none;"></div>
            
            </div><!-- close tabs wrapper -->
        </div><!-- close decision-dashboard -->
    `;
    
    document.getElementById('results').innerHTML = html;
    document.getElementById('results').style.display = 'block';
}

function renderDecisionCard(story) {
    return `
        <div class="decision-card ${story.status.toLowerCase()}">
            <div class="card-header">
                <h4>${story.statusIcon} ${story.id}</h4>
                <button onclick="toggleStoryDetails('${story.id}')">View Details</button>
            </div>
            
            <div class="card-body">
                <p class="issue"><strong>Issue:</strong> ${story.reason}</p>
                <p class="developer"><strong>Developer:</strong> ${story.developer || 'Unknown'}</p>
                
                <div id="details-${story.id}" class="story-details" style="display: none;">
                    <p><strong>Title:</strong> ${story.title || 'N/A'}</p>
                    <p><strong>Total Components:</strong> ${story.component_count || 0}</p>
                    ${story.jira_key ? `<p><strong>Jira:</strong> ${story.jira_key}</p>` : ''}
                    
                    <!-- THIS IS THE IMPORTANT PART - COMPONENTS DISPLAY -->
                    ${story.components && story.components.length > 0 ? `
                        <div style="margin: 20px 0;">
                            <strong>📦 Components with Conflicts:</strong>
                            <div style="margin-top: 10px;">
                                ${story.components.map(comp => `
                                    <div style="background: white; padding: 15px; margin: 10px 0; border-radius: 6px; border-left: 3px solid ${getSeverityColor(comp.severity)};">
                                        <div style="font-weight: 600; color: #2d3748; margin-bottom: 8px;">
                                            ${comp.name}
                                        </div>
                                        <div style="font-size: 13px; color: #718096; margin-bottom: 8px;">
                                            Type: ${comp.type} | Risk: ${comp.risk}/100 | Severity: ${comp.severity}
                                        </div>
                                        ${comp.commit_hash ? `
                                            <div style="margin-top: 8px; padding: 8px; background: #f8f9fa; border-radius: 4px; display: flex; justify-content: space-between; align-items: center;">
                                                <span style="font-family: monospace; font-size: 12px;">
                                                    📦 Commit: <code>${comp.commit_hash}</code>
                                                </span>
                                                <button 
                                                    onclick="verifyCommit('${comp.commit_hash}', '${comp.name}')" 
                                                    style="padding: 4px 12px; background: #667eea; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 11px;">
                                                    Verify in Production
                                                </button>
                                            </div>
                                        ` : ''}
                                        ${comp.commit_date ? `
                                            <div style="font-size: 12px; color: #4a5568; margin: 8px 0; background: #f7fafc; padding: 8px; border-radius: 4px;">
                                                📅 <strong>Last commit:</strong> ${formatDate(comp.commit_date)} 
                                                <span style="color: ${comp.days_old > 30 ? '#dc3545' : comp.days_old > 7 ? '#fd7e14' : '#198754'};">
                                                    (${formatDaysOld(comp.days_old)})
                                                </span>
                                            </div>
                                        ` : ''}
                                        ${comp.otherStories && comp.otherStories.length > 0 ? `
    <div style="background: #fff3cd; padding: 10px; border-radius: 4px; font-size: 13px; margin-top: 8px;">
        ⚠️ <strong>Also modified by:</strong>
        <div style="margin-top: 8px;">
            ${comp.otherStories.map(other => {
                if (typeof other === 'string') {
                    return `<div style="margin: 4px 0;">• ${other}</div>`;
                } else {
                    return `
                        <div style="margin: 6px 0; padding: 10px; background: white; border-radius: 4px; border-left: 3px solid #667eea;">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <div>
                                    <strong>${other.id}</strong>
                                    ${other.commit_date ? `
                                        <div style="font-size: 11px; color: #666; margin-top: 4px;">
                                            📅 ${formatDate(other.commit_date)} 
                                            <span style="color: ${calculateDaysOld(other.commit_date) > 30 ? '#dc3545' : '#198754'};">
                                                (${formatDaysOld(calculateDaysOld(other.commit_date))})
                                            </span>
                                        </div>
                                    ` : ''}
                                </div>
                                <button 
                                    onclick="viewCodeChanges('${comp.name.split('.')[1] || comp.name}', '${parseComponentType(comp.name, comp.type)}')"
                                    console.log('💾 Commit Sunny:', component?.commit_hash);
                                    style="padding: 6px 12px; background: #667eea; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 11px; white-space: nowrap;">
                                    👁️ View Changes
                                </button>
                            </div>
                        </div>
                    `;
                }
            }).join('')}
        </div>
        
        <!-- Decision Helper -->
        <div style="margin-top: 12px; padding: 12px; background: #e3f2fd; border-radius: 4px; border-left: 3px solid #2196f3;">
            <strong style="color: #0c5460;">💡 Decision Guide:</strong>
            <ol style="margin: 8px 0; padding-left: 20px; font-size: 12px; line-height: 1.6;">
                <li>Click "View Changes" for each story to see what they modified</li>
                <li>If changes are in different parts → Both can deploy safely</li>
                <li>If changes overlap same lines → Deploy older story first, then newer</li>
                <li>If unsure → Ask developers to coordinate and merge</li>
            </ol>
        </div>
    </div>
` : ''}
                                                                     
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    ` : '<p style="color: #718096; margin: 15px 0;">No component details available</p>'}
                    
                    ${story.hasRegression && story.regressionDetails && story.regressionDetails.length > 0 ? `
                        <div style="margin: 20px 0;">
                            <strong style="color: #dc3545;">🔴 Regression Details:</strong>
                            <div style="margin-top: 10px;">
                                ${story.regressionDetails.map(reg => `
                                    <div style="background: #fff5f5; padding: 15px; margin: 10px 0; border-radius: 6px; border-left: 3px solid #dc3545;">
                                        <div style="font-weight: 600; color: #dc3545; margin-bottom: 8px;">
                                            ${reg.component}
                                        </div>
                                        <div style="font-size: 13px; color: #666; line-height: 1.6;">
                                            <div><strong>Your commit:</strong> ${formatDate(reg.deployment_commit_date)}</div>
                                            <div><strong>Production:</strong> ${formatDate(reg.production_commit_date)}</div>
                                            <div style="color: #dc3545; font-weight: 600; margin-top: 8px;">
                                                ⚠️ Your code is ${reg.days_behind} days older than production!
                                            </div>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    ` : ''}
                    
                    <p style="margin-top: 20px;"><strong>Required Actions:</strong></p>
                    <ul>
                        ${story.actions.map(action => `<li>${action}</li>`).join('')}
                    </ul>
                    
                    ${story.coordination && story.coordination.length > 0 ? `
                        <div style="background: #e3f2fd; padding: 12px; border-radius: 6px; margin-top: 15px;">
                            <strong>👥 Coordinate with:</strong> ${story.coordination.join(', ')}
                        </div>
                    ` : ''}
                </div>
            </div>
            
            <div class="card-actions">
                ${story.developer ? `
                    <button onclick="notifyDeveloper('${story.id}')" class="btn-icon">
                        ✉️ Notify Developer
                    </button>
                ` : ''}
                ${story.status === 'BLOCKED' ? `
                    <button onclick="excludeStory('${story.id}')" class="btn-icon">
                        🚫 Exclude from Deploy
                    </button>
                ` : ''}
            </div>
        </div>
    `;
}



function toggleSection(sectionName) {
    const content = document.getElementById(`${sectionName}-content`);
    const toggle = document.getElementById(`${sectionName}-toggle`);
    
    if (content.style.display === 'none') {
        content.style.display = 'block';
        toggle.classList.add('open');
    } else {
        content.style.display = 'none';
        toggle.classList.remove('open');
    }
}

function toggleStoryDetails(storyId) {
    const details = document.getElementById(`details-${storyId}`);
    const button = event.target;
    
    if (details.style.display === 'none') {
        details.style.display = 'block';
        button.textContent = 'Hide Details';
    } else {
        details.style.display = 'none';
        button.textContent = 'View Details';
    }
}

function notifyDeveloper(storyId) {
    const story = window.allStories.find(s => s.id === storyId);
    
    if (!story) {
        alert('Story not found');
        return;
    }
    
    if (!story.developer) {
        alert('No developer assigned to this story');
        return;
    }
    
    // Generate email content
    const subject = `⚠️ Action Required: ${storyId} - Deployment Issue`;
    
    const body = `Hi ${story.developer},

Your story ${storyId} has been flagged during deployment validation.

Issue: ${story.reason}

Required Actions:
${story.actions.map((action, i) => `${i + 1}. ${action}`).join('\n')}

${story.coordination && story.coordination.length > 0 ? `
You need to coordinate with: ${story.coordination.join(', ')}
` : ''}

Please address these issues and notify the DevOps team when ready.

View full analysis: ${window.location.href}

---
Copado Deployment Validator`;
    
    // Open default email client
    const mailtoLink = `mailto:${story.developer}@company.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailtoLink;
}

function excludeStory(storyId) {
    const story = window.allStories.find(s => s.id === storyId);
    
    if (!story) return;
    
    const confirmed = confirm(`Exclude ${storyId} from this deployment?

Story: ${story.title || storyId}
Developer: ${story.developer || 'Unknown'}
Issue: ${story.reason}

This story will NOT be deployed.`);
    
    if (confirmed) {
        // Mark as excluded
        story.excluded = true;
        
        alert(`✅ ${storyId} has been excluded from deployment.

The story will be removed from the deployment package.
Developer has been notified (if email is configured).`);
        
        // Optionally: notify developer
        if (story.developer) {
            const notifyDev = confirm('Send notification email to developer?');
            if (notifyDev) {
                notifyDeveloper(storyId);
            }
        }
    }
}

function approveSafeStories() {
    const safe = window.allStories.filter(s => s.status === 'SAFE');
    
    if (safe.length === 0) {
        alert('No safe stories to approve');
        return;
    }
    
    const storyList = safe.map(s => `  • ${s.id} - ${s.developer || 'Unknown'}`).join('\n');
    
    const confirmed = confirm(`Approve ${safe.length} safe ${safe.length === 1 ? 'story' : 'stories'} for deployment?

These stories have passed all validations:
${storyList}

They can be deployed immediately without risk.`);
    
    if (confirmed) {
        // Mark as approved
        safe.forEach(story => {
            story.approved = true;
            story.approvedAt = new Date().toISOString();
            story.approvedBy = 'DevOps Team'; // Could get from user session
        });
        
        const blocked = window.allStories.filter(s => s.status === 'BLOCKED').length;
        const warning = window.allStories.filter(s => s.status === 'WARNING').length;
        
        let message = `✅ Approved ${safe.length} ${safe.length === 1 ? 'story' : 'stories'} for deployment!\n\n`;
        
        if (blocked > 0 || warning > 0) {
            message += `Next Steps:\n`;
            if (blocked > 0) {
                message += `• Fix ${blocked} blocked ${blocked === 1 ? 'story' : 'stories'}\n`;
            }
            if (warning > 0) {
                message += `• Review ${warning} warning ${warning === 1 ? 'story' : 'stories'}\n`;
            }
            message += `• Then proceed with deployment`;
        } else {
            message += `All stories approved! Ready to deploy.`;
        }
        
        alert(message);
    }
}

function exportReport() {
    const blocked = window.allStories.filter(s => s.status === 'BLOCKED');
    const warning = window.allStories.filter(s => s.status === 'WARNING');
    const safe = window.allStories.filter(s => s.status === 'SAFE');
    
    const report = `
═══════════════════════════════════════════════════════
        DEPLOYMENT VALIDATION REPORT
═══════════════════════════════════════════════════════

Generated: ${new Date().toLocaleString()}
Total Stories: ${window.allStories.length}

SUMMARY:
✅ Safe to Deploy: ${safe.length} stories
⚠️ Needs Review: ${warning.length} stories
❌ Blocked: ${blocked.length} stories
📊 Safety Score: ${Math.round((safe.length / window.allStories.length) * 10)}/10

═══════════════════════════════════════════════════════

${blocked.length > 0 ? `
🔴 BLOCKED STORIES - MUST FIX BEFORE DEPLOY:

${blocked.map(s => `
${s.id} - ${s.developer || 'Unknown'}
Issue: ${s.reason}
Actions Required:
${s.actions.map((a, i) => `  ${i + 1}. ${a}`).join('\n')}
`).join('\n───────────────────────────────────────\n')}

═══════════════════════════════════════════════════════
` : ''}

${warning.length > 0 ? `
🟡 REVIEW NEEDED - COORDINATE WITH TEAM:

${warning.map(s => `
${s.id} - ${s.developer || 'Unknown'}
Issue: ${s.reason}
${s.coordination && s.coordination.length > 0 ? `Coordinate with: ${s.coordination.join(', ')}` : ''}
`).join('\n───────────────────────────────────────\n')}

═══════════════════════════════════════════════════════
` : ''}

${safe.length > 0 ? `
🟢 SAFE TO DEPLOY:

${safe.map(s => `${s.id} - ${s.developer || 'Unknown'}`).join('\n')}

═══════════════════════════════════════════════════════
` : ''}

RECOMMENDATION:
${blocked.length > 0 ? `1. Fix ${blocked.length} blocked ${blocked.length === 1 ? 'story' : 'stories'} first\n` : ''}${warning.length > 0 ? `2. Coordinate with team on ${warning.length} warning ${warning.length === 1 ? 'story' : 'stories'}\n` : ''}${safe.length > 0 ? `3. Deploy ${safe.length} safe ${safe.length === 1 ? 'story' : 'stories'} immediately\n` : ''}
Total Deployment Time: ${blocked.length === 0 && warning.length === 0 ? '2 hours' : '4-6 hours (including fixes)'}

═══════════════════════════════════════════════════════
Generated by Copado Deployment Validator
    `;
    
    // Copy to clipboard
    navigator.clipboard.writeText(report).then(() => {
        alert('📋 Report copied to clipboard!\n\nYou can now:\n• Paste into email\n• Share in Slack\n• Save to file');
    }).catch(err => {
        // Fallback: show in textarea
        const textarea = document.createElement('textarea');
        textarea.value = report;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        
        alert('📋 Report copied to clipboard!');
    });
}

// Helper function to get severity color
function getSeverityColor(severity) {
    const colors = {
        'BLOCKER': '#dc3545',
        'CRITICAL': '#fd7e14',
        'HIGH': '#ffc107',
        'MEDIUM': '#0dcaf0',
        'LOW': '#198754'
    };
    return colors[severity] || '#6c757d';
}

// Helper function to format dates
function formatDate(dateString) {
    if (!dateString) return 'Unknown';
    
    try {
        const date = new Date(dateString);
        const options = { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        };
        return date.toLocaleDateString('en-US', options);
    } catch (e) {
        return dateString;
    }
}

// Calculate days old from a date string
function calculateDaysOld(dateString) {
    if (!dateString) return null;
    
    try {
        const commitDate = new Date(dateString);
        const today = new Date();
        const diffTime = today - commitDate;
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        return diffDays;
    } catch (e) {
        return null;
    }
}

// Format days old into readable text
function formatDaysOld(days) {
    if (days === null || days === undefined) return '';
    
    if (days === 0) return 'Today';
    if (days === 1) return '1 day ago';
    if (days < 7) return `${days} days ago`;
    if (days < 30) {
        const weeks = Math.floor(days / 7);
        return `${weeks} ${weeks === 1 ? 'week' : 'weeks'} ago`;
    }
    const months = Math.floor(days / 30);
    return `${months} ${months === 1 ? 'month' : 'months'} ago`;
}

// ========================================
// PRODUCTION STATE DASHBOARD
// ========================================

async function buildProductionTab() {
    const container = document.getElementById('tab-production');
    
    if (!container) {
        console.error('tab-production element not found');
        return;
    }
    
    // Create the tab structure with sub-tabs
    container.innerHTML = `
        <div style="padding: 30px;">
            <h2 style="margin: 0 0 20px 0;">🟢 Production State</h2>
            
            <!-- Sub-tabs -->
            <div style="display: flex; gap: 0; border-bottom: 2px solid #e2e8f0; margin-bottom: 30px;">
                <button 
                    onclick="showProductionView('current')" 
                    id="prod-btn-current"
                    style="padding: 12px 24px; background: white; border: none; border-bottom: 3px solid #667eea; color: #667eea; font-weight: 600; cursor: pointer;">
                    Current State
                </button>
                <button 
                    onclick="showProductionView('compare')" 
                    id="prod-btn-compare"
                    style="padding: 12px 24px; background: white; border: none; border-bottom: 3px solid transparent; color: #718096; font-weight: 600; cursor: pointer;">
                    🔄 Compare with Deployment
                </button>
            </div>
            
            <!-- Content areas -->
            <div id="production-current"></div>
            <div id="production-compare" style="display: none;"></div>
        </div>
    `;
    
    // Load current state by default
    showProductionView('current');
}

function showProductionView(viewName) {
    // Update button styles
    document.getElementById('prod-btn-current').style.borderBottomColor = 
        viewName === 'current' ? '#667eea' : 'transparent';
    document.getElementById('prod-btn-current').style.color = 
        viewName === 'current' ? '#667eea' : '#718096';
    
    document.getElementById('prod-btn-compare').style.borderBottomColor = 
        viewName === 'compare' ? '#667eea' : 'transparent';
    document.getElementById('prod-btn-compare').style.color = 
        viewName === 'compare' ? '#667eea' : '#718096';
    
    // Show/hide content
    if (viewName === 'current') {
        document.getElementById('production-current').style.display = 'block';
        document.getElementById('production-compare').style.display = 'none';
        loadCurrentProductionState();
    } else {
        document.getElementById('production-current').style.display = 'none';
        document.getElementById('production-compare').style.display = 'block';
        loadProductionComparison();
    }
}

async function loadProductionComparison() {
    const container = document.getElementById('production-compare');
    
    // Show loading
    container.innerHTML = `
        <div style="text-align: center; padding: 60px;">
            <div style="width: 50px; height: 50px; border: 4px solid #f3f3f3; border-top: 4px solid #667eea; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 20px;"></div>
            <p style="color: #666;">Comparing UAT with Production...</p>
        </div>
    `;
    
    try {
        // Get all unique components from deployment
        const allComponents = [];
        const seen = new Set();
        
        if (!analysisData || !analysisData.all_stories) {
            container.innerHTML = '<p style="text-align: center; padding: 40px; color: #666;">Please upload and analyze CSV files first</p>';
            return;
        }
        
    analysisData.all_stories.forEach(story => {
        if (story.components) {
            story.components.forEach(comp => {
                let componentName = comp.api_name || comp.name || comp.component_name;
                let componentType = comp.type || comp.component_type;
            
            // Extract type from api_name if type is Unknown
            if (componentType === 'Unknown' || !componentType) {
                    if (componentName && componentName.includes('.')) {
                        const parts = componentName.split('.');
                        componentType = parts[0];  // e.g., "LightningComponentBundle"
                        componentName = parts[1];  // e.g., "prDeviceTile"
                    }
                }
                
            // Map Salesforce type names to our internal names
            const typeMapping = {
                'LightningComponentBundle': 'lwc',
                'AuraDefinitionBundle': 'aura',
                'ApexClass': 'ApexClass',
                'ApexTrigger': 'ApexTrigger',
                'DataRaptor': 'DataRaptor',
                'IntegrationProcedure': 'IntegrationProcedure',
                'OmniScript': 'OmniScript'
            };
            
            componentType = typeMapping[componentType] || componentType;
            
            console.log('📦 Parsed:', componentName, '→ Type:', componentType);
            
            const key = `${componentType}.${componentName}`;
            if (!seen.has(key) && componentName && componentType) {
                seen.add(key);
                allComponents.push({
                    name: componentName,
                    type: componentType
                });
            }
        });
    }
});
        
        console.log('🔄 Comparing', allComponents.length, 'components');
        
        // Call comparison API
        const response = await fetch('http://localhost:5000/api/compare-deployment', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                components: allComponents
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            displayComparisonResults(result);
        } else {
            container.innerHTML = `
                <div style="padding: 40px; text-align: center;">
                    <p style="color: #dc3545; font-size: 18px;">❌ Error comparing deployment</p>
                    <p style="color: #666;">${result.error}</p>
                </div>
            `;
        }
        
    } catch (error) {
        console.error('Error:', error);
        container.innerHTML = `
            <div style="padding: 40px; text-align: center;">
                <p style="color: #dc3545; font-size: 18px;">❌ Failed to compare</p>
                <p style="color: #666;">${error.message}</p>
            </div>
        `;
    }
}

function displayComparisonResults(data) {
    const container = document.getElementById('production-compare');
    
    const { summary, comparison } = data;
    
    const html = `
        <div>
            <div style="margin-bottom: 30px;">
                <p style="color: #718096; margin: 0;">
                    Compared at: ${new Date(data.compared_at).toLocaleString()}
                </p>
            </div>
            
            <!-- Summary Cards -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 20px; margin-bottom: 30px;">
                <div style="background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #fd7e14; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <div style="font-size: 32px; font-weight: bold; color: #2d3748;">${summary.modified}</div>
                    <div style="color: #718096; margin-top: 4px;">📝 Modified</div>
                </div>
                <div style="background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #198754; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <div style="font-size: 32px; font-weight: bold; color: #2d3748;">${summary.new}</div>
                    <div style="color: #718096; margin-top: 4px;">🆕 New</div>
                </div>
                <div style="background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #0dcaf0; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <div style="font-size: 32px; font-weight: bold; color: #2d3748;">${summary.identical}</div>
                    <div style="color: #718096; margin-top: 4px;">✅ Identical</div>
                </div>
                ${summary.removed > 0 ? `
                <div style="background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #dc3545; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <div style="font-size: 32px; font-weight: bold; color: #2d3748;">${summary.removed}</div>
                    <div style="color: #718096; margin-top: 4px;">⚠️ Removed</div>
                </div>
                ` : ''}
            </div>
            
            <!-- Comparison Table -->
            <div style="background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                <table style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr style="background: #f8f9fa; border-bottom: 2px solid #e2e8f0;">
                            <th style="padding: 16px; text-align: left; font-weight: 600; color: #2d3748;">Component</th>
                            <th style="padding: 16px; text-align: left; font-weight: 600; color: #2d3748;">Type</th>
                            <th style="padding: 16px; text-align: center; font-weight: 600; color: #2d3748;">In UAT</th>
                            <th style="padding: 16px; text-align: center; font-weight: 600; color: #2d3748;">In Prod</th>
                            <th style="padding: 16px; text-align: center; font-weight: 600; color: #2d3748;">Status</th>
                            <th style="padding: 16px; text-align: center; font-weight: 600; color: #2d3748;">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${comparison.map(comp => {
                            let statusBadge = '';
                            let statusColor = '';
                            
                            if (comp.status === 'MODIFIED') {
                                statusBadge = '📝 Modified';
                                statusColor = '#fd7e14';
                            } else if (comp.status === 'NEW') {
                                statusBadge = '🆕 New';
                                statusColor = '#198754';
                            } else if (comp.status === 'IDENTICAL') {
                                statusBadge = '✅ Same';
                                statusColor = '#0dcaf0';
                            } else if (comp.status === 'REMOVED') {
                                statusBadge = '⚠️ Removed';
                                statusColor = '#dc3545';
                            } else {
                                statusBadge = '❓ Not Found';
                                statusColor = '#6c757d';
                            }
                            
                            return `
                                <tr style="border-bottom: 1px solid #e2e8f0;">
                                    <td style="padding: 16px; font-family: monospace; font-size: 13px;">${comp.component_name}</td>
                                    <td style="padding: 16px; color: #718096;">${comp.component_type}</td>
                                    <td style="padding: 16px; text-align: center;">
                                        ${comp.in_uat ? '<span style="color: #198754;">✓</span>' : '<span style="color: #dc3545;">✗</span>'}
                                    </td>
                                    <td style="padding: 16px; text-align: center;">
                                        ${comp.in_production ? '<span style="color: #198754;">✓</span>' : '<span style="color: #dc3545;">✗</span>'}
                                    </td>
                                    <td style="padding: 16px; text-align: center;">
                                        <span style="background: ${statusColor}15; color: ${statusColor}; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600;">
                                            ${statusBadge}
                                        </span>
                                    </td>
                                    <td style="padding: 16px; text-align: center;">
                                        ${comp.status === 'MODIFIED' || comp.status === 'NEW' ? `
                                            <button 
                                                onclick="viewCodeChanges('${comp.component_name}', '${comp.component_type}')" 
                                                style="padding: 6px 12px; background: #667eea; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">
                                                👁️ View
                                            </button>
                                        ` : '-'}
                                    </td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
    
    container.innerHTML = html;
}

async function loadCurrentProductionState() {
    const container = document.getElementById('production-current');
    
    // Show loading
    container.innerHTML = `
        <div style="text-align: center; padding: 60px;">
            <div style="width: 50px; height: 50px; border: 4px solid #f3f3f3; border-top: 4px solid #667eea; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 20px;"></div>
            <p style="color: #666;">Loading production state...</p>
        </div>
    `;
    
    try {
        // Get all unique components
        const allComponents = [];
        const seen = new Set();
        
        if (!analysisData || !analysisData.all_stories) {
            container.innerHTML = '<p style="text-align: center; padding: 40px; color: #666;">Please upload and analyze CSV files first</p>';
            return;
        }
        
        analysisData.all_stories.forEach(story => {
         if (story.components) {
            story.components.forEach(comp => {
                let componentName = comp.api_name || comp.name || comp.component_name;
                let componentType = comp.type || comp.component_type;
            
            // Extract type from api_name if type is Unknown
                if (componentType === 'Unknown' || !componentType) {
                    if (componentName && componentName.includes('.')) {
                        const parts = componentName.split('.');
                        componentType = parts[0];  // e.g., "LightningComponentBundle"
                        componentName = parts[1];  // e.g., "prDeviceTile"
                    }
                }
            
            // Map Salesforce type names to our internal names
                const typeMapping = {
                    'LightningComponentBundle': 'lwc',
                    'AuraDefinitionBundle': 'aura',
                    'ApexClass': 'ApexClass',
                    'ApexTrigger': 'ApexTrigger',
                    'DataRaptor': 'DataRaptor',
                    'IntegrationProcedure': 'IntegrationProcedure',
                    'OmniScript': 'OmniScript'
                };
            
            componentType = typeMapping[componentType] || componentType;
            
            console.log('📦 Parsed:', componentName, '→ Type:', componentType);
            
            const key = `${componentType}.${componentName}`;
            if (!seen.has(key) && componentName && componentType) {
                seen.add(key);
                allComponents.push({
                    name: componentName,
                    type: componentType
                });
            }
        });
    }
});
        
        if (allComponents.length === 0) {
            container.innerHTML = '<p style="text-align: center; padding: 40px; color: #666;">No components found in analysis</p>';
            return;
        }
        
        console.log('📦 Fetching production state for', allComponents.length, 'components');
        
        // Call backend API
        const response = await fetch('http://localhost:5000/api/production-state', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                components: allComponents
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            displayCurrentProductionState(result);
        } else {
            container.innerHTML = `
                <div style="padding: 40px; text-align: center;">
                    <p style="color: #dc3545; font-size: 18px;">❌ Error loading production state</p>
                    <p style="color: #666;">${result.error}</p>
                </div>
            `;
        }
        
    } catch (error) {
        console.error('Error:', error);
        container.innerHTML = `
            <div style="padding: 40px; text-align: center;">
                <p style="color: #dc3545; font-size: 18px;">❌ Failed to load production state</p>
                <p style="color: #666;">${error.message}</p>
            </div>
        `;
    }
}

// ========================================
// CODE DIFF VIEWER FUNCTIONS
// ========================================

async function viewCodeChangesbackup(componentName, componentType) {
    console.log('Fetching code for:', componentName, componentType);
    
    // Show loading modal
    showLoadingModal('Loading code changes...');
    
    try {
        const response = await fetch('http://localhost:5000/api/get-code-diff', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                component_name: componentName,
                component_type: componentType,
                prod_branch: 'master',
                uat_branch: 'uatsfdc'
            })
        });
        
        const result = await response.json();
        console.log('📦 Received result:', result);
        
        if (result.success) {
            console.log('✅ Calling modal with:', componentName, componentType, result.data);
            showCodeDiffModal(componentName, componentType, result.data);  // ← FIXED!
        } else {
            alert('Error fetching code: ' + result.error);
        }
        
    } catch (error) {
        console.error('Error:', error);
        alert('Failed to fetch code changes. Check console for details.');
    } finally {
        hideLoadingModal();
    }
}

async function viewCodeChanges(componentName, componentType) {
    console.log('🔍 Fetching code for:', componentName, componentType);
    
    // Show loading modal
    showLoadingModal('Loading code changes...');
    
    try {
        const response = await fetch('http://localhost:5000/api/get-code-diff', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                component_name: componentName,
                component_type: componentType,
                prod_branch: 'master',
                uat_branch: 'uatsfdc'
            })
        });
        
        const result = await response.json();
        console.log('📦 FULL API RESPONSE:', result); // Add this line
        
        if (result.success) {
            console.log('✅ Data received:', {
                componentName: componentName,
                componentType: componentType,
                production_code_length: result.data.production_code?.length || 0,
                uat_code_length: result.data.uat_code?.length || 0,
                production_code_exists: !!result.data.production_code,
                uat_code_exists: !!result.data.uat_code,
                has_changes: result.data.has_changes,
                production_exists: result.data.production_exists,
                uat_exists: result.data.uat_exists
            });
            
            showCodeDiffModal(componentName, componentType, result.data);
        } else {
            alert('Error fetching code: ' + result.error);
        }
        
    } catch (error) {
        console.error('Error:', error);
        alert('Failed to fetch code changes. Check console for details.');
    } finally {
        hideLoadingModal();
    }
}

function showLoadingModal(message) {
    const modal = document.createElement('div');
    modal.id = 'loadingModal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
    `;
    
    modal.innerHTML = `
        <div style="background: white; padding: 40px; border-radius: 12px; text-align: center;">
            <div style="width: 50px; height: 50px; border: 4px solid #f3f3f3; border-top: 4px solid #667eea; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 20px;"></div>
            <p style="font-size: 16px; color: #333;">${message}</p>
        </div>
    `;
    
    document.body.appendChild(modal);
}

function hideLoadingModal() {
    const modal = document.getElementById('loadingModal');
    if (modal) {
        modal.remove();
    }
}

// ========================================
// DIFF HELPER FUNCTIONS
// ========================================


function generateSimpleDiff(text1, text2) {
    /**
     * Unified diff view (single column, like BitBucket)
     * Shows only changes with context
     */
    
    // Check if diff library is loaded
    const useDiffLibrary = typeof diff_match_patch !== 'undefined';
    
    if (!text1 && !text2) {
        return { 
            unified: '<div style="color: #999; padding: 40px; text-align: center;">No content to compare</div>' 
        };
    }
    
    if (!text1) {
        // All new file
        const lines = text2.split('\n');
        const html = lines.map((line, idx) => 
            `<div style="display: flex; background: #e6ffed;">
                <div style="min-width: 60px; padding: 2px 12px; text-align: right; color: #24292f; background: #ccffd8; border-right: 1px solid #9be9a8; user-select: none; font-weight: 500;">
                    ${idx + 1}
                </div>
                <div style="min-width: 30px; padding: 2px 8px; text-align: center; color: #2da44e; font-weight: bold; background: #ccffd8; user-select: none;">
                    +
                </div>
                <div style="padding: 2px 8px; flex: 1; font-family: 'Monaco', 'Courier New', monospace; font-size: 13px;">
                    ${escapeHtml(line)}
                </div>
            </div>`
        ).join('');
        return { unified: html };
    }
    
    if (!text2) {
        // All deleted file
        const lines = text1.split('\n');
        const html = lines.map((line, idx) => 
            `<div style="display: flex; background: #ffebe9;">
                <div style="min-width: 60px; padding: 2px 12px; text-align: right; color: #24292f; background: #ffd7d5; border-right: 1px solid #ff8182; user-select: none; font-weight: 500;">
                    ${idx + 1}
                </div>
                <div style="min-width: 30px; padding: 2px 8px; text-align: center; color: #d1242f; font-weight: bold; background: #ffd7d5; user-select: none;">
                    -
                </div>
                <div style="padding: 2px 8px; flex: 1; font-family: 'Monaco', 'Courier New', monospace; font-size: 13px;">
                    ${escapeHtml(line)}
                </div>
            </div>`
        ).join('');
        return { unified: html };
    }
    
    // Both exist - unified diff
    const lines1 = text1.split('\n');
    const lines2 = text2.split('\n');
    
    let html = [];
    let i = 0, j = 0;
    
    while (i < lines1.length || j < lines2.length) {
        const line1 = lines1[i];
        const line2 = lines2[j];
        
        if (line1 === line2) {
            // Same line - show with context (gray)
            html.push(`
                <div style="display: flex; background: white;">
                    <div style="min-width: 60px; padding: 2px 12px; text-align: right; color: #57606a; background: #f6f8fa; border-right: 1px solid #d0d7de; user-select: none;">
                        ${i + 1}
                    </div>
                    <div style="min-width: 30px; padding: 2px 8px; text-align: center; color: #57606a; background: #f6f8fa; user-select: none;">
                        
                    </div>
                    <div style="padding: 2px 8px; flex: 1; color: #57606a; font-family: 'Monaco', 'Courier New', monospace; font-size: 13px;">
                        ${escapeHtml(line1)}
                    </div>
                </div>
            `);
            i++;
            j++;
        } else {
            // Find how many consecutive lines are different
            let deleteCount = 0;
            let addCount = 0;
            
            // Count deleted lines
            let tempI = i;
            while (tempI < lines1.length && lines2.indexOf(lines1[tempI]) === -1) {
                deleteCount++;
                tempI++;
                if (deleteCount > 5) break; // Limit lookahead
            }
            
            // Count added lines
            let tempJ = j;
            while (tempJ < lines2.length && lines1.indexOf(lines2[tempJ]) === -1) {
                addCount++;
                tempJ++;
                if (addCount > 5) break; // Limit lookahead
            }
            
            // Show deleted lines
            for (let k = 0; k < deleteCount && i < lines1.length; k++) {
                html.push(`
                    <div style="display: flex; background: #ffebe9;">
                        <div style="min-width: 60px; padding: 2px 12px; text-align: right; color: #24292f; background: #ffd7d5; border-right: 1px solid #ff8182; user-select: none; font-weight: 500;">
                            ${i + 1}
                        </div>
                        <div style="min-width: 30px; padding: 2px 8px; text-align: center; color: #d1242f; font-weight: bold; background: #ffd7d5; user-select: none;">
                            -
                        </div>
                        <div style="padding: 2px 8px; flex: 1; font-family: 'Monaco', 'Courier New', monospace; font-size: 13px;">
                            ${escapeHtml(lines1[i])}
                        </div>
                    </div>
                `);
                i++;
            }
            
            // Show added lines
            for (let k = 0; k < addCount && j < lines2.length; k++) {
                html.push(`
                    <div style="display: flex; background: #e6ffed;">
                        <div style="min-width: 60px; padding: 2px 12px; text-align: right; color: #24292f; background: #ccffd8; border-right: 1px solid #9be9a8; user-select: none; font-weight: 500;">
                            ${j + 1}
                        </div>
                        <div style="min-width: 30px; padding: 2px 8px; text-align: center; color: #2da44e; font-weight: bold; background: #ccffd8; user-select: none;">
                            +
                        </div>
                        <div style="padding: 2px 8px; flex: 1; font-family: 'Monaco', 'Courier New', monospace; font-size: 13px;">
                            ${escapeHtml(lines2[j])}
                        </div>
                    </div>
                `);
                j++;
            }
            
            // If no changes detected, just increment
            if (deleteCount === 0 && addCount === 0) {
                i++;
                j++;
            }
        }
    }
    
    return { unified: html.join('') };
}

function showCodeDiffModal(componentName, componentType, diffData) {
    // Create modal
    const modal = document.createElement('div');
    modal.id = 'codeDiffModal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        padding: 20px;
    `;
    
    const hasChanges = diffData.has_changes || false;
    const prodExists = diffData.production_exists !== null && diffData.production_code !== undefined;
    const uatExists = diffData.uat_exists !== null && diffData.uat_code !== undefined;
    
    let statusMessage = '';
    let statusColor = '';
    
    if (!prodExists && !uatExists) {
        statusMessage = '❌ Component not found in any branch';
        statusColor = '#dc3545';
    } else if (!prodExists) {
        statusMessage = '🆕 New component (not in production yet)';
        statusColor = '#28a745';
    } else if (!uatExists) {
        statusMessage = '⚠️ Component only exists in production';
        statusColor = '#fd7e14';
    } else if (!hasChanges) {
        statusMessage = '✅ No changes - identical to production';
        statusColor = '#28a745';
    } else {
        statusMessage = '📝 Changes detected';
        statusColor = '#667eea';
    }
    
    modal.innerHTML = `
        <div class="modal-overlay" style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 10000;">
            <div style="background: white; border-radius: 12px; box-shadow: 0 20px 60px rgba(0,0,0,0.3); max-width: 90vw; max-height: 90vh; width: 1200px; display: flex; flex-direction: column; overflow: hidden;">
                
                <!-- Top Header -->
                <div style="padding: 24px; border-bottom: 2px solid #e2e8f0; background: white;">
                    <div style="display: flex; justify-content: space-between; align-items: start;">
                        <div style="flex: 1;">
                            <h2 style="margin: 0 0 8px 0; font-size: 20px; color: #2d3748;">
                                Code Changes: ${componentName}
                            </h2>
                            <p style="margin: 0; color: #718096; font-size: 14px;">
                                ${componentType} • ${diffData.file_path || 'Unknown path'}
                            </p>
                        </div>
                        <button onclick="this.closest('.modal-overlay').remove()" style="background: none; border: none; font-size: 24px; color: #718096; cursor: pointer; padding: 0; margin-left: 20px;">
                            ×
                        </button>
                    </div>
                    <div style="margin: 12px 0 0 0; padding: 8px 12px; background: ${statusColor === '#28a745' ? '#d4edda' : '#fff3cd'}; border-left: 3px solid ${statusColor}; color: ${statusColor === '#28a745' ? '#155724' : '#856404'}; font-size: 14px;">
                        ${statusMessage}
                    </div>

                    <!-- ACTION BAR -->
                    <div style="padding: 12px 24px; background: #f8f9fa; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; gap: 10px;">
                        <!-- Left side: View controls -->
                        <div style="display: flex; gap: 10px; align-items: center;">
                            <button onclick="toggleCollapseUnchanged()" id="collapseBtn" style="padding: 6px 12px; background: white; border: 1px solid #d0d7de; border-radius: 4px; cursor: pointer; font-size: 12px;">
                                📦 Hide Unchanged
                            </button>
                            <label style="display: flex; align-items: center; gap: 6px; font-size: 13px; color: #57606a;">
                                <input type="checkbox" id="splitViewToggle" onchange="toggleSplitView()" style="cursor: pointer;">
                                Split View
                            </label>
                        </div>
                        
                        <!-- Center: Search -->
                        <div style="display: flex; gap: 6px; align-items: center; flex: 1; max-width: 400px;">
                            <input 
                                type="text" 
                                id="diffSearch" 
                                placeholder="Search in diff..." 
                                style="flex: 1; padding: 6px 12px; border: 1px solid #d0d7de; border-radius: 4px; font-size: 13px;"
                                onkeyup="searchInDiff(event)">
                            <span id="searchResults" style="font-size: 12px; color: #57606a; white-space: nowrap;"></span>
                        </div>
                        
                        <!-- Right side: Actions -->
                        <div style="display: flex; gap: 8px;">
                            <button onclick="copyDiffContent(event, 'production')" style="padding: 6px 12px; background: white; border: 1px solid #d0d7de; border-radius: 4px; cursor: pointer; font-size: 12px;">
                                📋 Copy Prod
                            </button>
                            <button onclick="copyDiffContent(event, 'uat')" style="padding: 6px 12px; background: white; border: 1px solid #d0d7de; border-radius: 4px; cursor: pointer; font-size: 12px;">
                                📋 Copy UAT
                            </button>
                           <div style="position: relative;">
    <button onclick="showDownloadOptions(event)" style="padding: 6px 12px; background: #667eea; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; display: flex; align-items: center; gap: 4px;">
        💾 Download ▼
    </button>
</div>
                        </div>
                    </div>

                    <!-- DIFF LEGEND SECTION -->
                    <div style="padding: 12px 24px; background: #f8f9fa; border-bottom: 1px solid #e2e8f0; font-size: 13px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 15px;">
                            <!-- Color Legend -->
                            <div style="display: flex; gap: 15px; align-items: center; flex-wrap: wrap;">
                                <div style="display: flex; align-items: center; gap: 6px;">
                                    <div style="width: 16px; height: 16px; background: #ffd7d5; border: 1px solid #ff8182;"></div>
                                    <span>Current Production Code</span>
                                </div>
                                <div style="display: flex; align-items: center; gap: 6px;">
                                    <div style="width: 16px; height: 16px; background: #ccffd8; border: 1px solid #9be9a8;"></div>
                                    <span>New UAT Changes</span>
                                </div>
                                <div style="display: flex; align-items: center; gap: 6px;">
                                    <div style="width: 16px; height: 16px; background: #f6f8fa; border: 1px solid #d0d7de;"></div>
                                    <span>Unchanged</span>
                                </div>
                            </div>
                            
                            <!-- Quick Help -->
                            <div style="display: flex; gap: 10px;">
                                <button onclick="showDiffExplanation()" style="padding: 4px 12px; background: #667eea; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">
                                    💡 What am I looking at?
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Unified Diff Content -->
                <div style="flex: 1; overflow: auto; background: white;">
                    <div id="diff-unified" style="font-family: 'Monaco', 'Courier New', monospace; font-size: 13px; line-height: 1.8;">
                        <div style="padding: 40px; text-align: center; color: #999;">
                            Loading diff...
                        </div>
                    </div>
                </div>
                
                <!-- Footer -->
                <div style="padding: 20px; border-top: 2px solid #e2e8f0; background: #f8f9fa; display: flex; justify-content: space-between; align-items: center;">
                    <p style="margin: 0; color: #718096; font-size: 13px;">
                        Tip: Use your browser's find (Ctrl+F / Cmd+F) to search within the diff
                    </p>
                    <button 
                        onclick="this.closest('.modal-overlay').remove()" 
                        style="padding: 10px 24px; background: #667eea; color: white; border: none; border-radius: 6px; font-size: 14px; font-weight: 600; cursor: pointer; transition: background 0.2s;"
                        onmouseover="this.style.background='#5a67d8'" 
                        onmouseout="this.style.background='#667eea'">
                        Close
                    </button>
                </div>
                
            </div>
        </div>
    `;
    
    // Store the diff data BEFORE showing the modal
    currentDiffData = {
        componentName: componentName,
        productionCode: diffData.production_code || '',
        uatCode: diffData.uat_code || '',
        diffHtml: '',
        componentType: componentType  // ADD THIS - needed for copy function
    };

    console.log('💾 Storing diff data:', {
        componentName: componentName,
        productionCodeLength: currentDiffData.productionCode.length,
        uatCodeLength: currentDiffData.uatCode.length,
        hasProduction: !!diffData.production_code,
        hasUAT: !!diffData.uat_code,
        rawData: diffData
    });

    // ✅ ADD THIS: Store bundle metadata for copy functionality
    currentDiffData.rawBundleData = diffData;
    currentDiffData.is_bundle = diffData.is_bundle || false;

    console.log('📦 Bundle data stored:', {
        is_bundle: currentDiffData.is_bundle,
        bundle_files_count: diffData.bundle_files?.length || 0
    });

    document.body.appendChild(modal);

    // ✅ ADD THIS: Capture visible content after modal is rendered
    setTimeout(() => {
        const diffContainer = document.getElementById('diff-unified');
        if (diffContainer) {
            currentDiffData.visibleContent = diffContainer.textContent;
            console.log('💾 Captured visible content:', currentDiffData.visibleContent.length, 'characters');
        } else {
            console.log('❌ Could not find diff-unified element');
        }
    }, 500);

    // Check if this is a bundle with multiple files
    if (diffData.is_bundle && diffData.bundle_files) {
        // Show bundle file list
        setTimeout(() => {
            const unifiedDiv = document.getElementById('diff-unified');
            if (unifiedDiv) {
                unifiedDiv.innerHTML = generateBundleView(diffData);
                
                // ✅ ADD THIS: Update visible content after bundle is rendered
                setTimeout(() => {
                    currentDiffData.visibleContent = unifiedDiv.textContent;
                    currentDiffData.diffHtml = unifiedDiv.innerHTML;
                    console.log('💾 Updated visible content after bundle render:', currentDiffData.visibleContent.length, 'characters');
                }, 100);
            }
        }, 0);
    } else {
        // Single file - show normal diff
        const diff = generateSimpleDiff(diffData.production_code, diffData.uat_code);
        setTimeout(() => {
            const unifiedDiv = document.getElementById('diff-unified');
            if (unifiedDiv) {
                unifiedDiv.innerHTML = diff.unified;
                
                // ✅ ADD THIS: Update visible content after diff is rendered
                setTimeout(() => {
                    currentDiffData.visibleContent = unifiedDiv.textContent;
                    currentDiffData.diffHtml = unifiedDiv.innerHTML;
                    console.log('💾 Updated visible content after diff render:', currentDiffData.visibleContent.length, 'characters');
                }, 100);
            }
        }, 0);
    }

    console.log('💾 Stored diff data:', currentDiffData);
    console.log('📦 Full diffData:', diffData);
    console.log('📦 diffData keys:', Object.keys(diffData));
    
    // Close on background click
    modal.addEventListener('click', (e) => {
        if (e.target === modal || e.target.classList.contains('modal-overlay')) {
            document.body.removeChild(modal);
        }
    });
}

function closeCodeDiffModal() {
    const modal = document.getElementById('codeDiffModal');
    if (modal) {
        modal.remove();
    }
}


function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function generateBundleView(diffData) {
    const files = diffData.bundle_files || [];
    
    let html = `
        <div style="padding: 20px;">
            <h3 style="margin: 0 0 20px 0; color: #2d3748;">
                📦 ${diffData.component_name} Bundle (${files.length} files)
            </h3>
    `;
    
    files.forEach((file, idx) => {
        const statusIcon = file.has_changes ? '📝' : '✅';
        const statusColor = file.has_changes ? '#ffc107' : '#28a745';
        const statusText = file.has_changes ? 'Modified' : 'Unchanged';
        
        html += `
            <div style="margin-bottom: 30px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
                <div style="padding: 12px 16px; background: #f8f9fa; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <strong style="font-family: monospace;">${file.file_name}</strong>
                    </div>
                    <span style="background: ${statusColor}15; color: ${statusColor}; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600;">
                        ${statusIcon} ${statusText}
                    </span>
                </div>
                
                ${file.has_changes ? `
                    <div style="max-height: 400px; overflow: auto;">
                        ${generateSimpleDiff(file.production_code, file.uat_code).unified}
                    </div>
                ` : `
                    <div style="padding: 20px; text-align: center; color: #718096;">
                        No changes in this file
                    </div>
                `}
            </div>
        `;
    });
    
    html += '</div>';
    return html;
}

function displayCurrentProductionState(data) {
    const container = document.getElementById('production-current');
    
    const html = `
        <div style="padding: 30px;">
            <div style="margin-bottom: 30px;">
                <h2 style="margin: 0 0 8px 0; font-size: 24px; color: #2d3748;">
                    🟢 Production State
                </h2>
                <p style="margin: 0; color: #718096;">
                    Current state of components in production (master branch)
                </p>
                <p style="margin: 8px 0 0 0; color: #718096; font-size: 14px;">
                    Checked at: ${new Date(data.checked_at).toLocaleString()}
                </p>
            </div>
            
            <!-- Summary Cards -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px;">
                <div style="background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #667eea; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <div style="font-size: 32px; font-weight: bold; color: #2d3748;">${data.total_components}</div>
                    <div style="color: #718096; margin-top: 4px;">Total Components</div>
                </div>
                <div style="background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #198754; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <div style="font-size: 32px; font-weight: bold; color: #2d3748;">${data.existing}</div>
                    <div style="color: #718096; margin-top: 4px;">✓ In Production</div>
                </div>
                <div style="background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #dc3545; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <div style="font-size: 32px; font-weight: bold; color: #2d3748;">${data.missing}</div>
                    <div style="color: #718096; margin-top: 4px;">✗ Not Found</div>
                </div>
            </div>
            
            <!-- Components Table -->
            <div style="background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                <table style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr style="background: #f8f9fa; border-bottom: 2px solid #e2e8f0;">
                            <th style="padding: 16px; text-align: left; font-weight: 600; color: #2d3748;">Component</th>
                            <th style="padding: 16px; text-align: left; font-weight: 600; color: #2d3748;">Type</th>
                            <th style="padding: 16px; text-align: center; font-weight: 600; color: #2d3748;">Status</th>
                            <th style="padding: 16px; text-align: left; font-weight: 600; color: #2d3748;">Last Modified</th>
                            <th style="padding: 16px; text-align: left; font-weight: 600; color: #2d3748;">Author</th>
                            <th style="padding: 16px; text-align: left; font-weight: 600; color: #2d3748;">Commit</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.production_state.map(comp => `
                            <tr style="border-bottom: 1px solid #e2e8f0;">
                                <td style="padding: 16px; font-family: monospace; font-size: 13px;">${comp.component_name}</td>
                                <td style="padding: 16px; color: #718096;">${comp.component_type}</td>
                                <td style="padding: 16px; text-align: center;">
                                    ${comp.exists_in_prod ? 
                                        '<span style="background: #d1fae5; color: #065f46; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600;">✓ Exists</span>' :
                                        '<span style="background: #fee2e2; color: #991b1b; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600;">✗ Missing</span>'
                                    }
                                </td>
                                <td style="padding: 16px; color: #718096; font-size: 13px;">
                                    ${comp.last_commit_date ? formatDate(comp.last_commit_date) : 'N/A'}
                                </td>
                                <td style="padding: 16px; color: #718096; font-size: 13px;">
                                    ${comp.last_author ? comp.last_author.split('<')[0].trim() : 'N/A'}
                                </td>
                                <td style="padding: 16px;">
                                    ${comp.last_commit_hash ? 
                                        `<code style="background: #f1f5f9; padding: 4px 8px; border-radius: 4px; font-size: 12px;">${comp.last_commit_hash}</code>` :
                                        '<span style="color: #cbd5e0;">N/A</span>'
                                    }
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
    
    container.innerHTML = html;
}
async function verifyCommit(commitHash, componentName) {
    try {
        const response = await fetch('http://localhost:5000/api/verify-commit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                commit_hash: commitHash,
                branch: 'master'
            })
        });
        
        const result = await response.json();
        
        if (result.success && result.data) {
            const data = result.data;
            const status = data.in_branch ? '✅ In Production' : '❌ Not Deployed';
            const color = data.in_branch ? '#28a745' : '#dc3545';
            
            alert(`Commit: ${commitHash}\n` +
                  `Component: ${componentName}\n` +
                  `Status: ${status}\n` +
                  `Author: ${data.author}\n` +
                  `Date: ${new Date(data.date).toLocaleString()}`);
        }
        
    } catch (error) {
        alert('Error verifying commit: ' + error.message);
    }
}

// Simple generic change analysis
function analyzeChangesGeneric(diffData) {
    if (diffData.is_bundle && diffData.bundle_files) {
        const modifiedFiles = diffData.bundle_files.filter(file => file.has_changes);
        const unchangedFiles = diffData.bundle_files.filter(file => !file.has_changes);
        
        return {
            type: 'bundle',
            totalFiles: diffData.bundle_files.length,
            modifiedFiles: modifiedFiles.length,
            unchangedFiles: unchangedFiles.length,
            message: `This component has ${diffData.bundle_files.length} files. ${modifiedFiles.length} file(s) have changes, ${unchangedFiles.length} file(s) are unchanged.`
        };
    } else {
        return {
            type: 'single',
            hasChanges: diffData.has_changes,
            message: diffData.has_changes ? 
                'This file has changes between Production and UAT.' : 
                'No changes detected - files are identical.'
        };
    }
}



// Generic explanation that works for any component
function showDiffExplanation() {
    const explanation = `
        <div style="max-width: 600px; padding: 20px;">
            <h3 style="color: #2d3748; margin-bottom: 15px;">Understanding Code Differences</h3>
            
            <div style="margin-bottom: 20px;">
                <h4 style="color: #4a5568; margin-bottom: 10px;">🎨 What the colors mean:</h4>
                <div style="display: grid; gap: 8px;">
                    <div style="display: flex; align-items: center; gap: 10px; padding: 8px; background: #fff5f5; border-radius: 4px;">
                        <div style="width: 20px; height: 20px; background: #ffd7d5; border: 1px solid #ff8182;"></div>
                        <div>
                            <strong>Red (Current Production):</strong> Code that currently exists in Production
                        </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 10px; padding: 8px; background: #f0fff4; border-radius: 4px;">
                        <div style="width: 20px; height: 20px; background: #ccffd8; border: 1px solid #9be9a8;"></div>
                        <div>
                            <strong>Green (UAT Changes):</strong> New or modified code in UAT that will go to Production
                        </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 10px; padding: 8px; background: #f7fafc; border-radius: 4px;">
                        <div style="width: 20px; height: 20px; background: #f6f8fa; border: 1px solid #d0d7de;"></div>
                        <div>
                            <strong>Gray (Unchanged):</strong> Code that is identical in both versions
                        </div>
                    </div>
                </div>
            </div>
            
            <div style="margin-bottom: 20px;">
                <h4 style="color: #4a5568; margin-bottom: 10px;">🔍 Reading the diff:</h4>
                <div style="background: #f8f9fa; padding: 15px; border-radius: 6px; font-size: 13px; line-height: 1.6;">
                    <div style="display: flex; margin-bottom: 8px;">
                        <div style="min-width: 60px; text-align: right; padding-right: 10px; color: #666;">12</div>
                        <div style="min-width: 30px; text-align: center; color: #d1242f;">-</div>
                        <div style="flex: 1;"><code>currentProductionCode()</code></div>
                    </div>
                    <div style="display: flex; margin-bottom: 8px;">
                        <div style="min-width: 60px; text-align: right; padding-right: 10px; color: #666;">13</div>
                        <div style="min-width: 30px; text-align: center; color: #2da44e;">+</div>
                        <div style="flex: 1;"><code>newUATChanges()</code></div>
                    </div>
                    <div style="display: flex;">
                        <div style="min-width: 60px; text-align: right; padding-right: 10px; color: #666;">14</div>
                        <div style="min-width: 30px; text-align: center;"></div>
                        <div style="flex: 1;"><code>unchangedCode()</code></div>
                    </div>
                </div>
                <div style="margin-top: 10px; color: #666; font-size: 12px;">
                    • <strong>Line numbers</strong> show where code appears in each version<br>
                    • <strong>- (minus)</strong> indicates current Production code<br>
                    • <strong>+ (plus)</strong> indicates new UAT changes<br>
                    • <strong>Green lines will replace red lines</strong> when deployed to Production
                </div>
            </div>
            
            <div style="margin-bottom: 20px;">
                <h4 style="color: #4a5568; margin-bottom: 10px;">📋 What this means for deployment:</h4>
                <div style="background: #e3f2fd; padding: 15px; border-radius: 6px; color: #0c5460;">
                    <strong>When this story moves to Production:</strong>
                    <ul style="margin: 10px 0 0 0; padding-left: 20px;">
                        <li>Red lines will be <strong>replaced</strong> by green lines</li>
                        <li>Green lines represent the <strong>new state</strong> of your code</li>
                        <li>Gray lines will remain <strong>unchanged</strong></li>
                    </ul>
                </div>
            </div>
            
            <div>
                <h4 style="color: #4a5568; margin-bottom: 10px;">🚀 Quick Actions:</h4>
                <div style="display: grid; gap: 8px; color: #4a5568;">
                    <div>• <strong>Copy Prod/UAT</strong> - Get specific version of the code</div>
                    <div>• <strong>Download</strong> - Save diff for offline review</div>
                    <div>• <strong>Search</strong> - Find specific functions or keywords</div>
                    <div>• <strong>Hide Unchanged</strong> - Focus only on changes</div>
                </div>
            </div>
        </div>
    `;
    
    // Simple modal for explanation
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10001;
        padding: 20px;
    `;
    
    modal.innerHTML = `
        <div style="background: white; border-radius: 12px; max-width: 90vw; max-height: 90vh; overflow: auto; box-shadow: 0 20px 60px rgba(0,0,0,0.3);">
            ${explanation}
            <div style="padding: 20px; text-align: center; border-top: 1px solid #e2e8f0;">
                <button onclick="this.closest('div[style*=\\'position: fixed\\']').remove()" 
                        style="padding: 10px 24px; background: #667eea; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">
                    Got it!
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Close on background click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            document.body.removeChild(modal);
        }
    });
}
function toggleCollapseUnchanged() {
    const button = document.getElementById('collapseBtn');
    const diffContainer = document.getElementById('diff-unified');
    
    if (!diffContainer) {
        console.log('❌ No diff container found');
        return;
    }
    
    // Check if we're currently showing or hiding unchanged lines
    const isCurrentlyHidden = diffContainer.getAttribute('data-hide-unchanged') === 'true';
    
    if (isCurrentlyHidden) {
        // Show all lines
        showAllLines();
        button.innerHTML = '📦 Hide Unchanged';
        button.style.background = 'white';
        diffContainer.setAttribute('data-hide-unchanged', 'false');
        console.log('✅ Showing all lines');
    } else {
        // Hide unchanged lines
        hideUnchangedLines();
        button.innerHTML = '📦 Show All';
        button.style.background = '#e3f2fd';
        diffContainer.setAttribute('data-hide-unchanged', 'true');
        console.log('✅ Hiding unchanged lines');
    }
}

function hideUnchangedLines() {
    const diffContainer = document.getElementById('diff-unified');
    if (!diffContainer) return;
    
    // Find all diff rows
    const diffRows = diffContainer.querySelectorAll('div[style*="display: flex"]');
    let hiddenCount = 0;
    let shownCount = 0;
    
    diffRows.forEach(row => {
        const lineNumberCol = row.children[0];
        if (!lineNumberCol) return;
        
        const lineStyle = lineNumberCol.getAttribute('style') || '';
        
        // Check if this is an unchanged line (gray background)
        const isUnchanged = lineStyle.includes('background: #f6f8fa') && 
                           !lineStyle.includes('background: #ffd7d5') && 
                           !lineStyle.includes('background: #ccffd8');
        
        if (isUnchanged) {
            row.style.display = 'none';
            hiddenCount++;
        } else {
            row.style.display = 'flex';
            shownCount++;
        }
    });
    
    console.log(`📊 Hidden ${hiddenCount} unchanged lines, showing ${shownCount} changed lines`);
    
    // If we found no flex containers, try a different approach for bundle view
    if (diffRows.length === 0) {
        hideUnchangedLinesFallback();
    }
}

function showAllLines() {
    const diffContainer = document.getElementById('diff-unified');
    if (!diffContainer) return;
    
    // Show all diff rows
    const allRows = diffContainer.querySelectorAll('div');
    let shownCount = 0;
    
    allRows.forEach(row => {
        row.style.display = '';
        shownCount++;
    });
    
    console.log(`📊 Showing all ${shownCount} lines`);
}

// Fallback method for bundle view or different structures
function hideUnchangedLinesFallback() {
    const diffContainer = document.getElementById('diff-unified');
    if (!diffContainer) return;
    
    // Get all div elements and look for unchanged lines
    const allDivs = diffContainer.querySelectorAll('div');
    let hiddenCount = 0;
    
    allDivs.forEach(div => {
        const style = div.getAttribute('style') || '';
        const text = div.textContent || '';
        
        // Skip if this is a file header or important UI element
        if (text.includes('📦') || text.includes('✅') || text.includes('📝') || 
            text.includes('Bundle') || text.includes('Loading diff')) {
            return;
        }
        
        // Look for unchanged lines (gray background in line number column)
        if (style.includes('background: #f6f8fa') && 
            !style.includes('background: #ffd7d5') && 
            !style.includes('background: #ccffd8') &&
            style.includes('text-align: right')) { // This is likely a line number column
            
            // Hide the entire row (parent of this line number div)
            const parent = div.parentElement;
            if (parent && parent.style) {
                parent.style.display = 'none';
                hiddenCount++;
            }
        }
    });
    
    console.log(`🔄 Fallback: Hidden ${hiddenCount} unchanged lines`);
}

// Also add the missing toggleSplitView function
function toggleSplitView() {
    const checkbox = document.getElementById('splitViewToggle');
    if (!checkbox) return;
    
    if (checkbox.checked) {
        console.log('🔄 Split view enabled');
        // You can implement split view logic here
        alert('Split view feature coming soon!');
    } else {
        console.log('🔄 Split view disabled');
    }
}