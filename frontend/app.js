/**
 * Copado Deployment Validator - Frontend
 * Connects to Flask API and displays results
 */

// API Configuration
const API_URL = 'http://localhost:5000';

// DOM Elements
const uploadBox = document.getElementById('uploadBox');
const fileInput = document.getElementById('fileInput');
const uploadBtn = document.getElementById('uploadBtn');
const loading = document.getElementById('loading');
const results = document.getElementById('results');
const error = document.getElementById('error');

let selectedFile = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
});

function setupEventListeners() {
    // Click to upload
    uploadBox.addEventListener('click', () => {
        fileInput.click();
    });
    
    // File selected
    fileInput.addEventListener('change', (e) => {
        handleFileSelect(e.target.files[0]);
    });
    
    // Drag and drop
    uploadBox.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadBox.classList.add('dragover');
    });
    
    uploadBox.addEventListener('dragleave', () => {
        uploadBox.classList.remove('dragover');
    });
    
    uploadBox.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadBox.classList.remove('dragover');
        handleFileSelect(e.dataTransfer.files[0]);
    });
    
    // Upload button
    uploadBtn.addEventListener('click', () => {
        if (selectedFile) {
            uploadAndAnalyze(selectedFile);
        }
    });
}

function handleFileSelect(file) {
    if (!file) return;
    
    // Validate file type
    if (!file.name.endsWith('.csv')) {
        showError('Please select a CSV file');
        return;
    }
    
    selectedFile = file;
    
    // Update UI
    uploadBox.innerHTML = `
        <div class="upload-icon">✅</div>
        <h3>${file.name}</h3>
        <p>Size: ${(file.size / 1024).toFixed(2)} KB</p>
    `;
    
    uploadBtn.style.display = 'block';
}

