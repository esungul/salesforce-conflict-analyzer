// ui/src/ui/tabs/production-validator.js
// Production Validator Tab - Supports User Stories AND Release IDs

import { API_URL } from '../../config.js';

const $ = (s, r = document) => r.querySelector(s);

export function renderProductionValidatorTab() {
  const panel = $('#tab-production-validator');
  if (!panel) return;

  panel.innerHTML = '';

  // Section header
  panel.append(
    createElement('div', { className: 'section-header' }, [
      createElement('h2', {}, 'Production Validator'),
      createElement('p', { className: 'muted' }, 'Validate user stories or entire releases against production deployment state')
    ])
  );

  // Input section
  const inputSection = createInputSection();
  panel.append(inputSection);

  // Results section (initially hidden)
  const resultsSection = createElement('div', { 
    id: 'validation-results',
    className: 'validation-results-section',
    style: 'display: none;'
  });
  panel.append(resultsSection);

  injectCss();
}

function createInputSection() {
  const section = createElement('div', { className: 'validator-input-section' });

  // Info card
  const infoCard = createElement('div', { className: 'validator-info-card' });
  infoCard.innerHTML = `
    <h3>How it works</h3>
    <ul class="info-list">
      <li>✓ Validates components exist in production</li>
      <li>✓ Checks deployment timestamps</li>
      <li>✓ Verifies commit contents and file mappings</li>
      <li>✓ Supports Salesforce and Vlocity components</li>
      <li>✓ Works with individual stories or full releases</li>
    </ul>
  `;
  section.append(infoCard);

  // Input card
  const inputCard = createElement('div', { className: 'validator-input-card' });

  const inputLabel = createElement('label', { 
    className: 'input-label',
    htmlFor: 'story-input'
  }, 'Enter User Stories or Release ID');
  
  const inputHelp = createElement('p', { 
    className: 'input-help' 
  }, 'Enter user story IDs (US-0031889) or a release ID (SFDC-PEAC-B2C 25.21.5). Separate multiple stories with commas or new lines.');

  const textarea = createElement('textarea', {
    id: 'story-input',
    className: 'story-input',
    placeholder: 'User Stories:\nUS-0031889\nUS-0031890\n\nOR\n\nRelease ID:\nSFDC-PEAC-B2C 25.21.5',
    rows: 6
  });

  const buttonGroup = createElement('div', { className: 'validator-button-group' });
  
  const validateBtn = createElement('button', {
    id: 'validate-btn',
    className: 'btn btn-primary validator-btn'
  }, 'Validate');

  const clearBtn = createElement('button', {
    id: 'clear-btn',
    className: 'btn btn-secondary validator-btn'
  }, 'Clear');

  buttonGroup.append(validateBtn, clearBtn);
  inputCard.append(inputLabel, inputHelp, textarea, buttonGroup);
  section.append(inputCard);

  // Add event listeners
  validateBtn.addEventListener('click', handleValidate);
  clearBtn.addEventListener('click', handleClear);

  return section;
}

async function handleValidate() {
  const textarea = $('#story-input');
  const input = textarea.value.trim();
  
  if (!input) {
    showError('Please enter user story IDs or a release ID');
    return;
  }

  // Detect input type
  const inputType = detectInputType(input);
  
  if (inputType === 'unknown') {
    showError('Invalid format. Expected user story IDs (US-XXXXX) or release ID (e.g., SFDC-PEAC-B2C 25.21.5)');
    return;
  }

  try {
    if (inputType === 'release') {
      await validateRelease(input.trim());
    } else if (inputType === 'single-story') {
      await validateSingleStory(input.trim());
    } else if (inputType === 'multiple-stories') {
      await validateMultipleStories(inputType.stories);
    }
  } catch (error) {
    showError(`Validation failed: ${error.message}`);
  }
}

function detectInputType(input) {
  // Clean input
  const trimmed = input.trim();
  
  // Check if it's a release ID (contains spaces or dashes in specific pattern)
  // Examples: "SFDC-PEAC-B2C 25.21.5", "Release 2024.1"
  if (!trimmed.startsWith('US-') && (trimmed.includes(' ') || /^[A-Z]+-[A-Z0-9-]+\s+[\d.]+$/i.test(trimmed))) {
    return 'release';
  }

  // Parse potential stories (split by comma, newline, or space)
  const stories = trimmed
    .split(/[,\n\s]+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);

  if (stories.length === 0) {
    return 'unknown';
  }

  // Check if all entries match US-XXXXX format
  const validStories = stories.filter(s => /^US-\d+$/i.test(s));
  
  if (validStories.length === 0) {
    return 'unknown';
  }

  if (validStories.length !== stories.length) {
    return 'unknown'; // Some invalid entries mixed in
  }

  if (validStories.length === 1) {
    return 'single-story';
  }

  return {
    type: 'multiple-stories',
    stories: validStories
  };
}



async function validateSingleStory(storyName) {
  console.log(`Validating single story: ${storyName}`);
  
  showLoading(`Validating story: ${storyName}`);
  
  const apiUrl = `${API_URL}/api/deployment/prove/story`;
  console.log('🔍 API Call:', { url: apiUrl, storyName });
  
  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        story_name: storyName,
        target_env: 'production'
      })
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('❌ API Error:', response.status, text);
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    console.log('Single story result:', result);
    
    // Use the new detailed display for single stories
    displaySingleStoryDetailed(result, storyName);
  } catch (error) {
    console.error('Validation error:', error);
    showError(`Failed to validate story: ${error.message}`);
  }
}

async function validateRelease(releaseId) {
  console.log(`Validating release: ${releaseId}`);
  
  showLoading(`Validating release: ${releaseId}`);
  
  const apiUrl = `${API_URL}/api/deployment/prove/bulk`;
  console.log('🔍 API Call:', { url: apiUrl, releaseId });
  
  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        release_name: releaseId,
        target_env: 'production',
        format: 'ui'
      })
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('❌ API Error:', response.status, text);
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    console.log('Release validation result:', result);
    
    displayReleaseResults(result);
  } catch (error) {
    console.error('Validation error:', error);
    showError(`Failed to validate release: ${error.message}`);
  }
}

async function validateMultipleStories(stories) {
  console.log(`Validating ${stories.length} stories:`, stories);
  
  showLoading(`Validating ${stories.length} stories`);
  
  const apiUrl = `${API_URL}/api/deployment/prove/bulk`;
  console.log('🔍 API Call:', { url: apiUrl, storyCount: stories.length });
  
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      story_names: stories,
      target_env: 'production',
      format: 'ui'  // Use UI-friendly response format
    })
  });

  if (!response.ok) {
    const text = await response.text();
    console.error('❌ API Error:', response.status, text);
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  const result = await response.json();
  console.log('Bulk validation result:', result);
  
  displayBulkResults(result);
}

// Add View Details function with loading spinner
async function viewStoryDetails(storyId) {
  console.log(`Fetching details for: ${storyId}`);
  
  // Show loading modal immediately
  showDetailsLoadingModal(storyId);
  
  const apiUrl = `${API_URL}/api/deployment/prove/story/${storyId}/details`;
  console.log('🔍 API Call:', { url: apiUrl, storyId });
  
  try {
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('❌ API Error:', response.status, text);
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    console.log('Story details result:', result);
    
    // Close loading modal and show details
    const loadingModal = document.getElementById('story-details-loading-modal');
    if (loadingModal) {
      loadingModal.remove();
    }
    
    showDetailsModal(storyId, result);
  } catch (error) {
    console.error('Error fetching story details:', error);
    
    // Close loading modal
    const loadingModal = document.getElementById('story-details-loading-modal');
    if (loadingModal) {
      loadingModal.remove();
    }
    
    showError(`Failed to fetch details for ${storyId}: ${error.message}`);
  }
}

