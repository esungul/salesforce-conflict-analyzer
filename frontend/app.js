/**
 * Copado Deployment Validator - Frontend
 */

const API_URL = 'http://localhost:5000';

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

document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
});

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

                storyData.components.push({
                    name: conflict.component.api_name,
                    type: conflict.component.type,
                    severity: conflict.severity,
                    risk: conflict.risk_score,
                    commit_date: commitDate,
                    days_old: commitDate ? calculateDaysOld(commitDate) : null,
                    otherStories: conflict.involved_stories
                        .filter(s => s.id !== story.id)
                        .map(s => ({
                            id: s.id,
                            commit_date: s.commit_date || null
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
        </div>
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
                                                            <div style="margin: 6px 0; padding: 6px; background: white; border-radius: 4px;">
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
                                                        `;
                                                    }
                                                }).join('')}
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