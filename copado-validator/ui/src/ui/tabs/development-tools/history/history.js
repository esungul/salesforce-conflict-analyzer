// src/ui/tabs/development-tools/history/history.js
// Production-ready History Tool
// Uses /api/component-history endpoint

import { getComponentHistory } from '../../../../api/endpoints.js';


/**
 * Run History Tool
 * Shows commit history for components
 * Does NOT require prior analysis
 */
export async function runHistory(components, limit = 20) {
  console.log('📜 History tool triggered');

  try {
    // ===== STEP 1: Get components to check =====
    let componentsToCheck = components;

    // If no components passed, get from user input
    if (!componentsToCheck || componentsToCheck.length === 0) {
      componentsToCheck = await promptForComponents();
    }

    // If still no components, show error
    if (!componentsToCheck || componentsToCheck.length === 0) {
      const errorModal = createErrorModal(
        'No Components',
        'Please provide components to view history',
        '📦'
      );
      document.body.appendChild(errorModal);
      return;
    }

    console.log('✅ Found', componentsToCheck.length, 'components');

    // ===== STEP 2: Show loading =====
    const loadingModal = createLoadingModal('Fetching component history...');
    document.body.appendChild(loadingModal);

    // ===== STEP 3: Call API =====
    console.log('📡 Calling /api/component-history...');
    const result = await getComponentHistory({
      components: componentsToCheck,
      limit: limit
    });

    console.log('✅ API Response:', result);

    // ===== STEP 4: Hide loading =====
    loadingModal.remove();

    // ===== STEP 5: Show results =====
    const resultModal = createHistoryResultModal(result, componentsToCheck);
    document.body.appendChild(resultModal);

    console.log('✅ History displayed');

  } catch (error) {
    console.error('❌ History error:', error);

    // Remove loading modal
    document.querySelectorAll('[id^="loading-modal"]').forEach(m => m.remove());

    // Show error modal
    const errorModal = createErrorModal(
      'History Error',
      error.message || 'An error occurred while fetching history',
      '⚠️'
    );
    document.body.appendChild(errorModal);
  }
}

/**
 * Prompt user for components
 */
