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

async function validateRelease(releaseId) {
  console.log(`Validating release: ${releaseId}`);
  
  showLoading(`Validating release: ${releaseId}`);
  
  // ⚠️ IMPORTANT: There is NO separate /release endpoint!
  // Release validation uses the /bulk endpoint with release_name parameter
  const apiUrl = `${API_URL}/api/deployment/prove/bulk`;
  console.log('🔍 API Call:', { url: apiUrl, releaseId });
  
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      release_name: releaseId,
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
  console.log('Release validation result:', result);
  
  displayReleaseResults(result);
}

async function validateSingleStory(storyName) {
  console.log(`Validating single story: ${storyName}`);
  
  showLoading(`Validating story: ${storyName}`);
  
  const apiUrl = `${API_URL}/api/deployment/prove/story`;
  console.log('🔍 API Call:', { url: apiUrl, storyName });
  
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
  
  displaySingleResult(result, storyName);
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
  
  // The bulk endpoint returns: { overview: {...}, stories: [...], release: {...} }
  const overview = result.overview || {};
  const summary = overview.summary || {};
  const stories = result.stories || [];
  const releaseInfo = result.release || {};
  
  // Release header
  const releaseHeader = createElement('div', { className: 'release-header-card' });
  releaseHeader.innerHTML = `
    <div class="release-icon">📦</div>
    <div class="release-info">
      <h3>${releaseInfo.name || result.release_name || 'Unknown Release'}</h3>
      <p class="release-meta">
        <span class="meta-item">📅 Analyzed: ${new Date().toLocaleString()}</span>
        <span class="meta-item">📊 Total Stories: ${overview.total_stories || 0}</span>
        <span class="meta-item">⏱️ Processing Time: ${overview.processing_time || 'N/A'}</span>
      </p>
    </div>
  `;
  resultsSection.append(releaseHeader);
  
  // Summary stats
  const statsGrid = createElement('div', { className: 'stats-grid' });
  
  statsGrid.append(
    createStatCard('Total Stories', overview.total_stories || 0, '#1d1d1f'),
    createStatCard('Proven', summary.proven || 0, '#34C759'),
    createStatCard('Partial', summary.partial || 0, '#FF9500'),
    createStatCard('Unproven', summary.unproven || 0, '#FF3B30')
  );
  
  resultsSection.append(statsGrid);
  
  // Success rate bar
  if (overview.total_stories > 0) {
    const successRate = summary.success_rate || 0;
    const successBar = createElement('div', { className: 'success-rate-section' });
    successBar.innerHTML = `
      <h4>Deployment Readiness: ${successRate}%</h4>
      <div class="progress-bar">
        <div class="progress-fill" style="width: ${successRate}%; background: ${successRate === 100 ? '#34C759' : successRate >= 70 ? '#FF9500' : '#FF3B30'}"></div>
      </div>
      <p class="progress-label">${summary.proven || 0} of ${overview.total_stories} stories proven</p>
    `;
    resultsSection.append(successBar);
  }
  
  // Individual story results
  if (stories.length > 0) {
    const resultsListSection = createElement('div', { className: 'results-list-section' });
    resultsListSection.innerHTML = '<h4>Story Results</h4>';
    
    stories.forEach(story => {
      const card = createStoryCard(story);
      resultsListSection.append(card);
    });
    
    resultsSection.append(resultsListSection);
  }
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
  // API returns: { validation: { results: [...] }, component_proofs: [...] }
  const validation = result.validation || {};
  const validators = validation.results || [];
  const componentProofs = result.component_proofs || [];
  const overallProof = result.overall_proof || {};
  
  console.log('📊 Parsing modal data:', {
    validators: validators.length,
    components: componentProofs.length,
    verdict: overallProof.verdict
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
      width: 90%;
      max-width: 900px;
      max-height: 85vh;
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
        padding: 24px 32px;
        display: flex;
        justify-content: space-between;
        align-items: center;
      ">
        <div>
          <h2 style="margin: 0; font-size: 24px; font-weight: 700;">📋 ${storyId}</h2>
          <p style="margin: 8px 0 0 0; opacity: 0.9; font-size: 14px;">
            Verdict: ${overallProof.verdict || 'UNKNOWN'} • 
            Confidence: ${overallProof.confidence || 'N/A'} • 
            Score: ${overallProof.score || 0}%
          </p>
        </div>
        <button onclick="document.getElementById('story-details-modal').remove()" style="
          background: rgba(255,255,255,0.2);
          border: none;
          color: white;
          width: 40px;
          height: 40px;
          border-radius: 50%;
          font-size: 24px;
          cursor: pointer;
          transition: background 0.2s;
          line-height: 1;
        " onmouseover="this.style.background='rgba(255,255,255,0.3)'" onmouseout="this.style.background='rgba(255,255,255,0.2)'">×</button>
      </div>
      
      <!-- Content -->
      <div style="
        padding: 32px;
        overflow-y: auto;
        flex: 1;
      ">
        <!-- Summary Stats -->
        ${overallProof.details ? `
          <div style="
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 12px;
            margin-bottom: 24px;
            padding: 16px;
            background: #f9f9f9;
            border-radius: 8px;
          ">
            <div style="text-align: center;">
              <div style="font-size: 24px; font-weight: 700; color: #10b981;">${overallProof.details.validators_passed || 0}</div>
              <div style="font-size: 12px; color: #666; text-transform: uppercase;">Passed</div>
            </div>
            <div style="text-align: center;">
              <div style="font-size: 24px; font-weight: 700; color: #f97316;">${overallProof.details.validators_warnings || 0}</div>
              <div style="font-size: 12px; color: #666; text-transform: uppercase;">Warnings</div>
            </div>
            <div style="text-align: center;">
              <div style="font-size: 24px; font-weight: 700; color: #ef4444;">${overallProof.details.validators_failed || 0}</div>
              <div style="font-size: 12px; color: #666; text-transform: uppercase;">Failed</div>
            </div>
            <div style="text-align: center;">
              <div style="font-size: 24px; font-weight: 700; color: #86868b;">${overallProof.details.validators_skipped || 0}</div>
              <div style="font-size: 12px; color: #666; text-transform: uppercase;">Skipped</div>
            </div>
          </div>
        ` : ''}
        
        <!-- Validators Section -->
        <div style="margin-bottom: 32px;">
          <h3 style="
            margin: 0 0 16px 0;
            font-size: 18px;
            font-weight: 600;
            color: #1d1d1f;
            display: flex;
            align-items: center;
            gap: 8px;
          ">
            ✅ Validation Results
            <span style="
              background: #f0f0f0;
              color: #666;
              font-size: 12px;
              padding: 4px 10px;
              border-radius: 12px;
              font-weight: 500;
            ">${validators.length} validators</span>
          </h3>
          
          <div style="display: grid; gap: 12px;">
            ${validators.map(v => {
              const vStatus = v.status || 'unknown';
              const vIcon = vStatus === 'success' ? '✅' : vStatus === 'warning' ? '⚠️' : vStatus === 'failed' ? '❌' : '⊘';
              const vBg = vStatus === 'success' ? '#e8f5e9' : vStatus === 'warning' ? '#fff3e0' : vStatus === 'failed' ? '#ffebee' : '#f5f5f5';
              const vBorder = vStatus === 'success' ? '#4caf50' : vStatus === 'warning' ? '#ff9800' : vStatus === 'failed' ? '#f44336' : '#9e9e9e';
              
              // Get notes from details
              const notes = [];
              if (v.details) {
                if (v.details.message) notes.push(v.details.message);
                if (v.details.notes) notes.push(...(Array.isArray(v.details.notes) ? v.details.notes : [v.details.notes]));
                if (v.details.error) notes.push('Error: ' + v.details.error);
              }
              if (v.error) notes.push('Error: ' + v.error);
              
              return `
                <div style="
                  background: ${vBg};
                  border-left: 4px solid ${vBorder};
                  padding: 16px;
                  border-radius: 8px;
                ">
                  <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                      <span style="font-size: 20px;">${vIcon}</span>
                      <span style="font-weight: 600; color: #1d1d1f; font-size: 14px;">${v.validator || 'Unknown'}</span>
                    </div>
                    <div style="display: flex; gap: 8px; align-items: center;">
                      <span style="
                        background: white;
                        padding: 4px 12px;
                        border-radius: 12px;
                        font-size: 11px;
                        font-weight: 600;
                        text-transform: uppercase;
                        color: ${vBorder};
                      ">${vStatus}</span>
                      ${v.execution_time_ms ? `
                        <span style="
                          background: white;
                          padding: 4px 12px;
                          border-radius: 12px;
                          font-size: 11px;
                          font-weight: 600;
                          color: #666;
                        ">${v.execution_time_ms}ms</span>
                      ` : ''}
                    </div>
                  </div>
                  ${notes.length > 0 ? `
                    <div style="
                      font-size: 13px;
                      color: #555;
                      line-height: 1.6;
                      margin-top: 8px;
                      padding-left: 30px;
                    ">
                      ${notes.map(note => `<div style="margin: 4px 0;">• ${note}</div>`).join('')}
                    </div>
                  ` : ''}
                  ${v.checks_performed && v.checks_performed.length > 0 ? `
                    <div style="
                      font-size: 12px;
                      color: #666;
                      margin-top: 8px;
                      padding-left: 30px;
                      font-style: italic;
                    ">
                      Checks: ${v.checks_performed.join(', ')}
                    </div>
                  ` : ''}
                </div>
              `;
            }).join('')}
          </div>
        </div>
        
        <!-- Components Section -->
        ${componentProofs.length > 0 ? `
          <div>
            <h3 style="
              margin: 0 0 16px 0;
              font-size: 18px;
              font-weight: 600;
              color: #1d1d1f;
              display: flex;
              align-items: center;
              gap: 8px;
            ">
              📦 Components
              <span style="
                background: #f0f0f0;
                color: #666;
                font-size: 12px;
                padding: 4px 10px;
                border-radius: 12px;
                font-weight: 500;
              ">${componentProofs.length} total</span>
            </h3>
            
            <div style="
              display: grid;
              grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
              gap: 12px;
            ">
              ${componentProofs.map(comp => {
                const component = comp.component || {};
                const proven = comp.proven || false;
                const confidence = comp.confidence || 'unknown';
                
                return `
                  <div style="
                    background: ${proven ? '#e8f5e9' : '#ffebee'};
                    border: 1px solid ${proven ? '#4caf50' : '#f44336'};
                    padding: 14px;
                    border-radius: 8px;
                  ">
                    <div style="
                      display: flex;
                      justify-content: between;
                      align-items: start;
                      margin-bottom: 8px;
                    ">
                      <div style="
                        font-weight: 600;
                        color: #667eea;
                        font-size: 11px;
                        text-transform: uppercase;
                        letter-spacing: 0.5px;
                        flex: 1;
                      ">${component.type || 'Unknown'}</div>
                      <div style="
                        font-size: 18px;
                      ">${proven ? '✅' : '❌'}</div>
                    </div>
                    <div style="
                      font-size: 14px;
                      color: #1d1d1f;
                      font-weight: 500;
                      font-family: 'SF Mono', monospace;
                      margin-bottom: 8px;
                      word-break: break-all;
                    ">${component.name || component.api_name || 'Unknown'}</div>
                    <div style="
                      font-size: 11px;
                      color: #666;
                      text-transform: capitalize;
                    ">
                      Confidence: ${confidence}
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        ` : `
          <div style="
            text-align: center;
            padding: 40px;
            color: #86868b;
          ">
            <p style="font-size: 16px; margin: 0;">No component information available</p>
          </div>
        `}
        
        <!-- Execution Time -->
        <div style="
          margin-top: 32px;
          padding: 16px;
          background: #f9f9f9;
          border-radius: 8px;
          text-align: center;
          color: #666;
          font-size: 13px;
        ">
          ⏱️ Execution Time: ${result.execution_time || 'N/A'} • 
          Environment: ${result.environment || 'N/A'}
        </div>
      </div>
      
      <!-- Footer -->
      <div style="
        background: #f9f9f9;
        padding: 16px 32px;
        border-top: 1px solid #e5e5e7;
        display: flex;
        justify-content: flex-end;
        gap: 12px;
      ">
        <button onclick="document.getElementById('story-details-modal').remove()" style="
          background: white;
          border: 1px solid #d2d2d7;
          color: #1d1d1f;
          padding: 10px 24px;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        " onmouseover="this.style.background='#f5f5f7'" onmouseout="this.style.background='white'">Close</button>
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
  
  // Close on background click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });
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

const injectCss = (() => {
  let done = false;
  return () => {
    if (done) return;
    done = true;

    const css = `
      /* Production Validator Styles - Matching Precheck Design */
      
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
        border-radius: 12px;
        box-shadow: 0 4px 16px rgba(102, 126, 234, 0.2);
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
        border-radius: 12px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
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
        border-radius: 8px;
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
        border-radius: 8px;
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
        border-radius: 12px;
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
        border-radius: 12px;
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

      .release-header-card {
        display: flex;
        align-items: center;
        gap: 20px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 24px;
        border-radius: 12px;
        margin-bottom: 24px;
        box-shadow: 0 4px 16px rgba(102, 126, 234, 0.2);
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

      .result-summary-card {
        display: flex;
        align-items: center;
        gap: 24px;
        background: white;
        border: 1px solid #e5e5e7;
        padding: 24px;
        border-radius: 12px;
        margin-bottom: 24px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
      }

      .status-badge-large {
        padding: 12px 24px;
        border-radius: 8px;
        font-size: 16px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .status-proven {
        background: linear-gradient(135deg, #10b981 0%, #059669 100%);
        color: white;
      }

      .status-unproven {
        background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
        color: white;
      }

      .status-failed {
        background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
        color: white;
      }

      .story-info h3 {
        margin: 0 0 8px 0;
        font-size: 20px;
        font-weight: 600;
        color: #1d1d1f;
      }

      .story-meta {
        display: flex;
        gap: 16px;
        flex-wrap: wrap;
        margin: 0;
        font-size: 13px;
        color: #86868b;
      }

      .meta-item {
        display: flex;
        align-items: center;
        gap: 4px;
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
        border-radius: 12px;
        text-align: center;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
        transition: transform 0.2s ease;
      }

      .stat-card:hover {
        transform: translateY(-4px);
        box-shadow: 0 6px 20px rgba(0, 0, 0, 0.1);
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
        border-radius: 12px;
        margin-bottom: 24px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
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

      /* Validators Section */
      .validators-section {
        margin-bottom: 32px;
      }

      .validators-section h4 {
        font-size: 18px;
        font-weight: 600;
        color: #1d1d1f;
        margin: 0 0 16px 0;
      }

      .validators-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: 16px;
      }

      .validator-card {
        background: white;
        border: 1px solid #e5e5e7;
        padding: 16px;
        border-radius: 8px;
        transition: transform 0.2s ease;
      }

      .validator-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      }

      .validator-header {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 12px;
      }

      .validator-icon {
        font-size: 24px;
        font-weight: bold;
      }

      .validator-info {
        flex: 1;
      }

      .validator-info h5 {
        margin: 0 0 4px 0;
        font-size: 14px;
        font-weight: 600;
        color: #1d1d1f;
      }

      .validator-status {
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
        padding: 2px 8px;
        border-radius: 4px;
      }

      .validator-status.status-success {
        background: #e8f5e9;
        color: #1b5e20;
      }

      .validator-status.status-warning {
        background: #fff3e0;
        color: #e65100;
      }

      .validator-status.status-failed {
        background: #ffebee;
        color: #b71c1c;
      }

      .validator-status.status-skipped {
        background: #f5f5f7;
        color: #86868b;
      }

      .validator-notes {
        margin-top: 12px;
        padding-top: 12px;
        border-top: 1px solid #f5f5f7;
      }

      .validator-notes .note {
        font-size: 12px;
        color: #555;
        margin: 4px 0;
        line-height: 1.5;
      }

      /* Components Section */
      .components-section h4 {
        font-size: 18px;
        font-weight: 600;
        color: #1d1d1f;
        margin: 0 0 16px 0;
      }

      .components-list {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      .component-item {
        display: flex;
        align-items: center;
        gap: 8px;
        background: white;
        border: 1px solid #e5e5e7;
        padding: 8px 12px;
        border-radius: 6px;
        font-size: 13px;
      }

      .component-type {
        font-weight: 600;
        color: #667eea;
      }

      .component-name {
        color: #1d1d1f;
        font-family: 'SF Mono', monospace;
      }

      /* Bulk Results */
      .results-list-section h4 {
        font-size: 18px;
        font-weight: 600;
        color: #1d1d1f;
        margin: 32px 0 16px 0;
      }

      .bulk-result-card {
        background: white;
        border: 1px solid #e5e5e7;
        padding: 16px;
        border-radius: 8px;
        margin-bottom: 12px;
        transition: all 0.2s ease;
      }

      .bulk-result-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      }

      .bulk-result-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
      }

      .bulk-result-header h5 {
        margin: 0;
        font-size: 16px;
        font-weight: 600;
        color: #1d1d1f;
      }

      .bulk-result-header .status-badge {
        padding: 4px 12px;
        border-radius: 4px;
        font-size: 12px;
        font-weight: 600;
        color: white;
      }

      .story-details {
        margin-bottom: 12px;
        padding-bottom: 12px;
        border-bottom: 1px solid #f5f5f7;
      }

      .story-meta {
        display: flex;
        gap: 12px;
        flex-wrap: wrap;
        margin: 0 0 8px 0;
        font-size: 12px;
        color: #86868b;
      }

      .story-metrics {
        margin: 0;
        font-size: 13px;
        color: #1d1d1f;
      }

      .validator-summary {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }

      .validator-mini {
        font-size: 11px;
        padding: 4px 8px;
        border-radius: 4px;
        font-weight: 500;
      }

      .validator-mini.status-success {
        background: #e8f5e9;
        color: #1b5e20;
      }

      .validator-mini.status-warning {
        background: #fff3e0;
        color: #e65100;
      }

      .validator-mini.status-failed {
        background: #ffebee;
        color: #b71c1c;
      }

      /* Responsive */
      @media (max-width: 768px) {
        .validator-input-section {
          grid-template-columns: 1fr;
        }

        .validators-grid {
          grid-template-columns: 1fr;
        }

        .stats-grid {
          grid-template-columns: repeat(2, 1fr);
        }
      }
    `;

    document.head.appendChild(Object.assign(document.createElement('style'), { textContent: css }));
  };
})();