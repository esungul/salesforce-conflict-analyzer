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
    
    // Get unique developers from conflicts
    const developers = new Set();
    analysisData.conflicts.forEach(conflict => {
        conflict.involved_stories.forEach(story => {
            if (story.developer) {
                developers.add(story.developer);
            }
        });
    });
    
    const select = document.getElementById('developerSelect');
    select.innerHTML = '<option value="">Select your name...</option>';
    Array.from(developers).sort().forEach(dev => {
        select.innerHTML += `<option value="${dev}">${dev}</option>`;
    });
}

function filterByDeveloper() {
    const selectedDev = document.getElementById('developerSelect').value;
    const container = document.getElementById('developerStories');
    
    if (!selectedDev) {
        container.innerHTML = '<p style="padding: 40px; text-align: center; color: #666;">Please select your name to see your stories</p>';
        return;
    }
    
    // Build story analysis
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
            
            <details style="margin-top: 15px;">
                <summary style="cursor: pointer; color: #667eea; font-weight: 600;">View Component Details</summary>
                <div style="margin-top: 10px; padding: 10px; background: #f8f9fa; border-radius: 4px;">
                    ${story.components.map(c => `
                        <div style="margin: 5px 0; padding: 8px; background: white; border-radius: 4px;">
                            • ${c.name} (${c.type}) - ${c.severity} Risk
                        </div>
                    `).join('')}
                </div>
            </details>
        </div>
    `).join('');
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
                    risk: conflict.risk_score
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
        
        stories.push({
            id: data.id,
            title: data.title,
            status,
            statusIcon,
            reason,
            actions,
            hasRegression: data.hasRegression,
            coordination: Array.from(data.otherDevs),
            components: data.components
        });
    });
    
    return stories.sort((a, b) => {
        const order = { BLOCKED: 0, WARNING: 1, SAFE: 2 };
        return order[a.status] - order[b.status];
    });
}

function showDevOpsView() {
    document.getElementById('developerView').style.display = 'none';
    document.getElementById('devopsView').style.display = 'block';
    
    showTab('overview');
    buildOverviewTab();
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
                    <div style="font-size: 32px; font-weight: bold; color: #dc3545;">${summary.severity_breakdown.blocker + summary.severity_breakdown.critical}</div>
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
                <li>Address ${summary.severity_breakdown.blocker} blocker conflicts</li>
                <li>Coordinate developers for ${summary.severity_breakdown.critical} critical conflicts</li>
                <li>Plan deployment sequence for safe stories</li>
            </ol>
        </div>
    `;
}

function buildStoriesTab() {
    document.getElementById('tab-stories').innerHTML = '<p style="padding: 40px; text-align: center;">Stories list view - Coming soon</p>';
}

function buildSequenceTab() {
    document.getElementById('tab-sequence').innerHTML = '<p style="padding: 40px; text-align: center;">Deployment sequence - Coming soon</p>';
}

function buildEnforcementTab() {
    const { regressions } = analysisData;
    
    let content = '<div style="background: white; padding: 30px; border-radius: 12px;"><h2>Enforcement Report</h2>';
    
    if (regressions && regressions.length > 0) {
        content += `
            <h3 style="color: #dc3545; margin-top: 30px;">Policy Violations: Regression Risks</h3>
            <p>These stories have components older than production and must be excluded:</p>
            ${regressions.map(reg => `
                <div style="padding: 15px; background: #fff5f5; border-left: 4px solid #dc3545; margin: 10px 0; border-radius: 4px;">
                    <strong>${reg.story_id}</strong> - ${reg.component}
                    <br><small>${reg.message}</small>
                </div>
            `).join('')}
        `;
    } else {
        content += '<p style="padding: 40px; text-align: center; color: #666;">No policy violations detected</p>';
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