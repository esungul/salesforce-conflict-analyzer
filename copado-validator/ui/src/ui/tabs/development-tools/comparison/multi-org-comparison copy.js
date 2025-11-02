// src/ui/tabs/development-tools/multi-org-comparison.js
// Multi-Org Component Comparison Tool - COMPLETE CORRECT VERSION

import { compareOrgs } from '../../../../api/endpoints.js';
import COMPONENT_CONFIG from '../../../../config/component-config.js';
import * as Diff from 'https://esm.sh/diff@5.1.0'; // Import jsdiff for proper diffing

/**
 * Create a simple loading modal
 */
function createLoadingModal(message) {
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
      min-width: 300px;
    ">
      <div style="
        width: 50px;
        height: 50px;
        margin: 0 auto 20px;
        border: 4px solid #e5e5e7;
        border-top-color: #0071e3;
        border-radius: 50%;
        animation: spin 1s linear infinite;
      "></div>
      <h3 style="font-size: 18px; font-weight: 600; margin: 0 0 16px 0; color: #1d1d1f;">
        ${message}
      </h3>
    </div>
    <style>
      @keyframes spin { to { transform: rotate(360deg); } }
      @keyframes slideUp {
        from { opacity: 0; transform: translateY(20px); }
        to { opacity: 1; transform: translateY(0); }
      }
    </style>
  `;

  return modal;
}

/**
 * Show UI to add components with types
 */
async function showComponentInputUI() {
  return new Promise((resolve) => {
    const modal = document.createElement('div');
    const modalId = 'comparison-components-modal-' + Date.now();
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
      overflow-y: auto;
    `;

    const componentTypes = COMPONENT_CONFIG.getTypesArray();
    let componentsList = [];

    const addComponentRow = function() {
      const rowId = 'comp-row-' + Date.now();
      const newRow = document.createElement('div');
      newRow.id = rowId;
      newRow.style.cssText = `
        display: grid;
        grid-template-columns: 1fr 1fr auto;
        gap: 8px;
        margin-bottom: 12px;
        padding: 12px;
        background: #f5f5f7;
        border-radius: 8px;
        align-items: center;
      `;

      newRow.innerHTML = `
        <div>
          <input type="text" placeholder="Component name" class="comp-name" style="
            width: 100%;
            padding: 8px;
            border: 1px solid #d2d2d7;
            border-radius: 6px;
            font-size: 13px;
            box-sizing: border-box;
          ">
        </div>
        <div>
          <select class="comp-type" style="
            width: 100%;
            padding: 8px;
            border: 1px solid #d2d2d7;
            border-radius: 6px;
            font-size: 13px;
            box-sizing: border-box;
          ">
            ${componentTypes.map(type => `
              <option value="${type.id}">
                ${type.icon} ${type.label}
              </option>
            `).join('')}
          </select>
        </div>
        <button class="remove-row" style="
          padding: 8px 12px;
          background: #ffebee;
          color: #d32f2f;
          border: 1px solid #d32f2f;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          white-space: nowrap;
        ">
          Remove
        </button>
      `;

      newRow.querySelector('.remove-row').addEventListener('click', function() {
        newRow.remove();
        componentsList = componentsList.filter(id => id !== rowId);
      });

      modal.querySelector('#components-container').appendChild(newRow);
      componentsList.push(rowId);
    };

    const submitHandler = function() {
      const rows = modal.querySelectorAll('[id^="comp-row-"]');
      const components = Array.from(rows).map(row => {
        const name = row.querySelector('.comp-name').value.trim();
        const typeId = row.querySelector('.comp-type').value;
        const typeObj = COMPONENT_CONFIG.getType(typeId);

        if (!name) return null;

        return {
          name: name,
          type: typeObj.apiValue
        };
      }).filter(c => c !== null);

      if (components.length === 0) {
        alert('Please add at least one component');
        return;
      }

      console.log('User added components:', components);
      modal.remove();
      resolve(components);
    };

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
        <div style="font-size: 60px; margin-bottom: 20px;">⇄</div>
        <h2 style="
          font-size: 22px;
          font-weight: 600;
          margin: 0 0 12px 0;
          color: #1d1d1f;
        ">
          Add Components for Comparison
        </h2>
        <p style="
          font-size: 14px;
          color: #666666;
          margin: 0 0 24px 0;
        ">
          Add one or more components with their types
        </p>

        <div id="components-container" style="margin-bottom: 20px;"></div>

        <div style="display: flex; gap: 12px;">
          <button id="add-component-btn" style="
            flex: 1;
            padding: 10px 16px;
            background: #0071e3;
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
          ">
            + Add Component
          </button>
          <button id="done-btn" style="
            flex: 1;
            padding: 10px 16px;
            background: #34c759;
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
          ">
            Done
          </button>
          <button id="cancel-btn" style="
            padding: 10px 16px;
            background: #8e8e93;
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
          ">
            Cancel
          </button>
        </div>
      </div>

      <style>
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      </style>
    `;

    document.body.appendChild(modal);

    // Add first row by default
    addComponentRow();

    // Attach event listeners
    modal.querySelector('#add-component-btn').addEventListener('click', addComponentRow);
    modal.querySelector('#done-btn').addEventListener('click', submitHandler);
    modal.querySelector('#cancel-btn').addEventListener('click', function() {
      modal.remove();
      resolve(null);
    });
  });
}

/**
 * Show UI to select environments
 */
async function showEnvironmentSelectionUI(availableEnvironments) {
  return new Promise((resolve) => {
    const modal = document.createElement('div');
    const modalId = 'environment-selection-modal-' + Date.now();
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

    let selectedEnvs = [];

    const submitHandler = function() {
      if (selectedEnvs.length !== 2) {
        alert('Please select exactly 2 environments');
        return;
      }

      console.log('User selected environments:', selectedEnvs);
      modal.remove();
      resolve({
        orgA: selectedEnvs[0],
        orgB: selectedEnvs[1]
      });
    };

    modal.innerHTML = `
      <div style="
        background: white;
        border-radius: 18px;
        padding: 40px;
        max-width: 500px;
        width: 90%;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        animation: slideUp 0.3s ease-out;
      ">
        <div style="font-size: 60px; margin-bottom: 20px;">🌍</div>
        <h2 style="
          font-size: 22px;
          font-weight: 600;
          margin: 0 0 12px 0;
          color: #1d1d1f;
        ">
          Select Environments
        </h2>
        <p style="
          font-size: 14px;
          color: #666666;
          margin: 0 0 24px 0;
        ">
          Select exactly 2 environments to compare
        </p>

        <div id="env-list" style="
          display: grid;
          gap: 12px;
          margin-bottom: 24px;
          max-height: 300px;
          overflow-y: auto;
        ">
          ${availableEnvironments.map(env => `
            <label style="
              display: flex;
              align-items: center;
              padding: 12px;
              background: #f5f5f7;
              border-radius: 8px;
              cursor: pointer;
              transition: all 0.2s;
            " class="env-option">
              <input type="checkbox" value="${env}" style="
                width: 18px;
                height: 18px;
                margin-right: 12px;
                cursor: pointer;
              " class="env-checkbox">
              <span style="font-size: 14px; font-weight: 500;">${env}</span>
            </label>
          `).join('')}
        </div>

        <div style="display: flex; gap: 12px;">
          <button id="confirm-btn" style="
            flex: 1;
            padding: 12px 16px;
            background: #0071e3;
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
          ">
            Compare
          </button>
          <button id="cancel-btn" style="
            padding: 12px 16px;
            background: #8e8e93;
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
          ">
            Cancel
          </button>
        </div>

        <div id="error-msg" style="
          margin-top: 12px;
          padding: 8px 12px;
          background: #ffebee;
          color: #d32f2f;
          border-radius: 6px;
          font-size: 13px;
          display: none;
        "></div>
      </div>

      <style>
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .env-option:hover {
          background: #e5e5e7 !important;
        }
      </style>
    `;

    document.body.appendChild(modal);

    const checkboxes = modal.querySelectorAll('.env-checkbox');
    const errorMsg = modal.querySelector('#error-msg');

    checkboxes.forEach(checkbox => {
      checkbox.addEventListener('change', function() {
        selectedEnvs = Array.from(checkboxes)
          .filter(cb => cb.checked)
          .map(cb => cb.value);

        if (selectedEnvs.length > 2) {
          this.checked = false;
          selectedEnvs = selectedEnvs.filter(env => env !== this.value);
          errorMsg.textContent = 'Maximum 2 environments allowed';
          errorMsg.style.display = 'block';
        } else {
          errorMsg.style.display = 'none';
        }
      });
    });

    modal.querySelector('#confirm-btn').addEventListener('click', submitHandler);
    modal.querySelector('#cancel-btn').addEventListener('click', function() {
      modal.remove();
      resolve(null);
    });
  });
}

/**
 * Main function to run multi-org comparison
 * Phase 1: Get status only (include_diffs: false)
 */
async function runMultiOrgComparison() {
  console.log('🚀 Starting Multi-Org Component Comparison');

  try {
    // Step 1: Get components from user
    const components = await showComponentInputUI();
    if (!components) {
      console.log('User cancelled component input');
      return;
    }

    // Step 2: Get available environments
    const availableEnvironments = ['DEV', 'QA', 'UAT', 'PROD'];
    const environments = await showEnvironmentSelectionUI(availableEnvironments);
    if (!environments) {
      console.log('User cancelled environment selection');
      return;
    }

    // Step 3: Show loading modal
    const loadingModal = createLoadingModal('Comparing Organizations...');
    document.body.appendChild(loadingModal);

    // Step 4: Phase 1 API call - Get status only (no detailed diffs)
    const payload = {
      orgA: environments.orgA,
      orgB: environments.orgB,
      components: components,
      include_diffs: false,  // ✅ Phase 1: Just status
      changed_only: false
    };

    console.log('📤 API Request (Phase 1 - Status Only):', payload);

    const response = await compareOrgs(payload);
    console.log('📥 API Response (Phase 1):', response);

    // Step 5: Remove loading modal
    loadingModal.remove();

    // Step 6: Display results (with "View Details" for DIFF items)
    displayComparisonResults(response, environments, components);

  } catch (error) {
    console.error('❌ Error in multi-org comparison:', error);
    // Remove any loading modals
    document.querySelectorAll('[id^="loading-modal-"]').forEach(m => m.remove());
    alert('Error: ' + error.message);
  }
}

/**
 * Display comparison results in a modal
 * Shows status for all components, with "View Details" for DIFF items
 */
function displayComparisonResults(data, environments, components) {
  console.log('🔍 Parsing response data:', data);
  
  // Parse the response format from your API - try multiple paths
  let changes = [];
  let summary = {};
  
  // CRITICAL: Your API wraps the response in meta.original_response
  if (data.meta && data.meta.original_response) {
    console.log('✅ Found data in meta.original_response');
    const originalResponse = data.meta.original_response;
    changes = originalResponse.changes || [];
    summary = originalResponse.summary || {};
  }
  // Try different response structures as fallback
  else if (data.changes && Array.isArray(data.changes)) {
    console.log('✅ Found data in direct changes');
    // Direct format: { changes: [...], summary: {...} }
    changes = data.changes;
    summary = data.summary || {};
  } else if (data.comparison && data.comparison.results) {
    console.log('✅ Found data in comparison.results');
    // Wrapped format: { comparison: { results: [...], summary: {...} } }
    changes = data.comparison.results;
    summary = data.comparison.summary || {};
  } else if (data.comparison && Array.isArray(data.comparison)) {
    console.log('✅ Found data in comparison array');
    // Array format: { comparison: [...] }
    changes = data.comparison;
    summary = {};
  } else {
    console.error('❌ Could not find data in any expected location');
    console.error('Available keys:', Object.keys(data));
  }
  
  console.log('📊 Parsed changes:', changes);
  console.log('📊 Parsed summary:', summary);
  
  // Create modal container
  const modal = document.createElement('div');
  const modalId = 'comparison-results-modal-' + Date.now();
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
    overflow-y: auto;
    padding: 20px;
  `;

  modal.innerHTML = `
    <div style="
      background: white;
      border-radius: 18px;
      max-width: 1200px;
      width: 95%;
      max-height: 90vh;
      overflow: hidden;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      animation: slideUp 0.3s ease-out;
      display: flex;
      flex-direction: column;
    ">
      <div style="padding: 24px;">
        <!-- Header -->
        <div style="margin-bottom: 24px;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px;">
            <div>
              <h2 style="font-size: 24px; font-weight: 700; margin: 0 0 8px 0;">
                Multi-Org Comparison Results
              </h2>
              <div style="display: flex; gap: 16px; align-items: center;">
                <div style="
                  padding: 8px 16px;
                  background: #e3f2fd;
                  color: #1976d2;
                  border-radius: 6px;
                  font-size: 14px;
                  font-weight: 600;
                ">
                  ${environments.orgA} ↔ ${environments.orgB}
                </div>
                <div style="font-size: 14px; color: #666;">
                  ${changes.length} components compared
                </div>
              </div>
            </div>
            <button onclick="document.getElementById('${modalId}').remove()" style="
              padding: 8px 12px;
              border: 1px solid #d2d2d7;
              background: white;
              border-radius: 6px;
              font-size: 13px;
              font-weight: 600;
              color: #1d1d1f;
              cursor: pointer;
            ">
              ✕ Close
            </button>
          </div>

          <!-- Summary Stats -->
          <div style="
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 16px;
            margin-bottom: 24px;
          ">
            <div style="
              padding: 20px;
              background: #fff3e0;
              border-left: 4px solid #f57c00;
              border-radius: 8px;
            ">
              <div style="font-size: 28px; font-weight: 700; color: #f57c00; margin-bottom: 4px;">
                ${summary.changed || 0}
              </div>
              <div style="font-size: 13px; color: #666;">Components Different</div>
            </div>
            <div style="
              padding: 20px;
              background: #e8f5e9;
              border-left: 4px solid #388e3c;
              border-radius: 8px;
            ">
              <div style="font-size: 28px; font-weight: 700; color: #388e3c; margin-bottom: 4px;">
                ${summary.same || 0}
              </div>
              <div style="font-size: 13px; color: #666;">Components Identical</div>
            </div>
            <div style="
              padding: 20px;
              background: #ffebee;
              border-left: 4px solid #d32f2f;
              border-radius: 8px;
            ">
              <div style="font-size: 28px; font-weight: 700; color: #d32f2f; margin-bottom: 4px;">
                ${summary.not_found || 0}
              </div>
              <div style="font-size: 13px; color: #666;">Components Not Found</div>
            </div>
          </div>
        </div>

        <!-- Results Table -->
        <div style="
          background: white;
          border: 1px solid #e5e5e7;
          border-radius: 12px;
          overflow: hidden;
          max-height: 50vh;
          overflow-y: auto;
        ">
          <table style="width: 100%; border-collapse: collapse;">
            <thead style="position: sticky; top: 0; background: #f5f5f7; z-index: 1;">
              <tr>
                <th style="padding: 12px; text-align: left; font-size: 13px; font-weight: 600; color: #666;">Component</th>
                <th style="padding: 12px; text-align: left; font-size: 13px; font-weight: 600; color: #666;">Type</th>
                <th style="padding: 12px; text-align: left; font-size: 13px; font-weight: 600; color: #666;">Status</th>
                <th style="padding: 12px; text-align: center; font-size: 13px; font-weight: 600; color: #666;">${environments.orgA} Commit</th>
                <th style="padding: 12px; text-align: center; font-size: 13px; font-weight: 600; color: #666;">${environments.orgB} Commit</th>
                <th style="padding: 12px; text-align: center; font-size: 13px; font-weight: 600; color: #666;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${changes.map((change, index) => {
                const status = change.status || 'UNKNOWN';
                const statusInfo = getStatusInfo(status);
                
                return `
                  <tr style="border-top: 1px solid #e5e5e7;">
                    <td style="padding: 12px; font-size: 14px; font-weight: 500;">
                      ${change.component_name}
                    </td>
                    <td style="padding: 12px; font-size: 13px; color: #666;">
                      ${change.component_type}
                    </td>
                    <td style="padding: 12px;">
                      <span style="
                        display: inline-block;
                        padding: 4px 12px;
                        background: ${statusInfo.bg};
                        color: ${statusInfo.color};
                        border-radius: 12px;
                        font-size: 12px;
                        font-weight: 600;
                      ">
                        ${statusInfo.icon} ${statusInfo.label}
                      </span>
                    </td>
                    <td style="padding: 12px; text-align: center; font-size: 11px; color: #666; font-family: monospace;">
                      ${change.commitA ? change.commitA.substring(0, 7) : '—'}
                    </td>
                    <td style="padding: 12px; text-align: center; font-size: 11px; color: #666; font-family: monospace;">
                      ${change.commitB ? change.commitB.substring(0, 7) : '—'}
                    </td>
                    <td style="padding: 12px; text-align: center;">
                      ${status === 'DIFF' ? `
                        <button 
                          onclick="window.viewComponentDetails_${index}()"
                          style="
                            padding: 6px 12px;
                            background: #0071e3;
                            color: white;
                            border: none;
                            border-radius: 6px;
                            font-size: 12px;
                            font-weight: 600;
                            cursor: pointer;
                          ">
                          View Details
                        </button>
                      ` : status === 'SAME' ? `
                        <button 
                          onclick="window.viewComponentDetails_${index}()"
                          style="
                            padding: 6px 12px;
                            background: #f5f5f7;
                            color: #666;
                            border: 1px solid #d2d2d7;
                            border-radius: 6px;
                            font-size: 12px;
                            font-weight: 600;
                            cursor: pointer;
                          ">
                          View Info
                        </button>
                      ` : '—'}
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>

        <!-- Actions -->
        <div style="margin-top: 24px; display: flex; gap: 12px;">
          <button onclick="document.getElementById('${modalId}').remove(); window.runMultiOrgComparison();" style="
            padding: 10px 20px;
            background: #0071e3;
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
          ">
            🔄 New Comparison
          </button>
        </div>
      </div>
    </div>

    <style>
      @keyframes slideUp {
        from { opacity: 0; transform: translateY(20px); }
        to { opacity: 1; transform: translateY(0); }
      }
    </style>
  `;

  document.body.appendChild(modal);

  // Attach "View Details" handlers for each component
  changes.forEach((change, index) => {
    window[`viewComponentDetails_${index}`] = async function() {
      await showComponentDetails(change, environments, components);
    };
  });
}

/**
 * Get status badge information
 */
function getStatusInfo(status) {
  const statusMap = {
    'DIFF': { label: 'Different', icon: '⚠️', bg: '#fff3e0', color: '#f57c00' },
    'SAME': { label: 'Identical', icon: '✓', bg: '#e8f5e9', color: '#388e3c' },
    'NOT_FOUND': { label: 'Not Found', icon: '⊘', bg: '#ffebee', color: '#d32f2f' }
  };
  return statusMap[status] || { label: status, icon: '?', bg: '#f5f5f7', color: '#666' };
}

/**
 * Phase 2: Fetch detailed diffs for a specific component
 */
async function showComponentDetails(change, environments, components) {
  console.log('🔍 Fetching detailed diffs for:', change.component_name);

  // Show loading modal
  const loadingModal = createLoadingModal('Loading Detailed Differences...');
  document.body.appendChild(loadingModal);

  try {
    // Phase 2 API call - Get detailed diffs for THIS component only
    const payload = {
      orgA: environments.orgA,
      orgB: environments.orgB,
      components: [{
        name: change.component_name,
        type: change.component_type
      }],
      include_diffs: true,  // ✅ Phase 2: Get detailed diffs
      changed_only: false
    };

    console.log('📤 API Request (Phase 2 - Detailed Diffs):', payload);

    const response = await compareOrgs(payload);
    console.log('📥 API Response (Phase 2):', response);

    // Remove loading modal
    loadingModal.remove();

    // Get the detailed diff data - check meta.original_response first
    let changes = [];
    if (response.meta && response.meta.original_response) {
      console.log('✅ Phase 2: Found data in meta.original_response');
      changes = response.meta.original_response.changes || [];
    } else if (response.comparison && response.comparison.results) {
      console.log('✅ Phase 2: Found data in comparison.results');
      changes = response.comparison.results;
    } else if (response.changes) {
      console.log('✅ Phase 2: Found data in direct changes');
      changes = response.changes;
    }
    
    const detailedChange = changes[0]; // Should be the component we requested
    console.log('📊 Phase 2 detailed change:', detailedChange);

    if (!detailedChange || !detailedChange.diff) {
      alert('No detailed differences available for this component');
      return;
    }

    // Show the detailed diff modal
    showDetailedDiffModal(detailedChange, environments);

  } catch (error) {
    loadingModal.remove();
    console.error('Error loading detailed diff:', error);
    alert('Error loading detailed diff: ' + error.message);
  }
}

/**
 * Show detailed diff modal with file-level changes using jsdiff library
 */
function showDetailedDiffModal(change, environments) {
  const modal = document.createElement('div');
  const modalId = 'detailed-diff-modal-' + Date.now();
  modal.id = modalId;

  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10001;
    backdrop-filter: blur(4px);
    padding: 20px;
  `;

  // Parse the diff data
  const diffData = change.diff?.data || {};
  const bundleFiles = diffData.bundle_files || [];
  
  // State for filtering
  let showOnlyChanged = true;
  let showFullContent = false;
  let selectedFile = null;

  // Helper to escape HTML
  const escapeHtml = (text) => {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  };

  // Render file list
  const renderFileList = () => {
    const filesToShow = showOnlyChanged 
      ? bundleFiles.filter(f => f.has_changes)
      : bundleFiles;

    return filesToShow.map((file, index) => {
      const isSelected = selectedFile === index;
      return `
        <div 
          onclick="window.selectFile_${modalId}(${index})"
          style="
            padding: 12px;
            background: ${isSelected ? '#e3f2fd' : file.has_changes ? '#fff3e0' : '#f5f5f7'};
            border-left: 4px solid ${file.has_changes ? '#f57c00' : '#388e3c'};
            border-radius: 6px;
            cursor: pointer;
            transition: all 0.2s;
            margin-bottom: 8px;
          "
          onmouseover="if (!${isSelected}) this.style.background='#e5e5e7'"
          onmouseout="if (!${isSelected}) this.style.background='${file.has_changes ? '#fff3e0' : '#f5f5f7'}'"
        >
          <div style="font-size: 13px; font-weight: 600; color: #1d1d1f; margin-bottom: 4px;">
            ${file.file_name}
          </div>
          <div style="font-size: 11px; color: #666;">
            ${file.has_changes ? '⚠️ Changed' : '✓ Unchanged'} • 
            ${file.exists_in_prod ? '✓ Prod' : '✗ Prod'} • 
            ${file.exists_in_uat ? '✓ UAT' : '✗ UAT'}
          </div>
        </div>
      `;
    }).join('');
  };

  // Render file content comparison using jsdiff
  const renderFileContent = () => {
    if (selectedFile === null || !bundleFiles[selectedFile]) {
      return '<div style="padding: 40px; text-align: center; color: #666;">Select a file to view details</div>';
    }

    const file = bundleFiles[selectedFile];
    
    if (!file.has_changes) {
      // Show unchanged file info
      return `
        <div style="padding: 40px; text-align: center;">
          <div style="font-size: 48px; margin-bottom: 16px;">✓</div>
          <h3 style="font-size: 18px; font-weight: 600; margin: 0 0 8px 0; color: #388e3c;">
            No Changes
          </h3>
          <p style="font-size: 14px; color: #666; margin: 0;">
            This file is identical in both environments
          </p>
        </div>
      `;
    }

    // Parse JSON and format for comparison
    let orgACode, orgBCode;
    try {
      orgACode = JSON.stringify(JSON.parse(file.production_code || '{}'), null, 2);
      orgBCode = JSON.stringify(JSON.parse(file.uat_code || '{}'), null, 2);
    } catch (e) {
      orgACode = file.production_code || '';
      orgBCode = file.uat_code || '';
    }

    // Use jsdiff to compute line-by-line differences
    const diffResult = Diff.diffLines(orgACode, orgBCode);

    // Build side-by-side view from diff results
    let lineNumA = 1;
    let lineNumB = 1;
    let comparisonHTML = `
      <div style="
        display: grid;
        grid-template-columns: 40px 1fr 40px 1fr;
        font-family: 'Monaco', 'Menlo', monospace;
        font-size: 12px;
        border: 1px solid #e5e5e7;
      ">
        <!-- Header -->
        <div style="padding: 8px; background: #ffebee; font-weight: 600; text-align: center; border-bottom: 2px solid #d32f2f; color: #d32f2f;">#</div>
        <div style="padding: 8px; background: #ffebee; font-weight: 600; border-bottom: 2px solid #d32f2f; color: #d32f2f;">${environments.orgA}</div>
        <div style="padding: 8px; background: #e8f5e9; font-weight: 600; text-align: center; border-bottom: 2px solid #388e3c; color: #388e3c;">#</div>
        <div style="padding: 8px; background: #e8f5e9; font-weight: 600; border-bottom: 2px solid #388e3c; color: #388e3c;">${environments.orgB}</div>
    `;

    let hasChanges = false;

    diffResult.forEach((part) => {
      const lines = part.value.split('\n');
      // Remove last empty line if exists
      if (lines[lines.length - 1] === '') {
        lines.pop();
      }

      lines.forEach((line, idx) => {
        let bgColorA, bgColorB, textColorA, textColorB;
        let showLineA, showLineB, showNumA, showNumB;

        if (part.added) {
          // Line added in orgB (UAT)
          bgColorA = '#f5f5f7';
          bgColorB = '#e8f5e9';
          textColorA = '#999';
          textColorB = '#388e3c';
          showLineA = '';
          showLineB = line;
          showNumA = '';
          showNumB = lineNumB;
          lineNumB++;
          hasChanges = true;
        } else if (part.removed) {
          // Line removed from orgA (QA)
          bgColorA = '#ffebee';
          bgColorB = '#f5f5f7';
          textColorA = '#d32f2f';
          textColorB = '#999';
          showLineA = line;
          showLineB = '';
          showNumA = lineNumA;
          showNumB = '';
          lineNumA++;
          hasChanges = true;
        } else {
          // Line unchanged
          if (!showFullContent && hasChanges) {
            // Skip if we're filtering and we've already shown some changes
            lineNumA++;
            lineNumB++;
            return;
          }
          
          bgColorA = bgColorB = 'white';
          textColorA = textColorB = '#1d1d1f';
          showLineA = line;
          showLineB = line;
          showNumA = lineNumA;
          showNumB = lineNumB;
          lineNumA++;
          lineNumB++;
        }

        // Skip unchanged lines if filter is on
        if (!showFullContent && !part.added && !part.removed) {
          return;
        }

        comparisonHTML += `
          <div style="
            padding: 2px 8px;
            background: ${bgColorA};
            color: #999;
            text-align: right;
            border-right: 1px solid #e5e5e7;
            border-bottom: 1px solid #f5f5f7;
            user-select: none;
          ">${showNumA}</div>
          <div style="
            padding: 2px 8px;
            background: ${bgColorA};
            color: ${textColorA};
            border-right: 2px solid #d2d2d7;
            border-bottom: 1px solid #f5f5f7;
            white-space: pre;
            overflow-x: auto;
          ">${escapeHtml(showLineA)}</div>
          <div style="
            padding: 2px 8px;
            background: ${bgColorB};
            color: #999;
            text-align: right;
            border-right: 1px solid #e5e5e7;
            border-bottom: 1px solid #f5f5f7;
            user-select: none;
          ">${showNumB}</div>
          <div style="
            padding: 2px 8px;
            background: ${bgColorB};
            color: ${textColorB};
            border-bottom: 1px solid #f5f5f7;
            white-space: pre;
            overflow-x: auto;
          ">${escapeHtml(showLineB)}</div>
        `;
      });
    });

    comparisonHTML += `</div>`;
    
    // Add legend
    comparisonHTML += `
      <div style="
        margin-top: 16px;
        padding: 12px;
        background: #f5f5f7;
        border-radius: 6px;
        font-size: 12px;
        display: flex;
        gap: 16px;
        align-items: center;
      ">
        <strong>Legend:</strong>
        <span style="padding: 2px 8px; background: #ffebee; color: #d32f2f; border-radius: 3px;">🔴 Removed (${environments.orgA})</span>
        <span style="padding: 2px 8px; background: #e8f5e9; color: #388e3c; border-radius: 3px;">🟢 Added (${environments.orgB})</span>
        <span style="padding: 2px 8px; background: white; color: #1d1d1f; border-radius: 3px;">⚪ Unchanged</span>
      </div>
    `;

    return comparisonHTML;
  };

  // Build modal HTML
  modal.innerHTML = `
    <div style="
      background: white;
      border-radius: 18px;
      max-width: 1400px;
      width: 95%;
      max-height: 90vh;
      overflow: hidden;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      animation: slideUp 0.3s ease-out;
      display: grid;
      grid-template-rows: auto 1fr;
    ">
      <!-- Header -->
      <div style="padding: 24px; border-bottom: 1px solid #e5e5e7;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px;">
          <div>
            <h2 style="font-size: 22px; font-weight: 700; margin: 0 0 4px 0; color: #1d1d1f;">
              Detailed Differences
            </h2>
            <p style="font-size: 14px; color: #666; margin: 0;">
              ${change.component_name} • ${change.component_type}
            </p>
          </div>
          <button onclick="document.getElementById('${modalId}').remove()" style="
            padding: 8px 12px;
            border: 1px solid #d2d2d7;
            background: white;
            border-radius: 6px;
            font-size: 13px;
            font-weight: 600;
            color: #1d1d1f;
            cursor: pointer;
          ">
            ✕ Close
          </button>
        </div>

        <!-- Toolbar -->
        <div style="display: flex; gap: 8px; align-items: center;">
          <button id="filter-changed-btn" style="
            padding: 6px 12px;
            border: 1px solid #0071e3;
            background: #0071e3;
            color: white;
            border-radius: 4px;
            font-size: 12px;
            font-weight: 600;
            cursor: pointer;
          ">
            Show Only Changed Files
          </button>
          
          <button id="content-filter-btn" style="
            padding: 6px 12px;
            border: 1px solid #0071e3;
            background: #0071e3;
            color: white;
            border-radius: 4px;
            font-size: 12px;
            font-weight: 600;
            cursor: pointer;
          ">
            Show Only Changed Lines
          </button>

          <div style="flex: 1;"></div>

          <div style="display: flex; gap: 12px; font-size: 12px; color: #666;">
            <span>🔴 ${environments.orgA}</span>
            <span>🟢 ${environments.orgB}</span>
          </div>
        </div>
      </div>

      <!-- Content -->
      <div style="display: grid; grid-template-columns: 300px 1fr; overflow: hidden;">
        <!-- File List -->
        <div id="file-list" style="
          padding: 16px;
          border-right: 1px solid #e5e5e7;
          overflow-y: auto;
          background: #f8f9fa;
        ">
          ${renderFileList()}
        </div>

        <!-- File Content -->
        <div id="file-content" style="
          overflow: auto;
        ">
          ${renderFileContent()}
        </div>
      </div>
    </div>

    <style>
      @keyframes slideUp {
        from { opacity: 0; transform: translateY(20px); }
        to { opacity: 1; transform: translateY(0); }
      }
    </style>
  `;

  document.body.appendChild(modal);

  // Set up file selection
  window[`selectFile_${modalId}`] = function(index) {
    selectedFile = index;
    modal.querySelector('#file-content').innerHTML = renderFileContent();
  };

  // Set up filter buttons
  modal.querySelector('#filter-changed-btn').addEventListener('click', function() {
    showOnlyChanged = !showOnlyChanged;
    this.textContent = showOnlyChanged ? 'Show All Files' : 'Show Only Changed Files';
    this.style.background = showOnlyChanged ? '#0071e3' : 'white';
    this.style.color = showOnlyChanged ? 'white' : '#0071e3';
    modal.querySelector('#file-list').innerHTML = renderFileList();
  });

  modal.querySelector('#content-filter-btn').addEventListener('click', function() {
    showFullContent = !showFullContent;
    showOnlyChanged = !showFullContent; // Toggle logic for content
    this.textContent = showFullContent ? 'Show Only Changed Lines' : 'Show Full Content';
    this.style.background = !showFullContent ? '#0071e3' : 'white';
    this.style.color = !showFullContent ? 'white' : '#0071e3';
    modal.querySelector('#file-content').innerHTML = renderFileContent();
  });

  // Auto-select first changed file
  const firstChangedIndex = bundleFiles.findIndex(f => f.has_changes);
  if (firstChangedIndex !== -1) {
    selectedFile = firstChangedIndex;
    modal.querySelector('#file-content').innerHTML = renderFileContent();
  }
}

// Export for window access
window.runMultiOrgComparison = runMultiOrgComparison;

// Export as named export to match main.js import
export { runMultiOrgComparison };