async function promptForComponents() {
  return new Promise((resolve) => {
    const modal = document.createElement('div');
    const modalId = 'component-input-modal-' + Date.now();
    modal.id = modalId;

    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      backdrop-filter: blur(4px);
    `;

    modal.innerHTML = `
      <div style="
        background: white;
        border-radius: 18px;
        padding: 40px;
        max-width: 500px;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        animation: slideUp 0.3s ease-out;
      ">
        <div style="font-size: 60px; margin-bottom: 20px;">📜</div>
        <h2 style="
          font-size: 22px;
          font-weight: 600;
          margin: 0 0 12px 0;
          color: #1d1d1f;
        ">
          View Component History
        </h2>
        <p style="
          font-size: 15px;
          color: #666666;
          margin: 0 0 24px 0;
          line-height: 1.5;
        ">
          Enter component names separated by commas
        </p>
        <textarea id="componentInput" placeholder="e.g., Button, Header, Layout" style="
          width: 100%;
          padding: 12px;
          border: 1px solid #d2d2d7;
          border-radius: 8px;
          font-size: 14px;
          font-family: -apple-system, BlinkMacSystemFont, sans-serif;
          resize: vertical;
          min-height: 100px;
          box-sizing: border-box;
        "></textarea>
        <div style="
          display: flex;
          gap: 12px;
          margin-top: 24px;
        ">
          <button onclick="document.getElementById('${modalId}').remove()" style="
            flex: 1;
            padding: 12px 16px;
            border: 1px solid #d2d2d7;
            background: #f5f5f7;
            border-radius: 8px;
            font-size: 15px;
            font-weight: 600;
            color: #0071e3;
            cursor: pointer;
            transition: all 0.2s;
          " onmouseover="this.style.background='#e8e8ed'" onmouseout="this.style.background='#f5f5f7'">
            Cancel
          </button>
          <button onclick="
            const input = document.getElementById('componentInput');
            const components = input.value.split(',').map(c => c.trim()).filter(c => c);
            document.getElementById('${modalId}').remove();
          " style="
            flex: 1;
            padding: 12px 16px;
            border: none;
            background: #0071e3;
            border-radius: 8px;
            font-size: 15px;
            font-weight: 600;
            color: white;
            cursor: pointer;
            transition: all 0.2s;
          " onmouseover="this.style.background='#0077ed'" onmouseout="this.style.background='#0071e3'">
            View History
          </button>
        </div>
      </div>

      <style>
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      </style>
    `;

    document.body.appendChild(modal);

    const validateBtn = modal.querySelector('button:last-child');
    validateBtn.onclick = function() {
      const input = modal.querySelector('textarea');
      const components = input.value.split(',').map(c => c.trim()).filter(c => c);
      modal.remove();
      resolve(components);
    };
  });
}

/**
 * Create loading modal
 */
function createLoadingModal(message = 'Loading...') {
  const modal = document.createElement('div');
  const modalId = 'loading-modal-' + Date.now();
  modal.id = modalId;

  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.3);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    backdrop-filter: blur(2px);
  `;

  modal.innerHTML = `
    <div style="
      background: white;
      border-radius: 18px;
      padding: 40px;
      text-align: center;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      animation: slideUp 0.3s ease-out;
    ">
      <div style="
        width: 40px;
        height: 40px;
        margin: 0 auto 16px;
        border: 3px solid #e5e5e7;
        border-top-color: #0071e3;
        border-radius: 50%;
        animation: spin 1s linear infinite;
      "></div>
      <p style="
        font-size: 15px;
        color: #666666;
        margin: 0;
        font-weight: 500;
      ">
        ${message}
      </p>
    </div>

    <style>
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
      @keyframes slideUp {
        from {
          opacity: 0;
          transform: translateY(20px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
    </style>
  `;

  return modal;
}

/**
 * Create error modal
 */
function createErrorModal(title, message, icon = '⚠️') {
  const modal = document.createElement('div');
  const modalId = 'error-modal-' + Date.now();
  modal.id = modalId;

  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    backdrop-filter: blur(4px);
  `;

  modal.innerHTML = `
    <div style="
      background: white;
      border-radius: 18px;
      padding: 40px;
      max-width: 400px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      text-align: center;
      animation: slideUp 0.3s ease-out;
    ">
      <div style="font-size: 60px; margin-bottom: 20px;">${icon}</div>
      <h2 style="
        font-size: 22px;
        font-weight: 600;
        margin: 0 0 12px 0;
        color: #1d1d1f;
      ">
        ${title}
      </h2>
      <p style="
        font-size: 15px;
        color: #666666;
        margin: 0 0 24px 0;
        line-height: 1.5;
      ">
        ${message}
      </p>
      <button onclick="document.getElementById('${modalId}').remove()" style="
        width: 100%;
        padding: 12px 16px;
        border: none;
        background: #0071e3;
        border-radius: 8px;
        font-size: 15px;
        font-weight: 600;
        color: white;
        cursor: pointer;
        transition: all 0.2s;
      " onmouseover="this.style.background='#0077ed'" onmouseout="this.style.background='#0071e3'">
        Dismiss
      </button>
    </div>

    <style>
      @keyframes slideUp {
        from {
          opacity: 0;
          transform: translateY(20px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
    </style>
  `;

  return modal;
}

/**
 * Create and display history results modal
 */
function createHistoryResultModal(result, components) {
  const modal = document.createElement('div');
  const modalId = 'history-result-' + Date.now();
  modal.id = modalId;

  const { commits = [] } = result;
  const totalCommits = commits.length;

  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    overflow-y: auto;
    backdrop-filter: blur(4px);
  `;

  modal.innerHTML = `
    <div style="
      background: white;
      border-radius: 18px;
      padding: 40px;
      max-width: 600px;
      width: 90%;
      margin: 20px auto;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      animation: slideUp 0.3s ease-out;
    ">
      <!-- Header -->
      <div style="text-align: center; margin-bottom: 32px;">
        <div style="font-size: 60px; margin-bottom: 16px;">📜</div>
        <h2 style="
          font-size: 24px;
          font-weight: 600;
          margin: 0 0 8px 0;
          color: #1d1d1f;
        ">
          Component History
        </h2>
        <p style="
          font-size: 16px;
          color: #666666;
          margin: 0;
        ">
          ${components.join(', ')}
        </p>
      </div>

      <!-- Summary -->
      <div style="
        background: #f5f5f7;
        padding: 16px;
        border-radius: 12px;
        margin-bottom: 32px;
        text-align: center;
      ">
        <div style="
          font-size: 28px;
          font-weight: 600;
          color: #0071e3;
          margin-bottom: 4px;
        ">
          ${totalCommits}
        </div>
        <div style="
          font-size: 13px;
          color: #666666;
        ">
          Total Commits
        </div>
      </div>

      <!-- Commits Timeline -->
      <div style="margin-bottom: 32px;">
        <h3 style="
          font-size: 16px;
          font-weight: 600;
          margin: 0 0 16px 0;
          color: #1d1d1f;
        ">
          Commit Timeline
        </h3>
        <div style="
          max-height: 400px;
          overflow-y: auto;
          border: 1px solid #e5e5e7;
          border-radius: 12px;
        ">
          ${commits.length > 0 ? commits.map((commit, idx) => `
            <div style="
              padding: 16px;
              border-bottom: ${idx < commits.length - 1 ? '1px solid #e5e5e7' : 'none'};
              display: flex;
              gap: 12px;
            ">
              <!-- Timeline dot -->
              <div style="
                width: 12px;
                height: 12px;
                background: #0071e3;
                border-radius: 50%;
                margin-top: 4px;
                flex-shrink: 0;
              "></div>
              
              <!-- Commit info -->
              <div style="flex-grow: 1;">
                <div style="
                  font-size: 14px;
                  font-weight: 600;
                  color: #1d1d1f;
                  margin-bottom: 4px;
                ">
                  ${commit.message || 'No message'}
                </div>
                <div style="
                  font-size: 12px;
                  color: #666666;
                  margin-bottom: 4px;
                ">
                  ${commit.author || 'Unknown'} ${commit.date ? '· ' + formatDate(commit.date) : ''}
                </div>
                ${commit.sha ? `
                  <div style="
                    font-size: 11px;
                    color: #999999;
                    font-family: monospace;
                  ">
                    ${commit.sha.substring(0, 7)}
                  </div>
                ` : ''}
              </div>
            </div>
          `).join('') : `
            <div style="
              padding: 32px;
              text-align: center;
              color: #666666;
            ">
              No commits found
            </div>
          `}
        </div>
      </div>

      <!-- Close Button -->
      <button onclick="document.getElementById('${modalId}').remove()" style="
        width: 100%;
        padding: 12px 16px;
        border: none;
        background: #0071e3;
        border-radius: 8px;
        font-size: 15px;
        font-weight: 600;
        color: white;
        cursor: pointer;
        transition: all 0.2s;
      " onmouseover="this.style.background='#0077ed'" onmouseout="this.style.background='#0071e3'">
        Close
      </button>
    </div>

    <style>
      @keyframes slideUp {
        from {
          opacity: 0;
          transform: translateY(20px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
    </style>
  `;

  return modal;
}

/**
 * Format date nicely
 */
function formatDate(date) {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default { runHistory };