async function exportPDF(groupByDeveloper) {
    if (!window.currentAnalysisData) {
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
                ...window.currentAnalysisData,
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

async function uploadAndAnalyze(file) {
    try {
        // Hide previous results/errors
        results.style.display = 'none';
        error.style.display = 'none';
        
        // Show loading
        loading.style.display = 'block';
        
        // Create form data
        const formData = new FormData();
        formData.append('file', file);
        
        // Upload to API
        const response = await fetch(`${API_URL}/api/analyze`, {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        
        // Hide loading
        loading.style.display = 'none';
        
        if (data.success) {
            displayResults(data.data);
        } else {
            showError(data.error || 'Analysis failed');
        }
        
    } catch (err) {
        loading.style.display = 'none';
        showError(`Error: ${err.message}. Make sure the API server is running.`);
    }
}

function displayResults(data) {
    const { summary, conflicts } = data;
    const exportSection = document.createElement('div');
    exportSection.className = 'conflicts-section';
    exportSection.style.marginTop = '30px';
    exportSection.innerHTML = `
        <h2>Export Report</h2>
        <button onclick="exportPDF(false)" class="btn-primary" style="margin-right: 10px;">
            Export PDF (By Conflict)
        </button>
        <button onclick="exportPDF(true)" class="btn-primary">
            Export PDF (By Developer)
        </button>
    `;

    
    // Show results section
    results.style.display = 'block';
    
    // Update summary cards
    document.getElementById('totalRecords').textContent = summary.total_records;
    document.getElementById('totalStories').textContent = summary.unique_stories;
    document.getElementById('totalConflicts').textContent = summary.total_conflicts;
    document.getElementById('avgRisk').textContent = `${summary.avg_risk_score}/100`;
    document.getElementById('results').appendChild(exportSection);
    
    // Update severity bars
    const maxCount = Math.max(
        summary.severity_breakdown.blocker,
        summary.severity_breakdown.critical,
        summary.severity_breakdown.high,
        summary.severity_breakdown.medium,
        summary.severity_breakdown.low
    );
    
    updateSeverityBar('blocker', summary.severity_breakdown.blocker, maxCount);
    updateSeverityBar('critical', summary.severity_breakdown.critical, maxCount);
    updateSeverityBar('high', summary.severity_breakdown.high, maxCount);
    updateSeverityBar('medium', summary.severity_breakdown.medium, maxCount);
    updateSeverityBar('low', summary.severity_breakdown.low, maxCount);
    window.currentAnalysisData = data;

    
    // Display conflicts
    displayConflicts(conflicts);

    //NEW: Display story-to-story conflicts
    displayStoryConflicts(story_conflicts);
    
    // NEW: Display developer coordination
    displayDeveloperCoordination(developer_coordination);
    
    // NEW: Display deployment sequence
    displayDeploymentSequence(deployment_sequence);
    
    // Scroll to results
    results.scrollIntoView({ behavior: 'smooth' });
}

function updateSeverityBar(severity, count, maxCount) {
    const percentage = maxCount > 0 ? (count / maxCount) * 100 : 0;
    document.getElementById(`${severity}Bar`).style.width = `${percentage}%`;
    document.getElementById(`${severity}Count`).textContent = count;
}


function displayConflicts(conflicts) {
    const container = document.getElementById('conflictsTable');
    
    if (conflicts.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #666;">No conflicts found!</p>';
        return;
    }
    
    container.innerHTML = conflicts.map(conflict => {
        // Format stories with commit info
        const storiesList = conflict.involved_stories
            .map((s, index) => {
                const isLatest = index === 0;
                //const dateStr = s.commit_date ? new Date(s.commit_date).toLocaleDateString() : 'Unknown';
                const dateStr = s.commit_date ? s.commit_date.split('T')[0] : 'Unknown';

                const daysAgo = s.days_ago !== null ? `${s.days_ago} days ago` : '';
                
                return `
                    <div style="margin: 5px 0; padding: 10px; background: ${isLatest ? '#e3f2fd' : '#f8f9fa'}; border-left: 4px solid ${isLatest ? '#2196f3' : '#ddd'}; border-radius: 4px;">
                        ${isLatest ? '<strong style="color: #2196f3;">📌 LATEST COMMIT</strong><br>' : ''}
                        <strong>${s.id}</strong>: ${s.title.substring(0, 60)}...
                        <br><small style="color: #666;">
                            👤 ${s.developer || 'Unknown'} | 
                            🎫 ${s.jira_key || 'No Jira'} | 
                            📦 ${s.component_count} components
                        </small>
                        <br><small style="color: #1976d2; font-weight: 600;">
                            ✏️ Modified by: ${s.created_by || 'Unknown'} | 
                            📅 ${dateStr} ${daysAgo ? `(${daysAgo})` : ''}
                        </small>
                    </div>
                `;
            })
            .join('');
        
        const riskFactorsList = conflict.risk_factors.map(f => `<li>${f}</li>`).join('');
        
        // Recommendation section
        const recommendationHtml = conflict.recommendation ? `
            <div style="margin-top: 20px; padding: 15px; background: #fff3cd; border-left: 4px solid #ffc107; border-radius: 4px;">
                <h4 style="margin: 0 0 10px 0; color: #856404;">
                    📋 Recommended Action: ${conflict.recommendation.action}
                </h4>
                <div style="margin-bottom: 10px;">
                    <strong>Priority:</strong> 
                    <span style="padding: 4px 8px; background: ${
                        conflict.recommendation.priority === 'IMMEDIATE' ? '#dc3545' :
                        conflict.recommendation.priority === 'HIGH' ? '#fd7e14' :
                        conflict.recommendation.priority === 'MEDIUM' ? '#ffc107' : '#28a745'
                    }; color: white; border-radius: 4px; font-size: 0.85rem;">
                        ${conflict.recommendation.priority}
                    </span>
                </div>
                <div style="margin-bottom: 10px;">
                    <strong>Steps:</strong>
                    <ol style="margin: 5px 0; padding-left: 20px;">
                        ${conflict.recommendation.steps.map(step => `<li>${step}</li>`).join('')}
                    </ol>
                </div>
                <div style="color: #856404; font-size: 0.9rem;">
                    ⚠️ <strong>Risk:</strong> ${conflict.recommendation.risk}
                </div>
            </div>
        ` : '';
        
        return `
            <div class="conflict-item">
                <div class="conflict-header">
                    <div class="conflict-name">${conflict.component.api_name}</div>
                    <span class="severity-badge ${conflict.severity.toLowerCase()}">
                        ${conflict.severity} - ${conflict.risk_score}/100
                    </span>
                </div>
                <div class="conflict-details">
                    <div><strong>Type:</strong> ${conflict.component.type}</div>
                    <div><strong>Status:</strong> ${conflict.component.status}</div>
                    <div style="margin-top: 15px;"><strong>Stories Involved (${conflict.involved_stories.length}):</strong></div>
                    <div style="margin-left: 10px; margin-top: 10px;">
                        ${storiesList}
                    </div>
                </div>
                ${riskFactorsList ? `
                    <div class="risk-factors">
                        <h4>Risk Factors:</h4>
                        <ul>${riskFactorsList}</ul>
                    </div>
                ` : ''}
                ${recommendationHtml}
            </div>
        `;
    }).join('');
}

function showError(message) {
    error.textContent = message;
    error.style.display = 'block';
    
    // Hide after 5 seconds
    setTimeout(() => {
        error.style.display = 'none';
    }, 5000);
}

function displayStoryConflicts(storyConflicts) {
    if (!storyConflicts || storyConflicts.length === 0) return;
    
    const html = `
        <div class="conflicts-section" style="margin-top: 30px;">
            <h2>Story-to-Story Conflicts</h2>
            <p style="color: #666; margin-bottom: 15px;">Stories that share multiple components</p>
            ${storyConflicts.map(sc => `
                <div style="padding: 15px; background: #fff3cd; border-left: 4px solid #ffc107; margin-bottom: 10px; border-radius: 4px;">
                    <strong>${sc.story1_id}</strong> ↔ <strong>${sc.story2_id}</strong>
                    <br><small>Shared components: ${sc.shared_count} | ${sc.story1_developer} ↔ ${sc.story2_developer}</small>
                    <br><small style="color: #856404;">${sc.needs_coordination ? '⚠️ Requires developer coordination' : '✓ Same developer'}</small>
                </div>
            `).join('')}
        </div>
    `;
    
    document.getElementById('conflictsTable').insertAdjacentHTML('afterend', html);
}

function displayDeveloperCoordination(devMap) {
    if (!devMap || Object.keys(devMap).length === 0) return;
    
    const html = `
        <div class="conflicts-section" style="margin-top: 30px;">
            <h2>Developer Coordination Required</h2>
            ${Object.entries(devMap).map(([dev, data]) => `
                <div style="padding: 15px; background: #e3f2fd; border-left: 4px solid #2196f3; margin-bottom: 10px; border-radius: 4px;">
                    <strong>👤 ${dev}</strong>
                    <br><small>Must coordinate with: ${data.coordinates_with.join(', ')}</small>
                    <br><small>Shared components: ${data.shared_components}</small>
                </div>
            `).join('')}
        </div>
    `;
    
    document.getElementById('conflictsTable').insertAdjacentHTML('afterend', html);
}

function displayDeploymentSequence(sequence) {
    if (!sequence || sequence.length === 0) return;
    
    const html = `
        <div class="conflicts-section" style="margin-top: 30px;">
            <h2>Recommended Deployment Sequence</h2>
            ${sequence.map(batch => `
                <div style="padding: 15px; background: #e8f5e9; border-left: 4px solid #4caf50; margin-bottom: 10px; border-radius: 4px;">
                    <strong>Batch ${batch.batch_number}</strong>
                    <br>Stories: ${batch.stories.join(', ')}
                    <br><small style="color: #2e7d32;">${batch.note}</small>
                </div>
            `).join('')}
        </div>
    `;
    
    document.getElementById('conflictsTable').insertAdjacentHTML('afterend', html);
}