// Show loading modal while fetching details
function showDetailsLoadingModal(storyId) {
  // Remove any existing modals
  const existingModal = document.getElementById('story-details-loading-modal');
  if (existingModal) {
    existingModal.remove();
  }
  
  const modal = document.createElement('div');
  modal.id = 'story-details-loading-modal';
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    animation: fadeIn 0.2s ease;
  `;
  
  modal.innerHTML = `
    <div style="
      background: white;
      border-radius: 16px;
      padding: 48px 64px;
      text-align: center;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      animation: slideUp 0.3s ease;
    ">
      <!-- Spinner -->
      <div style="
        width: 64px;
        height: 64px;
        border: 6px solid #f3f3f3;
        border-top: 6px solid #667eea;
        border-radius: 50%;
        animation: spin 1s linear infinite;
        margin: 0 auto 24px;
      "></div>
      
      <!-- Title -->
      <h3 style="
        margin: 0 0 12px 0;
        font-size: 20px;
        font-weight: 600;
        color: #1d1d1f;
      ">📋 Viewing Story Details</h3>
      
      <!-- Story ID -->
      <p style="
        margin: 0 0 8px 0;
        font-size: 16px;
        font-weight: 500;
        color: #667eea;
        font-family: 'SF Mono', monospace;
      ">${storyId}</p>
      
      <!-- Subtext -->
      <p style="
        margin: 0;
        font-size: 14px;
        color: #86868b;
      ">Loading validation details...</p>
    </div>
    
    <style>
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
      
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      
      @keyframes slideUp {
        from { transform: translateY(30px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }
    </style>
  `;
  
  document.body.appendChild(modal);
}

function showLoading(message) {
  const resultsSection = $('#validation-results');
  resultsSection.style.display = 'block';
  
  resultsSection.innerHTML = `
    <div class="loading-state">
      <div class="spinner"></div>
      <p class="loading-text">${message}...</p>
      <p class="loading-subtext">This may take a few seconds</p>
    </div>
  `;
  
  // Scroll to results
  resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}


function displayReleaseResults(result) {
  const resultsSection = $('#validation-results');
  resultsSection.innerHTML = '';
  
  // Handle different response structures
  const overview = result.overview || {};
  const summary = overview.summary || {};
  const stories = result.stories || [];
  const releaseInfo = result.release || {};
  
  console.log('📊 Release Data Structure:', {
    release: releaseInfo.name,
    totalStories: overview.total_stories,
    stories: stories.length,
    summary
  });

  // Release header
  const releaseHeader = createElement('div', { className: 'release-header-card' });
  releaseHeader.innerHTML = `
    <div class="release-icon">📦</div>
    <div class="release-info">
      <h3>${releaseInfo.name || 'Unknown Release'}</h3>
      <p class="release-meta">
        <span class="meta-item">📅 Analyzed: ${overview.timestamp ? new Date(overview.timestamp).toLocaleString() : new Date().toLocaleString()}</span>
        <span class="meta-item">📊 Total Stories: ${overview.total_stories || stories.length || 0}</span>
        <span class="meta-item">⏱️ Processing Time: ${overview.processing_time || 'N/A'}</span>
      </p>
    </div>
    <div class="release-stats">
      <div class="success-rate">${summary.success_rate || 0}%</div>
      <div class="success-label">Success Rate</div>
    </div>
  `;
  resultsSection.append(releaseHeader);
  
  // Summary stats
  const statsGrid = createElement('div', { className: 'stats-grid' });
  
  const provenCount = summary.proven || stories.filter(s => s.status === 'proven').length;
  const unprovenCount = summary.unproven || stories.filter(s => s.status === 'unproven').length;
  const partialCount = summary.partial || stories.filter(s => s.status === 'partial').length;
  const totalCount = overview.total_stories || stories.length;
  
  statsGrid.append(
    createStatCard('Total Stories', totalCount, '#1d1d1f'),
    createStatCard('Proven', provenCount, '#34C759'),
    createStatCard('Partial', partialCount, '#FF9500'),
    createStatCard('Unproven', unprovenCount, '#FF3B30')
  );
  
  resultsSection.append(statsGrid);
  
  // Success rate bar
  if (totalCount > 0) {
    const successRate = summary.success_rate || Math.round((provenCount / totalCount) * 100);
    const successBar = createElement('div', { className: 'success-rate-section' });
    successBar.innerHTML = `
      <h4>Deployment Readiness: ${successRate}%</h4>
      <div class="progress-bar">
        <div class="progress-fill" style="width: ${successRate}%; background: ${successRate === 100 ? '#34C759' : successRate >= 70 ? '#FF9500' : '#FF3B30'}"></div>
      </div>
      <p class="progress-label">${provenCount} of ${totalCount} stories proven</p>
    `;
    resultsSection.append(successBar);
  }
  
  // Individual story results
  if (stories.length > 0) {
    const resultsListSection = createElement('div', { className: 'results-list-section' });
    resultsListSection.innerHTML = '<h4>📋 Story Results</h4>';
    
    // Sort stories: proven first, then partial, then unproven
    const sortedStories = [...stories].sort((a, b) => {
      const statusOrder = { proven: 0, partial: 1, unproven: 2, unknown: 3 };
      return statusOrder[a.status] - statusOrder[b.status];
    });
    
    sortedStories.forEach(story => {
      const card = createEnhancedStoryCard(story);
      resultsListSection.append(card);
    });
    
    resultsSection.append(resultsListSection);
  } else {
    const noStoriesSection = createElement('div', { className: 'no-data-section' });
    noStoriesSection.innerHTML = `
      <div class="no-data-icon">📭</div>
      <h4>No Story Data</h4>
      <p>No individual story data is available for this release in the response.</p>
    `;
    resultsSection.append(noStoriesSection);
  }
}


function createEnhancedStoryCard(story) {
  const card = createElement('div', { className: 'bulk-result-card enhanced' });
  
  const status = story.status || 'unknown';
  const confidence = story.confidence || 'unknown';
  const proofScore = story.proof_score || 0;
  
  const statusConfig = {
    proven: { color: '#10b981', label: 'PROVEN', icon: '✅' },
    partial: { color: '#f97316', label: 'PARTIAL', icon: '⚠️' },
    unproven: { color: '#ef4444', label: 'UNPROVEN', icon: '❌' },
    unknown: { color: '#6b7280', label: 'UNKNOWN', icon: '❓' }
  };
  
  const config = statusConfig[status] || statusConfig.unknown;
  
  const metrics = story.metrics || {};
  const componentsText = `${metrics.components_proven || 0}/${metrics.components_total || 0} components`;
  const validatorsText = `${metrics.validators_passed || 0}/${metrics.validators_total || 0} validators`;
  
  card.innerHTML = `
    <div class="bulk-result-header">
      <div class="story-title-section">
        <h5>${story.story_name || story.story_id || 'Unknown Story'}</h5>
        <div class="story-confidence">
          <span class="confidence-badge confidence-${confidence}">${confidence}</span>
          ${proofScore > 0 ? `<span class="proof-score">${proofScore}%</span>` : ''}
        </div>
      </div>
      <span class="status-badge" style="background: ${config.color}">
        ${config.icon} ${config.label}
      </span>
    </div>
    
    <div class="story-details-enhanced">
      <div class="detail-row">
        <span class="detail-label">👤 Author:</span>
        <span class="detail-value">${story.commit?.author || 'Unknown'}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">📅 Date:</span>
        <span class="detail-value">${story.commit?.date ? new Date(story.commit.date).toLocaleDateString() : 'N/A'}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">⚙️ Resources:</span>
        <span class="detail-value">${componentsText} • ${validatorsText}</span>
      </div>
      ${story.execution_time_ms ? `
        <div class="detail-row">
          <span class="detail-label">⏱️ Time:</span>
          <span class="detail-value">${story.execution_time_ms}ms</span>
        </div>
      ` : ''}
    </div>
    
    ${(story.components && story.components.length > 0) ? `
      <div class="story-components-preview">
        <strong>Components:</strong>
        <div class="components-tags">
          ${story.components.slice(0, 3).map(comp => 
            `<span class="component-tag">${comp.type || 'Unknown'}</span>`
          ).join('')}
          ${story.components.length > 3 ? `<span class="component-more">+${story.components.length - 3} more</span>` : ''}
        </div>
      </div>
    ` : ''}
    
    <div class="story-actions">
      <button 
        class="view-details-btn" 
        onclick="window.viewStoryDetails('${story.story_name || story.story_id}')"
      >
        🔍 View Full Details
      </button>
    </div>
  `;
  
  return card;
}
function createStoryCard(story) {
  const card = createElement('div', { className: 'bulk-result-card' });
  
  const status = story.status || 'unknown';
  const statusColor = status === 'proven' ? '#10b981' : 
                      status === 'partial' ? '#f97316' : '#ef4444';
  
  const metrics = story.metrics || {};
  const isFailed = status !== 'proven';
  
  card.innerHTML = `
    <div class="bulk-result-header">
      <h5>${story.story_name || 'Unknown'}</h5>
      <span class="status-badge" style="background: ${statusColor}; color: white; padding: 6px 14px; border-radius: 6px; font-size: 12px; font-weight: 600;">${status.toUpperCase()}</span>
    </div>
    <div class="story-details">
      <p class="story-meta">
        <span class="meta-item">👤 ${story.commit?.author || 'Unknown'}</span>
        <span class="meta-item">📅 ${story.commit?.date ? new Date(story.commit.date).toLocaleDateString() : 'N/A'}</span>
        <span class="meta-item">⏱️ ${story.execution_time_ms}ms</span>
      </p>
      <p class="story-metrics">
        Components: ${metrics.components_proven || 0}/${metrics.components_total || 0} • 
        Validators: ${metrics.validators_passed || 0}/${metrics.validators_total || 0}
      </p>
      ${isFailed ? `
        <button 
          class="view-details-btn" 
          onclick="window.viewStoryDetails('${story.story_name}')"
          style="
            margin-top: 12px;
            padding: 8px 16px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            border-radius: 6px;
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s ease;
          "
          onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 12px rgba(102, 126, 234, 0.4)'"
          onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='none'"
        >
          🔍 View Details
        </button>
      ` : ''}
    </div>
    ${story.validation?.validators ? `
      <div class="validator-summary" style="display: flex; flex-wrap: wrap; gap: 6px; margin-top: 12px;">
        ${story.validation.validators.map(v => {
          const vStatusColor = v.status === 'success' ? '#d1f4e0' : 
                               v.status === 'warning' ? '#ffd4a3' : '#ffcccb';
          const vTextColor = v.status === 'success' ? '#2daa4d' :
                            v.status === 'warning' ? '#e68500' : '#e63329';
          return `
            <span class="validator-mini" style="
              background: ${vStatusColor};
              color: ${vTextColor};
              padding: 4px 10px;
              border-radius: 4px;
              font-size: 11px;
              font-weight: 600;
            ">${v.name}</span>
          `;
        }).join('')}
      </div>
    ` : ''}
  `;
  
  return card;
}

function showDetailsModal(storyId, result) {
  // Remove existing modal if any
  const existingModal = document.getElementById('story-details-modal');
  if (existingModal) {
    existingModal.remove();
  }

  // Parse the response structure
  const validation = result.validation || {};
  const validators = validation.results || [];
  const componentProofs = result.component_proofs || [];
  const overallProof = result.overall_proof || {};
  const summary = result.summary || {};

  console.log('📊 Modal Data Structure:', {
    storyId,
    overallProof,
    validators: validators.length,
    componentProofs: componentProofs.length
  });

  const modal = document.createElement('div');
  modal.id = 'story-details-modal';
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    animation: fadeIn 0.2s ease;
  `;

  modal.innerHTML = `
    <div style="
      background: white;
      border-radius: 16px;
      width: 95%;
      max-width: 1200px;
      max-height: 90vh;
      overflow: hidden;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      display: flex;
      flex-direction: column;
      animation: slideUp 0.3s ease;
    ">
      <!-- Header -->
      <div style="
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 20px 24px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-shrink: 0;
      ">
        <div style="flex: 1;">
          <h2 style="margin: 0; font-size: 20px; font-weight: 700;">📋 ${storyId}</h2>
          <p style="margin: 6px 0 0 0; opacity: 0.9; font-size: 13px;">
            Verdict: ${overallProof.verdict || 'UNKNOWN'} • 
            Confidence: ${overallProof.confidence || 'N/A'} • 
            Score: ${overallProof.score || 0}% •
            Environment: ${result.environment || 'production'}
          </p>
        </div>
        <button onclick="document.getElementById('story-details-modal').remove()" style="
          background: rgba(255,255,255,0.2);
          border: none;
          color: white;
          width: 36px;
          height: 36px;
          border-radius: 50%;
          font-size: 20px;
          cursor: pointer;
          transition: background 0.2s;
          line-height: 1;
          flex-shrink: 0;
        ">×</button>
      </div>
      
      <!-- Content -->
      <div style="
        padding: 0;
        overflow-y: auto;
        flex: 1;
        display: flex;
        flex-direction: column;
      " id="modal-content-body">
        <!-- Content will be populated by JavaScript -->
      </div>
      
      <!-- Footer -->
      <div style="
        background: #f9f9f9;
        padding: 16px 24px;
        border-top: 1px solid #e5e5e7;
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-shrink: 0;
      ">
        <div style="font-size: 12px; color: #86868b;">
          ⏱️ Execution Time: ${result.execution_time || 'N/A'} • 
          Validators: ${validators.length} • 
          Components: ${componentProofs.length}
        </div>
        <button onclick="document.getElementById('story-details-modal').remove()" style="
          background: white;
          border: 1px solid #d2d2d7;
          color: #1d1d1f;
          padding: 8px 20px;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        ">Close</button>
      </div>
    </div>
    
    <style>
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      
      @keyframes slideUp {
        from { transform: translateY(30px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }
    </style>
  `;

  document.body.appendChild(modal);

  // Populate the modal content
  const modalContentBody = modal.querySelector('#modal-content-body');
  modalContentBody.appendChild(createModalDetailedContent(result, storyId));

  // Close on background click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });
}

// Create detailed content for the modal
function createModalDetailedContent(result, storyId) {
  const container = document.createElement('div');
  container.style.padding = '20px';
  
  const validation = result.validation || {};
  const validators = validation.results || [];
  const componentProofs = result.component_proofs || [];
  const overallProof = result.overall_proof || {};
  const summary = result.summary || {};

  // Summary Statistics
  const successfulValidators = validators.filter(v => v.status === 'success').length;
  const warningValidators = validators.filter(v => v.status === 'warning').length;
  const failedValidators = validators.filter(v => v.status === 'failed').length;

  const statsGrid = createElement('div', { className: 'stats-grid', style: 'margin-bottom: 20px;' });
  
  statsGrid.append(
    createStatCard('Components', `${summary.proven_components || 0}/${summary.total_components || 0}`, '#667eea'),
    createStatCard('Successful', successfulValidators, '#10b981'),
    createStatCard('Warnings', warningValidators, '#f97316'),
    createStatCard('Failed', failedValidators, '#FF3B30')
  );
  
  container.append(statsGrid);

  // Overall Proof Summary
  if (overallProof.details) {
    const proofSummary = createElement('div', {
      style: `
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        padding: 16px;
        margin-bottom: 20px;
        border-left: 4px solid #667eea;
      `
    });
    
    proofSummary.innerHTML = `
      <h3 style="margin: 0 0 12px 0; font-size: 16px; font-weight: 600; color: #1d1d1f;">
        📊 Overall Validation Summary
      </h3>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 12px;">
        <div style="text-align: center;">
          <div style="font-size: 20px; font-weight: 700; color: #10b981;">${overallProof.details.validators_passed || 0}</div>
          <div style="font-size: 11px; color: #666; text-transform: uppercase;">Passed</div>
        </div>
        <div style="text-align: center;">
          <div style="font-size: 20px; font-weight: 700; color: #f97316;">${overallProof.details.validators_warnings || 0}</div>
          <div style="font-size: 11px; color: #666; text-transform: uppercase;">Warnings</div>
        </div>
        <div style="text-align: center;">
          <div style="font-size: 20px; font-weight: 700; color: #ef4444;">${overallProof.details.validators_failed || 0}</div>
          <div style="font-size: 11px; color: #666; text-transform: uppercase;">Failed</div>
        </div>
        <div style="text-align: center;">
          <div style="font-size: 20px; font-weight: 700; color: #86868b;">${overallProof.details.validators_skipped || 0}</div>
          <div style="font-size: 11px; color: #666; text-transform: uppercase;">Skipped</div>
        </div>
      </div>
    `;
    
    container.append(proofSummary);
  }

  // Detailed Validators Section - Show ALL Validators with Full Details
  if (validators.length > 0) {
    const validatorsSection = createElement('div', { 
      className: 'detailed-section',
      style: 'margin-bottom: 20px;'
    });
    
    const sectionHeader = createElement('div', {
      style: 'display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px;'
    });
    
    sectionHeader.innerHTML = `
      <h3 style="margin: 0; font-size: 16px; font-weight: 600; color: #1d1d1f;">
        🔍 Detailed Validation Results
      </h3>
      <span style="
        background: #f0f0f0;
        color: #666;
        font-size: 12px;
        padding: 4px 10px;
        border-radius: 12px;
        font-weight: 500;
      ">${validators.length} validators</span>
    `;
    
    validatorsSection.append(sectionHeader);
    
    const validatorsContainer = createElement('div', {
      style: 'display: flex; flex-direction: column; gap: 12px; max-height: 500px; overflow-y: auto; padding-right: 8px;'
    });
    
    validators.forEach((validator, index) => {
      const card = createElement('div', { 
        className: `validator-detail-card status-${validator.status}`,
        style: 'margin: 0; border-left: 4px solid;'
      });
      
      // Set border color based on status
      const borderColor = validator.status === 'success' ? '#10b981' : 
                         validator.status === 'warning' ? '#f59e0b' : 
                         validator.status === 'failed' ? '#ef4444' : '#6b7280';
      card.style.borderLeftColor = borderColor;
      
      card.innerHTML = createValidatorCardContent(validator, index);
      validatorsContainer.append(card);
    });
    
    validatorsSection.append(validatorsContainer);
    container.append(validatorsSection);
  }

  // Components Section with Detailed Proofs
  if (componentProofs.length > 0) {
    const componentsSection = createElement('div', { 
      className: 'detailed-section',
      style: 'margin-bottom: 20px;'
    });
    
    const sectionHeader = createElement('div', {
      style: 'display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px;'
    });
    
    sectionHeader.innerHTML = `
      <h3 style="margin: 0; font-size: 16px; font-weight: 600; color: #1d1d1f;">
        📦 Component Validation Details
      </h3>
      <span style="
        background: #f0f0f0;
        color: #666;
        font-size: 12px;
        padding: 4px 10px;
        border-radius: 12px;
        font-weight: 500;
      ">${componentProofs.length} components</span>
    `;
    
    componentsSection.append(sectionHeader);
    
    const componentsGrid = createElement('div', {
      className: 'components-detailed-grid',
      style: 'grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 12px;'
    });
    
    componentProofs.forEach((comp, index) => {
      const component = comp.component || {};
      const card = createElement('div', { 
        className: `component-detail-card ${comp.proven ? 'proven' : 'not-proven'}`,
        style: 'margin: 0; padding: 16px;'
      });
      
      card.innerHTML = `
        <div class="component-header" style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
          <div class="component-type-badge" style="background: #667eea; color: white; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; text-transform: uppercase;">
            ${component.Type || component.type || 'Unknown'}
          </div>
          <div class="component-status ${comp.confidence || 'unknown'}" style="font-size: 11px; font-weight: 600; color: ${getConfidenceColor(comp.confidence)};">
            ${comp.confidence || 'Unknown'} Confidence
          </div>
        </div>
        <div class="component-name" style="font-family: SF Mono, monospace; font-size: 13px; font-weight: 600; color: #1d1d1f; margin-bottom: 12px; word-break: break-all;">
          ${component.Name || component.name || component.api_name || 'Unknown Component'}
        </div>
        
        ${comp.confidence_score ? `
          <div class="component-score" style="background: #f1f5f9; padding: 6px 10px; border-radius: 4px; font-size: 12px; font-weight: 600; color: #475569; margin-bottom: 12px; text-align: center;">
            Confidence Score: ${comp.confidence_score}%
          </div>
        ` : ''}
        
        ${comp.methods && comp.methods.length > 0 ? `
          <div class="component-methods" style="margin-bottom: 12px;">
            <div style="font-size: 11px; font-weight: 600; color: #64748b; margin-bottom: 6px;">Validation Methods:</div>
            <div style="display: flex; flex-wrap: wrap; gap: 6px;">
              ${comp.methods.map(method => 
                `<span class="method-tag" style="background: #e2e8f0; color: #475569; padding: 3px 8px; border-radius: 12px; font-size: 10px; font-weight: 600;">${method}</span>`
              ).join('')}
            </div>
          </div>
        ` : ''}
        
        ${comp.method_details && comp.method_details.length > 0 ? `
          <div class="method-details" style="border-top: 1px solid #e2e8f0; padding-top: 12px;">
            <div style="font-size: 11px; font-weight: 600; color: #64748b; margin-bottom: 6px;">Method Details:</div>
            <div style="display: flex; flex-direction: column; gap: 4px;">
              ${comp.method_details.map(detail => `
                <div style="display: flex; justify-content: space-between; font-size: 10px;">
                  <span style="color: #475569;">${detail.method}:</span>
                  <span style="color: ${detail.status === 'success' ? '#10b981' : detail.status === 'failed' ? '#ef4444' : '#f59e0b'}; font-weight: 600;">${detail.status}</span>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
      `;
      
      componentsGrid.append(card);
    });
    
    componentsSection.append(componentsGrid);
    container.append(componentsSection);
  }

  // Proof Methods Used
  if (result.proof_methods_used && result.proof_methods_used.length > 0) {
    const methodsSection = createElement('div', { 
      className: 'detailed-section',
      style: 'margin-bottom: 20px;'
    });
    
    methodsSection.innerHTML = `
      <h3 style="margin: 0 0 12px 0; font-size: 16px; font-weight: 600; color: #1d1d1f;">
        🔧 Proof Methods Used
      </h3>
      <div style="display: flex; flex-wrap: wrap; gap: 8px;">
        ${result.proof_methods_used.map(method => `
          <span style="
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 6px 12px;
            border-radius: 16px;
            font-size: 11px;
            font-weight: 600;
          ">${method}</span>
        `).join('')}
      </div>
    `;
    
    container.append(methodsSection);
  }

  // Commit Information
  if (result.commits && result.commits.length > 0) {
    const commitSection = createElement('div', { 
      className: 'detailed-section',
      style: 'margin-bottom: 20px;'
    });
    
    commitSection.innerHTML = '<h3 style="margin: 0 0 12px 0; font-size: 16px; font-weight: 600; color: #1d1d1f;">🔗 Git Commits</h3>';
    
    const commitCard = createElement('div', { 
      style: 'background: #f8fafc; border: 1px solid #e2e8f0; padding: 12px; border-radius: 6px;'
    });
    
    commitCard.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 8px;">
        ${result.commits.map(commit => `
          <div style="font-family: SF Mono, monospace; font-size: 13px; font-weight: 600; color: #1e293b; word-break: break-all;">
            ${commit}
          </div>
        `).join('')}
      </div>
    `;
    
    commitSection.append(commitCard);
    container.append(commitSection);
  }

  // Show message if no detailed data
  if (validators.length === 0 && componentProofs.length === 0) {
    const noDataSection = createElement('div', { 
      style: 'text-align: center; padding: 40px 20px; color: #86868b; background: #f9f9f9; border-radius: 8px;'
    });
    
    noDataSection.innerHTML = `
      <div style="font-size: 48px; margin-bottom: 16px;">📊</div>
      <h4 style="margin: 0 0 8px 0; font-size: 16px; color: #1d1d1f;">Limited Data Available</h4>
      <p style="margin: 0; font-size: 13px;">Detailed validation information is not available for this story.</p>
    `;
    
    container.append(noDataSection);
  }

  return container;
}

// Helper function to get confidence color
function getConfidenceColor(confidence) {
  switch (confidence?.toLowerCase()) {
    case 'high': return '#10b981';
    case 'medium': return '#f59e0b';
    case 'low': return '#ef4444';
    default: return '#6b7280';
  }
}

// Make viewStoryDetails available globally
window.viewStoryDetails = viewStoryDetails;

function displaySingleResult(result, storyName) {
  const resultsSection = $('#validation-results');
  
  const proof = result.proof || {};
  const status = proof.conclusion || 'UNKNOWN';
  const validators = proof.validators || [];
  
  resultsSection.innerHTML = '';
  
  // Summary card
  const summaryCard = createElement('div', { className: 'result-summary-card' });
  
  const statusBadge = createElement('div', { 
    className: `status-badge-large status-${status.toLowerCase()}` 
  }, status);
  
  const storyInfo = createElement('div', { className: 'story-info' });
  storyInfo.innerHTML = `
    <h3>${proof.story_name || 'Unknown Story'}</h3>
    <p class="story-meta">
      <span class="meta-item">📅 Analyzed: ${new Date().toLocaleString()}</span>
      <span class="meta-item">⏱️ Duration: ${proof.duration || 'N/A'}</span>
    </p>
  `;
  
  summaryCard.append(statusBadge, storyInfo);
  resultsSection.append(summaryCard);
  
  // Validators results
  if (validators.length > 0) {
    const validatorsSection = createElement('div', { className: 'validators-section' });
    validatorsSection.innerHTML = '<h4>Validation Details</h4>';
    
    const validatorsGrid = createElement('div', { className: 'validators-grid' });
    
    validators.forEach(validator => {
      const card = createValidatorCard(validator);
      validatorsGrid.append(card);
    });
    
    validatorsSection.append(validatorsGrid);
    resultsSection.append(validatorsSection);
  }
  
  // Components summary
  if (proof.components && proof.components.length > 0) {
    const componentsSection = createElement('div', { className: 'components-section' });
    componentsSection.innerHTML = '<h4>Components Validated</h4>';
    
    const componentsList = createElement('div', { className: 'components-list' });
    
    proof.components.forEach(comp => {
      const compItem = createElement('div', { className: 'component-item' });
      compItem.innerHTML = `
        <span class="component-type">${comp.type}</span>
        <span class="component-name">${comp.api_name}</span>
      `;
      componentsList.append(compItem);
    });
    
    componentsSection.append(componentsList);
    resultsSection.append(componentsSection);
  }
}

function displayBulkResults(result) {
  const resultsSection = $('#validation-results');
  resultsSection.innerHTML = '';
  
  // Handle UI-friendly response from bulk endpoint
  const overview = result.overview || {};
  const summary = overview.summary || {};
  const stories = result.stories || [];
  
  // Summary stats
  const statsGrid = createElement('div', { className: 'stats-grid' });
  
  statsGrid.append(
    createStatCard('Total Stories', overview.total_stories || 0, '#1d1d1f'),
    createStatCard('Proven', summary.proven || 0, '#34C759'),
    createStatCard('Partial', summary.partial || 0, '#FF9500'),
    createStatCard('Unproven', summary.unproven || 0, '#FF3B30')
  );
  
  resultsSection.append(statsGrid);
  
  // Individual results
  if (stories.length > 0) {
    const resultsListSection = createElement('div', { className: 'results-list-section' });
    resultsListSection.innerHTML = '<h4>Individual Results</h4>';
    
    stories.forEach(story => {
      const card = createStoryCard(story);
      resultsListSection.append(card);
    });
    
    resultsSection.append(resultsListSection);
  }
}

function createValidatorCard(validator) {
  const card = createElement('div', { className: 'validator-card' });
  
  const status = validator.status || 'unknown';
  const icon = getStatusIcon(status);
  const color = getStatusColor(status);
  
  card.innerHTML = `
    <div class="validator-header">
      <span class="validator-icon" style="color: ${color}">${icon}</span>
      <div class="validator-info">
        <h5>${validator.validator || 'Unknown'}</h5>
        <span class="validator-status status-${status}">${status.toUpperCase()}</span>
      </div>
    </div>
    ${validator.notes && validator.notes.length > 0 ? `
      <div class="validator-notes">
        ${validator.notes.map(note => `<p class="note">• ${note}</p>`).join('')}
      </div>
    ` : ''}
  `;
  
  return card;
}

function createBulkResultCard(storyResult) {
  const card = createElement('div', { className: 'bulk-result-card' });
  
  const proof = storyResult.proof || {};
  const status = proof.conclusion || 'UNKNOWN';
  const color = status === 'PROVEN' ? '#34C759' : status === 'UNPROVEN' ? '#FF9500' : '#FF3B30';
  
  card.innerHTML = `
    <div class="bulk-result-header">
      <h5>${storyResult.story_name || 'Unknown'}</h5>
      <span class="status-badge" style="background: ${color}">${status}</span>
    </div>
    ${proof.validators && proof.validators.length > 0 ? `
      <div class="validator-summary">
        ${proof.validators.map(v => `
          <span class="validator-mini status-${v.status}">${v.validator}</span>
        `).join('')}
      </div>
    ` : ''}
  `;
  
  return card;
}

function createStatCard(label, value, color) {
  const card = createElement('div', { className: 'stat-card' });
  card.innerHTML = `
    <div class="stat-label">${label}</div>
    <div class="stat-value" style="color: ${color}">${value}</div>
  `;
  return card;
}

function getStatusIcon(status) {
  switch (status.toLowerCase()) {
    case 'success': return '✓';
    case 'warning': return '⚠';
    case 'failed': return '✗';
    case 'skipped': return '⊘';
    default: return '?';
  }
}

function getStatusColor(status) {
  switch (status.toLowerCase()) {
    case 'success': return '#34C759';
    case 'warning': return '#FF9500';
    case 'failed': return '#FF3B30';
    case 'skipped': return '#86868b';
    default: return '#1d1d1f';
  }
}

function showError(message) {
  const resultsSection = $('#validation-results');
  resultsSection.style.display = 'block';
  
  resultsSection.innerHTML = `
    <div class="error-state">
      <div class="error-icon">⚠️</div>
      <h4>Validation Error</h4>
      <p>${message}</p>
    </div>
  `;
}

function handleClear() {
  const textarea = $('#story-input');
  textarea.value = '';
  
  const resultsSection = $('#validation-results');
  resultsSection.style.display = 'none';
  resultsSection.innerHTML = '';
}

function createElement(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  Object.assign(node, props);
  const childArray = Array.isArray(children) ? children : [children];
  childArray.forEach(child => {
    if (typeof child === 'string') {
      node.appendChild(document.createTextNode(child));
    } else if (child instanceof Node) {
      node.appendChild(child);
    }
  });
  return node;
}


function displaySingleStoryDetailed(result, storyName) {
  const resultsSection = $('#validation-results');
  resultsSection.innerHTML = '';
  
  // Parse the response structure
  const validation = result.validation || {};
  const validators = validation.results || [];
  const componentProofs = result.component_proofs || [];
  const overallProof = result.overall_proof || {};
  const summary = result.summary || {};
  
  console.log('📊 Single Story Data Structure:', {
    storyName,
    overallProof,
    validators: validators.length,
    componentProofs: componentProofs.length,
    validators
  });

  // Story Header Card
  const headerCard = createElement('div', { className: 'story-header-card' });
  headerCard.innerHTML = `
    <div class="story-icon">📋</div>
    <div class="story-info">
      <h3>${storyName}</h3>
      <p class="story-meta">
        <span class="meta-item">📅 Validated: ${new Date().toLocaleString()}</span>
        <span class="meta-item">🏭 Environment: ${result.environment || 'production'}</span>
        <span class="meta-item">⏱️ Duration: ${result.execution_time || 'N/A'}</span>
        <span class="meta-item">🔧 Validators: ${validators.length}</span>
      </p>
    </div>
    <div class="verdict-section">
      <div class="verdict-badge verdict-${(overallProof.verdict || 'UNKNOWN').toLowerCase()}">
        ${overallProof.verdict || 'UNKNOWN'}
      </div>
      <div class="confidence-score">
        <span class="score">${overallProof.score || 0}%</span>
        <span class="confidence">${overallProof.confidence || 'Unknown'} Confidence</span>
      </div>
    </div>
  `;
  resultsSection.append(headerCard);

  // Summary Statistics
  const statsGrid = createElement('div', { className: 'stats-grid' });
  
  const successfulValidators = validators.filter(v => v.status === 'success').length;
  const warningValidators = validators.filter(v => v.status === 'warning').length;
  const failedValidators = validators.filter(v => v.status === 'failed').length;
  
  statsGrid.append(
    createStatCard('Components', `${summary.proven_components || 0}/${summary.total_components || 0}`, '#667eea'),
    createStatCard('Successful', successfulValidators, '#10b981'),
    createStatCard('Warnings', warningValidators, '#f97316'),
    createStatCard('Failed', failedValidators, '#FF3B30')
  );
  
  resultsSection.append(statsGrid);

  // Detailed Validators Section - Show ALL Validators with Full Details
  if (validators.length > 0) {
    const validatorsSection = createElement('div', { className: 'detailed-section' });
    validatorsSection.innerHTML = '<h4>🔍 Detailed Validation Results</h4>';
    
    validators.forEach((validator, index) => {
      const card = createElement('div', { 
        className: `validator-detail-card status-${validator.status}`
      });
      
      card.innerHTML = createValidatorCardContent(validator, index);
      validatorsSection.append(card);
    });
    
    resultsSection.append(validatorsSection);
  }

  // Components Section
  if (componentProofs.length > 0) {
    const componentsSection = createElement('div', { className: 'detailed-section' });
    componentsSection.innerHTML = '<h4>📦 Components Summary</h4>';
    
    const componentsGrid = createElement('div', { className: 'components-detailed-grid' });
    
    componentProofs.forEach((comp, index) => {
      const component = comp.component || {};
      const card = createElement('div', { 
        className: `component-detail-card ${comp.proven ? 'proven' : 'not-proven'}` 
      });
      
      card.innerHTML = `
        <div class="component-header">
          <div class="component-type-badge">${component.Type || component.type || 'Unknown'}</div>
          <div class="component-status ${comp.confidence || 'unknown'}">
            ${comp.confidence || 'Unknown'} Confidence
          </div>
        </div>
        <div class="component-name">${component.Name || component.name || component.api_name || 'Unknown Component'}</div>
        <div class="component-methods">
          ${(comp.methods || []).map(method => 
            `<span class="method-tag">${method}</span>`
          ).join('')}
        </div>
      `;
      
      componentsGrid.append(card);
    });
    
    componentsSection.append(componentsGrid);
    resultsSection.append(componentsSection);
  }

  // Show message if no detailed data
  if (validators.length === 0) {
    const noDataSection = createElement('div', { className: 'no-data-section' });
    noDataSection.innerHTML = `
      <div class="no-data-icon">📊</div>
      <h4>No Validation Data Available</h4>
      <p>Detailed validation information is not available for this story. The story may not have been deployed to production yet.</p>
    `;
    resultsSection.append(noDataSection);
  }
}

// Helper function to create detailed validator card content
function createValidatorCardContent(validator, index) {
  const details = validator.details || {};
  const checks = validator.checks_performed || [];
  
  let detailsContent = '';
  
  // Format details based on validator type
  switch (validator.validator) {
    case 'commit_exists':
      detailsContent = `
        <div class="validator-detail-group">
          <div class="detail-item">
            <span class="detail-label">Commit SHA:</span>
            <span class="detail-value code">${details.commit_sha || 'N/A'}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Commit Author:</span>
            <span class="detail-value">${details.commit_author || 'N/A'}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Commit Date:</span>
            <span class="detail-value">${details.commit_date ? new Date(details.commit_date).toLocaleString() : 'N/A'}</span>
          </div>
          ${details.commit_message ? `
            <div class="detail-item">
              <span class="detail-label">Commit Message:</span>
              <span class="detail-value commit-message">${details.commit_message}</span>
            </div>
          ` : ''}
        </div>
      `;
      break;
      
    case 'files_in_commit':
      detailsContent = `
        <div class="validator-detail-group">
          <div class="detail-item">
            <span class="detail-label">Commit SHA:</span>
            <span class="detail-value code">${details.commit_sha || 'N/A'}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Files Changed:</span>
            <span class="detail-value highlight">${details.files_changed || 0}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Has Changes:</span>
            <span class="detail-value status-${details.has_changes ? 'success' : 'failed'}">
              ${details.has_changes ? 'Yes' : 'No'}
            </span>
          </div>
          ${details.git_diffstat ? `
            <div class="detail-item">
              <span class="detail-label">Diff Stat:</span>
              <span class="detail-value">${details.git_diffstat}</span>
            </div>
          ` : ''}
        </div>
      `;
      break;
      
    case 'component_exists': {
      const existComponents = details.components || [];
      const foundCount = existComponents.filter(comp => comp.found).length;
      const notFoundCount = existComponents.filter(comp => !comp.found).length;
      
      detailsContent = `
        <div class="validator-detail-group">
          <div class="detail-item">
            <span class="detail-label">Components Checked:</span>
            <span class="detail-value">${existComponents.length}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Components Found:</span>
            <span class="detail-value success">${foundCount}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Components Not Found:</span>
            <span class="detail-value ${notFoundCount > 0 ? 'warning' : ''}">
              ${notFoundCount}
            </span>
          </div>
          
          ${existComponents.length > 0 ? `
            <div class="component-exist-details">
              <div class="detail-label">Component Details:</div>
              <div class="component-exist-list">
                ${existComponents.map(comp => `
                  <div class="component-exist-item ${comp.found ? 'found' : 'not-found'}">
                    <div class="component-exist-header">
                      <span class="component-exist-name">${comp.name || comp.cleaned_name || 'Unknown Component'}</span>
                      <span class="component-exist-status ${comp.found ? 'found' : 'not-found'}">
                        ${comp.found ? '✅ Found' : '❌ Not Found'}
                      </span>
                    </div>
                    ${comp.found ? `
                      <div class="component-exist-details">
                        <div class="component-detail-row">
                          <span class="detail-label">Last Modified:</span>
                          <span class="detail-value">${comp.last_modified ? new Date(comp.last_modified).toLocaleString() : 'N/A'}</span>
                        </div>
                        ${comp.matched_field ? `
                          <div class="component-detail-row">
                            <span class="detail-label">Matched Field:</span>
                            <span class="detail-value code">${comp.matched_field}</span>
                          </div>
                        ` : ''}
                        ${comp.cleaned_name ? `
                          <div class="component-detail-row">
                            <span class="detail-label">Cleaned Name:</span>
                            <span class="detail-value code">${comp.cleaned_name}</span>
                          </div>
                        ` : ''}
                        ${comp.type ? `
                          <div class="component-detail-row">
                            <span class="detail-label">Type:</span>
                            <span class="detail-value">${comp.type}</span>
                          </div>
                        ` : ''}
                      </div>
                    ` : `
                      <div class="component-exist-details">
                        <div class="component-detail-row">
                          <span class="detail-label">Status:</span>
                          <span class="detail-value warning">Component not found in production</span>
                        </div>
                        ${comp.cleaned_name ? `
                          <div class="component-detail-row">
                            <span class="detail-label">Looking For:</span>
                            <span class="detail-value code">${comp.cleaned_name}</span>
                          </div>
                        ` : ''}
                      </div>
                    `}
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}
        </div>
      `;
      break;
    }
      
    case 'component_timestamp': {
      const timestampComponents = details.components || [];
      detailsContent = `
        <div class="validator-detail-group">
          <div class="detail-item">
            <span class="detail-label">Commit SHA:</span>
            <span class="detail-value code">${details.commit_sha || 'N/A'}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Commit Date:</span>
            <span class="detail-value">${details.commit_date ? new Date(details.commit_date).toLocaleString() : 'N/A'}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Total Components:</span>
            <span class="detail-value">${details.total || timestampComponents.length}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Matches:</span>
            <span class="detail-value success">${details.matches || timestampComponents.filter(c => c.status === 'match').length}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Mismatches:</span>
            <span class="detail-value warning">${details.mismatches || timestampComponents.filter(c => c.status === 'mismatch').length}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Not Found:</span>
            <span class="detail-value failed">${details.not_found || timestampComponents.filter(c => c.status === 'not_found').length}</span>
          </div>
          
          ${timestampComponents.length > 0 ? `
            <div class="component-timestamp-details">
              <div class="detail-label">Component Timestamps:</div>
              <div class="timestamp-components">
                ${timestampComponents.map(comp => `
                  <div class="timestamp-component ${comp.status}">
                    <div class="component-name">${comp.component}</div>
                    <div class="timestamp-status status-${comp.status}">${comp.status.toUpperCase()}</div>
                    ${comp.commit_date ? `
                      <div class="timestamp-date">
                        <span>Commit: ${new Date(comp.commit_date).toLocaleString()}</span>
                      </div>
                    ` : ''}
                    ${comp.salesforce_date ? `
                      <div class="timestamp-date">
                        <span>Salesforce: ${new Date(comp.salesforce_date).toLocaleString()}</span>
                      </div>
                    ` : ''}
                    ${comp.compare_field ? `
                      <div class="compare-field">Compared: ${comp.compare_field}</div>
                    ` : ''}
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}
        </div>
      `;
      break;
    }
      
    case 'commit_contents':
      detailsContent = `
        <div class="validator-detail-group">
          <div class="detail-item">
            <span class="detail-label">Validation Level:</span>
            <span class="detail-value">${details.validation_level || 'N/A'}</span>
          </div>
          ${details.files_verified ? `
            <div class="detail-item">
              <span class="detail-label">Files Verified:</span>
              <span class="detail-value">${details.files_verified}</span>
            </div>
          ` : ''}
          ${details.checks_passed ? `
            <div class="detail-item">
              <span class="detail-label">Checks Passed:</span>
              <span class="detail-value success">${details.checks_passed}</span>
            </div>
          ` : ''}
          ${details.checks_failed ? `
            <div class="detail-item">
              <span class="detail-label">Checks Failed:</span>
              <span class="detail-value failed">${details.checks_failed}</span>
            </div>
          ` : ''}
          ${details.notes && details.notes.length > 0 ? `
            <div class="detail-item">
              <span class="detail-label">Notes:</span>
              <div class="notes-list">
                ${details.notes.slice(0, 5).map(note => `<div class="note">• ${note}</div>`).join('')}
                ${details.notes.length > 5 ? `<div class="note-more">+ ${details.notes.length - 5} more notes</div>` : ''}
              </div>
            </div>
          ` : ''}
        </div>
      `;
      break;
      
    default:
      // Generic details display for unknown validators
      if (Object.keys(details).length > 0) {
        detailsContent = `
          <div class="validator-detail-group">
            ${Object.entries(details).map(([key, value]) => `
              <div class="detail-item">
                <span class="detail-label">${formatKey(key)}:</span>
                <span class="detail-value">${formatValue(value)}</span>
              </div>
            `).join('')}
          </div>
        `;
      } else {
        detailsContent = '<div class="no-details">No detailed information available</div>';
      }
  }
  
  return `
    <div class="validator-header">
      <div class="validator-title">
        <span class="validator-icon">${getStatusIcon(validator.status)}</span>
        <span class="validator-name">${validator.validator || `Validator ${index + 1}`}</span>
      </div>
      <div class="validator-meta">
        <span class="validator-status status-${validator.status}">${validator.status.toUpperCase()}</span>
        <span class="validator-time">${validator.execution_time_ms}ms</span>
      </div>
    </div>
    
    ${checks.length > 0 ? `
      <div class="validator-checks">
        <strong>Checks Performed:</strong> 
        <div class="checks-list">
          ${checks.map(check => `<span class="check-tag">${check}</span>`).join('')}
        </div>
      </div>
    ` : ''}
    
    ${detailsContent}
    
    ${validator.error ? `
      <div class="validator-error">
        <strong>Error:</strong> ${validator.error}
      </div>
    ` : ''}
  `;
}

// Helper functions for formatting
function formatKey(key) {
  return key.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

function formatValue(value) {
  if (value === null || value === undefined) return 'N/A';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return value.toString();
}

const injectCss = (() => {
  let done = false;
  return () => {
    if (done) return;
    done = true;

    const css = `
      /* Production Validator Styles - Synced with Stories Enhanced Design */
      
      .validator-input-section {
        display: grid;
        grid-template-columns: 1fr 2fr;
        gap: 24px;
        margin-bottom: 32px;
      }

      .validator-info-card {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 24px;
        border-radius: 18px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
      }

      .validator-info-card h3 {
        margin: 0 0 16px 0;
        font-size: 18px;
        font-weight: 700;
        color: white;
      }

      .info-list {
        list-style: none;
        padding: 0;
        margin: 0;
      }

      .info-list li {
        padding: 8px 0;
        font-size: 14px;
        color: rgba(255, 255, 255, 0.95);
        line-height: 1.5;
      }

      .validator-input-card {
        background: white;
        border: 1px solid #e5e5e7;
        padding: 24px;
        border-radius: 18px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
      }

      .input-label {
        display: block;
        font-size: 16px;
        font-weight: 600;
        color: #1d1d1f;
        margin-bottom: 8px;
      }

      .input-help {
        font-size: 13px;
        color: #86868b;
        margin: 0 0 16px 0;
      }

      .story-input {
        width: 100%;
        padding: 12px;
        border: 1px solid #d2d2d7;
        border-radius: 12px;
        font-size: 14px;
        font-family: 'SF Mono', monospace;
        resize: vertical;
        transition: border-color 0.3s ease, box-shadow 0.3s ease;
      }

      .story-input:focus {
        outline: none;
        border-color: #667eea;
        box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
      }

      .validator-button-group {
        display: flex;
        gap: 12px;
        margin-top: 16px;
      }

      .validator-btn {
        flex: 1;
        padding: 12px 24px;
        border-radius: 12px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
        border: none;
      }

      .btn-primary {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
      }

      .btn-primary:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
      }

      .btn-secondary {
        background: white;
        color: #1d1d1f;
        border: 1px solid #d2d2d7;
      }

      .btn-secondary:hover {
        background: #f5f5f7;
      }

      /* Loading State */
      .loading-state {
        text-align: center;
        padding: 60px 20px;
        background: #f9f9f9;
        border-radius: 18px;
        border: 2px dashed #e5e5e7;
      }

      .spinner {
        width: 48px;
        height: 48px;
        border: 4px solid #e5e5e7;
        border-top-color: #667eea;
        border-radius: 50%;
        animation: spin 1s linear infinite;
        margin: 0 auto 20px;
      }

      @keyframes spin {
        to { transform: rotate(360deg); }
      }

      .loading-text {
        font-size: 18px;
        font-weight: 600;
        color: #1d1d1f;
        margin: 0 0 8px 0;
      }

      .loading-subtext {
        font-size: 14px;
        color: #86868b;
        margin: 0;
      }

      /* Error State */
      .error-state {
        text-align: center;
        padding: 40px 20px;
        background: #ffebee;
        border: 1px solid #ffcccb;
        border-radius: 18px;
      }

      .error-icon {
        font-size: 48px;
        margin-bottom: 16px;
      }

      .error-state h4 {
        font-size: 18px;
        font-weight: 600;
        color: #d32f2f;
        margin: 0 0 8px 0;
      }

      .error-state p {
        font-size: 14px;
        color: #1d1d1f;
        margin: 0;
      }

      /* Results */
      .validation-results-section {
        margin-top: 32px;
        animation: fadeIn 0.3s ease;
      }

      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }

      /* Release Header Card */
      .release-header-card {
        display: flex;
        align-items: center;
        gap: 20px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 24px;
        border-radius: 18px;
        margin-bottom: 24px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
      }

      .release-icon {
        font-size: 48px;
      }

      .release-info h3 {
        margin: 0 0 8px 0;
        font-size: 22px;
        font-weight: 700;
        color: white;
      }

      .release-meta {
        display: flex;
        gap: 16px;
        flex-wrap: wrap;
        margin: 0;
        font-size: 13px;
        color: rgba(255, 255, 255, 0.9);
      }

      .meta-item {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        background: rgba(255, 255, 255, 0.2);
        padding: 4px 8px;
        border-radius: 6px;
        font-size: 12px;
      }

      /* Stats Grid */
      .stats-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 16px;
        margin-bottom: 24px;
      }

      .stat-card {
        background: white;
        border: 1px solid #e5e5e7;
        padding: 20px;
        border-radius: 18px;
        text-align: center;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
        transition: transform 0.2s ease;
      }

      .stat-card:hover {
        transform: translateY(-4px);
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
      }

      .stat-label {
        font-size: 13px;
        color: #86868b;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin-bottom: 8px;
      }

      .stat-value {
        font-size: 32px;
        font-weight: 700;
        line-height: 1;
      }

      /* Success Rate Bar */
      .success-rate-section {
        background: white;
        border: 1px solid #e5e5e7;
        padding: 20px;
        border-radius: 18px;
        margin-bottom: 24px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
      }

      .success-rate-section h4 {
        margin: 0 0 12px 0;
        font-size: 16px;
        font-weight: 600;
        color: #1d1d1f;
      }

      .progress-bar {
        width: 100%;
        height: 12px;
        background: #f5f5f7;
        border-radius: 6px;
        overflow: hidden;
        margin-bottom: 8px;
      }

      .progress-fill {
        height: 100%;
        transition: width 0.5s ease;
        border-radius: 6px;
      }

      .progress-label {
        font-size: 13px;
        color: #86868b;
        margin: 0;
      }

      /* Story Cards */
      .bulk-result-card {
        background: white;
        border: 1px solid #e5e5e7;
        padding: 0;
        border-radius: 18px;
        margin-bottom: 16px;
        transition: all 0.3s ease;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
        overflow: hidden;
      }

      .bulk-result-card:hover {
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
        border-color: #d2d2d7;
        transform: translateY(-2px);
      }

      .bulk-result-card.enhanced {
        padding: 0;
      }

      .bulk-result-header {
        background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
        padding: 24px;
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 16px;
        border-bottom: 1px solid #e5e5e7;
      }

      .story-title-section {
        flex: 1;
      }

      .story-title-section h5 {
        margin: 0 0 12px 0;
        font-size: 18px;
        font-weight: 700;
        color: #1d1d1f;
        line-height: 1.4;
      }

      .story-confidence {
        display: flex;
        gap: 8px;
        align-items: center;
      }

      .confidence-badge {
        padding: 4px 8px;
        border-radius: 6px;
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
      }

      .confidence-high { background: #e8f5e9; color: #1b5e20; }
      .confidence-medium { background: #fff3e0; color: #e65100; }
      .confidence-low { background: #ffebee; color: #b71c1c; }
      .confidence-unknown { background: #f5f5f5; color: #666666; }

      .proof-score {
        background: #667eea;
        color: white;
        padding: 4px 8px;
        border-radius: 6px;
        font-size: 11px;
        font-weight: 600;
      }

      .status-badge {
        padding: 8px 12px;
        border-radius: 8px;
        font-size: 12px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        color: white;
      }

      .story-details-enhanced {
        padding: 24px;
        border-bottom: 1px solid #f5f5f7;
      }

      .detail-row {
        display: flex;
        justify-content: space-between;
        margin-bottom: 8px;
        font-size: 13px;
      }

      .detail-label {
        color: #86868b;
        font-weight: 500;
      }

      .detail-value {
        color: #1d1d1f;
        font-weight: 600;
      }

      .story-components-preview {
        padding: 16px 24px;
        background: #f8f9fa;
        border-bottom: 1px solid #e5e5e7;
      }

      .components-tags {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-top: 8px;
      }

      .component-tag {
        background: #e5e7eb;
        color: #374151;
        padding: 4px 8px;
        border-radius: 6px;
        font-size: 11px;
        font-weight: 600;
      }

      .component-more {
        background: #dbeafe;
        color: #1e40af;
        padding: 4px 8px;
        border-radius: 6px;
        font-size: 11px;
        font-weight: 600;
      }

      .story-actions {
        padding: 16px 24px;
        text-align: right;
      }

      .view-details-btn {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border: none;
        padding: 10px 20px;
        border-radius: 8px;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
      }

      .view-details-btn:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
      }

      /* Modal Styles */
      #story-details-modal .stats-grid {
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        gap: 12px;
        margin-bottom: 20px;
      }

      #story-details-modal .detailed-section {
        background: white;
        border: 1px solid #e5e5e7;
        padding: 20px;
        border-radius: 12px;
        margin-bottom: 16px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
      }

      #story-details-modal .validator-detail-card {
        border: 1px solid #e5e5e7;
        padding: 16px;
        border-radius: 12px;
        margin-bottom: 12px;
        transition: all 0.2s ease;
      }

      #story-details-modal .validator-detail-card:hover {
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        transform: translateY(-1px);
      }

      #story-details-modal .component-detail-card {
        border: 1px solid #e5e5e7;
        padding: 16px;
        border-radius: 12px;
        margin-bottom: 12px;
        transition: all 0.2s ease;
      }

      #story-details-modal .component-detail-card:hover {
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        transform: translateY(-1px);
      }

      #story-details-modal .components-detailed-grid {
        grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
        gap: 12px;
      }

      /* Story Header for Single Story */
      .story-header-card {
        display: flex;
        align-items: center;
        gap: 20px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 24px;
        border-radius: 18px;
        margin-bottom: 24px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
      }

      .story-icon {
        font-size: 48px;
      }

      .story-info h3 {
        margin: 0 0 8px 0;
        font-size: 22px;
        font-weight: 700;
        color: white;
      }

      .story-meta {
        display: flex;
        gap: 16px;
        flex-wrap: wrap;
        margin: 0;
        font-size: 13px;
        color: rgba(255, 255, 255, 0.9);
      }

      .verdict-section {
        margin-left: auto;
        text-align: center;
      }

      .verdict-badge {
        padding: 12px 24px;
        border-radius: 12px;
        font-size: 16px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin-bottom: 8px;
      }

      .verdict-proven {
        background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      }

      .verdict-unproven {
        background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
      }

      .confidence-score {
        color: rgba(255, 255, 255, 0.9);
      }

      .confidence-score .score {
        font-size: 20px;
        font-weight: 700;
        display: block;
      }

      /* Detailed Sections */
      .detailed-section {
        background: white;
        border: 1px solid #e5e5e7;
        padding: 24px;
        border-radius: 18px;
        margin-bottom: 24px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
      }

      .detailed-section h4 {
        margin: 0 0 20px 0;
        font-size: 18px;
        font-weight: 600;
        color: #1d1d1f;
        display: flex;
        align-items: center;
        gap: 8px;
      }

      /* Validator Detail Cards */
      .validator-detail-card {
        border: 1px solid #e5e5e7;
        padding: 20px;
        border-radius: 12px;
        margin-bottom: 16px;
        transition: all 0.2s ease;
      }

      .validator-detail-card:hover {
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        transform: translateY(-2px);
      }

      .validator-detail-card.status-success {
        border-left: 4px solid #10b981;
        background: #f0fdf4;
      }

      .validator-detail-card.status-warning {
        border-left: 4px solid #f59e0b;
        background: #fffbeb;
      }

      .validator-detail-card.status-failed {
        border-left: 4px solid #ef4444;
        background: #fef2f2;
      }

      .validator-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 16px;
      }

      .validator-title {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .validator-icon {
        font-size: 20px;
      }

      .validator-name {
        font-weight: 600;
        color: #1d1d1f;
        font-size: 16px;
      }

      .validator-meta {
        display: flex;
        gap: 12px;
        align-items: center;
      }

      .validator-status {
        background: white;
        padding: 6px 12px;
        border-radius: 8px;
        font-size: 12px;
        font-weight: 600;
        text-transform: uppercase;
      }

      .validator-time {
        background: white;
        padding: 6px 12px;
        border-radius: 8px;
        font-size: 12px;
        font-weight: 600;
        color: #666;
      }

      /* Component Detail Cards */
      .components-detailed-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
        gap: 16px;
      }

      .component-detail-card {
        border: 1px solid #e5e5e7;
        padding: 20px;
        border-radius: 12px;
        transition: all 0.2s ease;
      }

      .component-detail-card:hover {
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        transform: translateY(-2px);
      }

      .component-detail-card.proven {
        border-left: 4px solid #10b981;
        background: #f0fdf4;
      }

      .component-detail-card.not-proven {
        border-left: 4px solid #ef4444;
        background: #fef2f2;
      }

      .component-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 16px;
      }

      .component-type-badge {
        background: #667eea;
        color: white;
        padding: 6px 12px;
        border-radius: 8px;
        font-size: 12px;
        font-weight: 600;
        text-transform: uppercase;
      }

      .component-status {
        font-size: 12px;
        font-weight: 600;
        text-transform: capitalize;
      }

      .component-status.high { color: #10b981; }
      .component-status.medium { color: #f59e0b; }
      .component-status.low { color: #ef4444; }

      .component-name {
        font-size: 14px;
        font-weight: 600;
        color: #1d1d1f;
        margin-bottom: 12px;
        font-family: 'SF Mono', monospace;
        word-break: break-all;
      }

      .component-methods {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-bottom: 12px;
      }

      .method-tag {
        background: #e5e7eb;
        color: #374151;
        padding: 4px 8px;
        border-radius: 6px;
        font-size: 11px;
        font-weight: 600;
      }

      /* No Data Section */
      .no-data-section {
        text-align: center;
        padding: 60px 40px;
        background: white;
        border-radius: 18px;
        border: 2px dashed #e5e5e7;
        color: #86868b;
      }

      .no-data-icon {
        font-size: 64px;
        margin-bottom: 16px;
        opacity: 0.5;
      }

      .no-data-section h4 {
        margin: 16px 0 8px;
        font-size: 20px;
        font-weight: 600;
        color: #1d1d1f;
      }

      .no-data-section p {
        margin: 0;
        font-size: 14px;
        color: #666666;
      }

      /* Responsive */
      @media (max-width: 768px) {
        .validator-input-section {
          grid-template-columns: 1fr;
        }

        .stats-grid {
          grid-template-columns: repeat(2, 1fr);
        }

        .components-detailed-grid {
          grid-template-columns: 1fr;
        }

        .story-header-card,
        .release-header-card {
          flex-direction: column;
          align-items: flex-start;
          text-align: left;
        }

        .verdict-section {
          margin-left: 0;
          margin-top: 16px;
        }

        .bulk-result-header {
          flex-direction: column;
          align-items: flex-start;
        }
      }
    `;

    document.head.appendChild(Object.assign(document.createElement('style'), { textContent: css }));
  };
})();