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
    
    // Show results section
    results.style.display = 'block';
    
    // Update summary cards
    document.getElementById('totalRecords').textContent = summary.total_records;
    document.getElementById('totalStories').textContent = summary.unique_stories;
    document.getElementById('totalConflicts').textContent = summary.total_conflicts;
    document.getElementById('avgRisk').textContent = `${summary.avg_risk_score}/100`;
    
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
    
    // Display conflicts
    displayConflicts(conflicts);
    
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
        container.innerHTML = '<p style="text-align: center; color: #666;">No conflicts found! 🎉</p>';
        return;
    }
    
    container.innerHTML = conflicts.map(conflict => {
        const storiesList = conflict.involved_stories
            .map(s => `<div>• ${s.id}: ${s.title} (${s.developer || 'Unknown'})</div>`)
            .join('');
        
        const riskFactorsList = conflict.risk_factors
            .map(factor => `<li>${factor}</li>`)
            .join('');
        
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
                    <div><strong>Stories Involved (${conflict.involved_stories.length}):</strong></div>
                    <div style="margin-left: 20px; font-size: 0.85rem;">
                        ${storiesList}
                    </div>
                </div>
                ${riskFactorsList ? `
                    <div class="risk-factors">
                        <h4>🎯 Risk Factors:</h4>
                        <ul>${riskFactorsList}</ul>
                    </div>
                ` : ''}
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