// ============================================================================
// HISTORY UI - Display Functions
// src/ui/tabs/development-tools/history/ui.js
// ============================================================================

import { TOOL_ICONS, ENVIRONMENTS, LIMITS } from '../constants.js';
import { formatDate } from '../utils.js';

/**
 * Show history form with component and environment selection
 */
export function showHistoryForm(components = []) {
  const modal = document.createElement('div');
  modal.id = 'history-form-modal';
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
    z-index: 1000;
    overflow-y: auto;
    padding: var(--spacing-lg) 0;
  `;

  modal.innerHTML = `
    <div style="
      background: var(--color-white);
      border-radius: 12px;
      padding: var(--spacing-3xl);
      max-width: 700px;
      width: 90%;
      box-shadow: var(--shadow-lg);
      animation: slideInUp 0.3s ease;
      margin: auto;
    ">
      <div style="margin-bottom: var(--spacing-2xl);">
        <h3 style="
          margin: 0;
          font-size: 18px;
          font-weight: 600;
          color: var(--color-black);
        ">${TOOL_ICONS.HISTORY} Component History</h3>
        <p style="
          margin: var(--spacing-md) 0 0;
          font-size: 12px;
          color: var(--color-gray-6);
        ">View component changes and deployment history</p>
      </div>

      <form id="history-form" style="display: flex; flex-direction: column; gap: var(--spacing-lg);">
        
        <!-- Component Selection -->
        <div>
          <label style="
            display: block;
            margin-bottom: var(--spacing-sm);
            font-size: 13px;
            font-weight: 600;
            color: var(--color-black);
          ">Component Type</label>
          <select id="history-component-type" style="
            width: 100%;
            padding: var(--spacing-md);
            border: 1px solid var(--color-gray-3);
            border-radius: 6px;
            font-size: 13px;
            background: var(--color-white);
            cursor: pointer;
          ">
            <option value="">-- Select Component Type --</option>
            <option value="DataRaptor">📊 DataRaptor</option>
            <option value="IntegrationProcedure">🔗 Integration Procedure</option>
            <option value="FlexCard">🎴 Flex Card</option>
            <option value="OmniScript">📝 OmniScript</option>
            <option value="Action">⚡ Action</option>
            <option value="Decision">🎯 Decision</option>
          </select>
        </div>

        <!-- Component Name -->
        <div>
          <label style="
            display: block;
            margin-bottom: var(--spacing-sm);
            font-size: 13px;
            font-weight: 600;
            color: var(--color-black);
          ">Component Name</label>
          <input 
            id="history-component-name"
            type="text" 
            placeholder="Enter component name" 
            style="
              width: 100%;
              padding: var(--spacing-md);
              border: 1px solid var(--color-gray-3);
              border-radius: 6px;
              font-size: 13px;
              box-sizing: border-box;
            "
          />
        </div>

        <!-- Environment Selection -->
        <div>
          <label style="
            display: block;
            margin-bottom: var(--spacing-sm);
            font-size: 13px;
            font-weight: 600;
            color: var(--color-black);
          ">Environment</label>
          <select id="history-environment" style="
            width: 100%;
            padding: var(--spacing-md);
            border: 1px solid var(--color-gray-3);
            border-radius: 6px;
            font-size: 13px;
            background: var(--color-white);
            cursor: pointer;
          ">
            <option value="">-- All Environments --</option>
            <option value="uat">🔧 UAT (uatsfdc)</option>
            <option value="qasales">🧪 QA (qasales)</option>
            <option value="prep">🟡 PreProd (prep)</option>
            <option value="master">🚀 Production (master)</option>
          </select>
        </div>

        <!-- Commit Limit -->
        <div>
          <label style="
            display: block;
            margin-bottom: var(--spacing-sm);
            font-size: 13px;
            font-weight: 600;
            color: var(--color-black);
          ">Number of Commits</label>
          <input 
            id="history-commit-limit"
            type="number" 
            min="1" 
            max="50" 
            value="5"
            style="
              width: 100%;
              padding: var(--spacing-md);
              border: 1px solid var(--color-gray-3);
              border-radius: 6px;
              font-size: 13px;
              box-sizing: border-box;
            "
          />
          <p style="
            margin: var(--spacing-sm) 0 0;
            font-size: 11px;
            color: var(--color-gray-6);
          ">Show up to 50 recent commits</p>
        </div>

        <!-- Action Buttons -->
        <div style="
          display: flex;
          gap: var(--spacing-md);
          justify-content: flex-end;
          margin-top: var(--spacing-lg);
          padding-top: var(--spacing-lg);
          border-top: 1px solid var(--color-gray-3);
        ">
          <button
            type="button"
            onclick="window.closeModal('history-form-modal')"
            style="
              padding: 10px 20px;
              background: var(--color-gray-2);
              color: var(--color-black);
              border: 1px solid var(--color-gray-3);
              border-radius: 6px;
              font-size: 13px;
              font-weight: 500;
              cursor: pointer;
              transition: all 0.3s ease;
            "
            onmouseover="this.style.background='var(--color-gray-3)'"
            onmouseout="this.style.background='var(--color-gray-2)'"
          >Cancel</button>

          <button
            type="button"
            onclick="window.fetchComponentHistory()"
            style="
              padding: 10px 20px;
              background: var(--color-blue);
              color: var(--color-white);
              border: none;
              border-radius: 6px;
              font-size: 13px;
              font-weight: 600;
              cursor: pointer;
              transition: all 0.3s ease;
            "
            onmouseover="this.style.opacity='0.8'"
            onmouseout="this.style.opacity='1'"
          >${TOOL_ICONS.HISTORY} View History</button>
        </div>
      </form>

      <style>
        @keyframes slideInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      </style>
    </div>
  `;

  document.body.appendChild(modal);
}

/**
 * Show history spinner with message
 */
export function showHistorySpinner(container, message) {
  container.innerHTML = `
    <div style="
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: var(--spacing-4xl);
      text-align: center;
    ">
      <div style="
        font-size: 48px;
        animation: spin 1s linear infinite;
        margin-bottom: var(--spacing-lg);
      ">⟳</div>
      <p style="
        margin: 0;
        font-size: 14px;
        font-weight: 500;
        color: var(--color-black);
      ">${message}</p>
      <p style="
        margin: var(--spacing-md) 0 0;
        font-size: 12px;
        color: var(--color-gray-6);
      ">This may take a few moments...</p>
      <style>
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      </style>
    </div>
  `;
}

/**
 * Display history results
 */
export function displayHistoryResults(container, data) {
  if (!data || !data.commits || data.commits.length === 0) {
    container.innerHTML = `
      <div style="
        background: var(--color-white);
        border-radius: 8px;
        padding: var(--spacing-3xl);
        text-align: center;
      ">
        <p style="
          margin: 0;
          font-size: 14px;
          color: var(--color-gray-6);
        ">No history found for this component.</p>
      </div>
    `;
    return;
  }

  const { component, branch, commits } = data;

  let html = `
    <div style="
      background: var(--color-white);
      border-radius: 8px;
      padding: var(--spacing-lg);
    ">
      <!-- Header -->
      <div style="
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: var(--spacing-lg);
        padding-bottom: var(--spacing-lg);
        border-bottom: 1px solid var(--color-gray-3);
      ">
        <div>
          <h3 style="
            margin: 0;
            font-size: 16px;
            font-weight: 600;
            color: var(--color-black);
          ">${TOOL_ICONS.HISTORY} History for ${component.type} / ${component.name}</h3>
          <p style="
            margin: var(--spacing-sm) 0 0;
            font-size: 12px;
            color: var(--color-gray-6);
          ">Branch: <strong>${branch}</strong></p>
        </div>
        <div style="
          text-align: right;
          font-size: 12px;
          color: var(--color-gray-6);
        ">
          <p style="margin: 0;">Total: <strong>${commits.length}</strong> commits</p>
        </div>
      </div>

      <!-- Commits Timeline -->
      <div style="
        position: relative;
        padding-left: var(--spacing-lg);
      ">
        ${commits.map((commit, index) => `
          <div style="
            position: relative;
            margin-bottom: var(--spacing-lg);
            padding-bottom: var(--spacing-lg);
            ${index !== commits.length - 1 ? 'border-bottom: 1px solid var(--color-gray-2);' : ''}
          ">
            <!-- Timeline dot -->
            <div style="
              position: absolute;
              left: -24px;
              top: 0;
              width: 12px;
              height: 12px;
              background: var(--color-blue);
              border: 3px solid var(--color-white);
              border-radius: 50%;
              box-shadow: 0 0 0 1px var(--color-gray-3);
            "></div>

            <!-- Commit Card -->
            <div style="
              background: var(--color-gray-1);
              border-left: 3px solid var(--color-blue);
              border-radius: 6px;
              padding: var(--spacing-md);
            ">
              <div style="
                display: flex;
                justify-content: space-between;
                align-items: start;
                margin-bottom: var(--spacing-sm);
              ">
                <div>
                  <p style="
                    margin: 0;
                    font-size: 13px;
                    font-weight: 600;
                    color: var(--color-black);
                  ">${commit.message || 'No message'}</p>
                  <p style="
                    margin: var(--spacing-xs) 0 0;
                    font-size: 12px;
                    color: var(--color-gray-6);
                  ">Commit: <code style="
                    background: var(--color-white);
                    padding: 2px 6px;
                    border-radius: 3px;
                    font-family: monospace;
                  ">${commit.hash ? commit.hash.substring(0, 7) : 'N/A'}</code></p>
                </div>
                <span style="
                  font-size: 11px;
                  color: var(--color-gray-6);
                  white-space: nowrap;
                  margin-left: var(--spacing-md);
                ">${timeAgo(commit.timestamp)}</span>
              </div>

              <div style="
                display: flex;
                gap: var(--spacing-lg);
                margin-top: var(--spacing-md);
                font-size: 12px;
              ">
                <div>
                  <span style="color: var(--color-gray-6);">Author:</span>
                  <span style="
                    color: var(--color-black);
                    font-weight: 500;
                  ">${commit.author || 'Unknown'}</span>
                </div>
                <div>
                  <span style="color: var(--color-gray-6);">Date:</span>
                  <span style="
                    color: var(--color-black);
                    font-weight: 500;
                  ">${formatDateShort(commit.timestamp)}</span>
                </div>
              </div>

              ${commit.changes ? `
                <div style="
                  margin-top: var(--spacing-md);
                  padding-top: var(--spacing-md);
                  border-top: 1px solid var(--color-gray-3);
                ">
                  <p style="
                    margin: 0 0 var(--spacing-sm);
                    font-size: 12px;
                    color: var(--color-gray-6);
                    font-weight: 600;
                  ">Changes:</p>
                  <ul style="
                    margin: 0;
                    padding-left: var(--spacing-lg);
                    font-size: 11px;
                    color: var(--color-gray-6);
                  ">
                    ${commit.changes.map(change => `
                      <li style="margin-bottom: 4px;">
                        <span style="color: var(--color-blue);">${change.type}:</span> ${change.field}
                      </li>
                    `).join('')}
                  </ul>
                </div>
              ` : ''}
            </div>
          </div>
        `).join('')}
      </div>

      <!-- Action Buttons -->
      <div style="
        display: flex;
        gap: var(--spacing-md);
        margin-top: var(--spacing-lg);
        padding-top: var(--spacing-lg);
        border-top: 1px solid var(--color-gray-3);
      ">
        <button
          onclick="window.showHistoryPrompt()"
          style="
            flex: 1;
            padding: var(--spacing-md);
            background: var(--color-gray-2);
            color: var(--color-black);
            border: 1px solid var(--color-gray-3);
            border-radius: 6px;
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
          "
          onmouseover="this.style.background='var(--color-gray-3)'"
          onmouseout="this.style.background='var(--color-gray-2)'"
        >← Back</button>

        <button
          onclick="window.exportHistoryData('${JSON.stringify(data).replace(/'/g, '&#39;')}')"
          style="
            flex: 1;
            padding: var(--spacing-md);
            background: var(--color-blue);
            color: var(--color-white);
            border: none;
            border-radius: 6px;
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
          "
          onmouseover="this.style.opacity='0.8'"
          onmouseout="this.style.opacity='1'"
        >↓ Export</button>
      </div>
    </div>
  `;

  container.innerHTML = html;
}

/**
 * Helper: Format date short
 */
function formatDateShort(dateString) {
  if (!dateString) return 'N/A';
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch {
    return dateString;
  }
}

/**
 * Display error message
 */
export function displayHistoryError(container, error) {
  container.innerHTML = `
    <div style="
      background: #FFF0F0;
      border: 1px solid #D63031;
      border-radius: 8px;
      padding: var(--spacing-lg);
    ">
      <div style="
        display: flex;
        gap: var(--spacing-md);
        align-items: flex-start;
      ">
        <div style="
          font-size: 20px;
          color: #D63031;
        ">⚠️</div>
        <div>
          <h4 style="
            margin: 0;
            font-size: 14px;
            font-weight: 600;
            color: #D63031;
          ">Error Fetching History</h4>
          <p style="
            margin: var(--spacing-sm) 0 0;
            font-size: 13px;
            color: var(--color-gray-6);
          ">${error}</p>
          <button
            onclick="window.showHistoryPrompt()"
            style="
              margin-top: var(--spacing-md);
              padding: 8px 16px;
              background: #D63031;
              color: white;
              border: none;
              border-radius: 6px;
              font-size: 12px;
              font-weight: 600;
              cursor: pointer;
            "
          >Try Again</button>
        </div>
      </div>
    </div>
  `;
}