// src/ui/tabs/development-tools/history-multi-org.js
// Multi-Org Component History Comparison Tool - COMPLETE VERSION

import { getMultiOrgComponentHistory } from '../../../../api/endpoints.js';
import COMPONENT_CONFIG from '../../../../config/component-config.js';

/**
 * Show UI to add components with types
 */
async function showComponentInputUI() {
  return new Promise((resolve) => {
    const modal = document.createElement('div');
    const modalId = 'history-components-modal-' + Date.now();
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
        <div style="font-size: 60px; margin-bottom: 20px;">📜</div>
        <h2 style="
          font-size: 22px;
          font-weight: 600;
          margin: 0 0 12px 0;
          color: #1d1d1f;
        ">
          Add Components for History Comparison
        </h2>
        <p style="
          font-size: 14px;
          color: #666666;
          margin: 0 0 24px 0;
          line-height: 1.5;
        ">
          Add each component with its type to compare commit history across environments
        </p>

        <div id="components-container" style="
          max-height: 300px;
          overflow-y: auto;
          margin-bottom: 24px;
          padding-bottom: 12px;
        ">
        </div>

        <button id="add-component-btn" style="
          width: 100%;
          padding: 12px 16px;
          border: 2px dashed #0071e3;
          background: #f0f7ff;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          color: #0071e3;
          cursor: pointer;
          margin-bottom: 24px;
          transition: all 0.2s;
        " onmouseover="this.style.background='#e8f1ff'" onmouseout="this.style.background='#f0f7ff'">
          + Add Another Component
        </button>

        <div style="display: flex; gap: 12px;">
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
          ">
            Cancel
          </button>
          <button id="submitBtn-${modalId}" style="
            flex: 1;
            padding: 12px 16px;
            border: none;
            background: #0071e3;
            border-radius: 8px;
            font-size: 15px;
            font-weight: 600;
            color: white;
            cursor: pointer;
          ">
            Continue
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

    modal.querySelector('#add-component-btn').addEventListener('click', addComponentRow);
    addComponentRow();

    const submitBtn = modal.querySelector(`#submitBtn-${modalId}`);
    submitBtn.addEventListener('click', submitHandler);
  });
}

/**
 * Prompt for exactly 2 environment selection with enhanced UI
 */
async function promptForEnvironments() {
  return new Promise((resolve) => {
    const modal = document.createElement('div');
    const modalId = 'history-env-modal-' + Date.now();
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

    const environmentsArray = COMPONENT_CONFIG.getEnvironmentsArray();
    let selectedEnvironments = [];

    const updateSelection = function(envValue, isChecked) {
      const env = environmentsArray.find(e => e.value === envValue);
      if (!env) return;

      if (isChecked) {
        if (selectedEnvironments.length >= 2) {
          alert('Maximum 2 environments can be selected for comparison');
          return false;
        }
        selectedEnvironments.push(env);
      } else {
        selectedEnvironments = selectedEnvironments.filter(e => e.value !== envValue);
      }
      
      // Update selection display
      const selectedDisplay = modal.querySelector('#selected-environments');
      const countDisplay = modal.querySelector('#selection-count');
      
      selectedDisplay.innerHTML = selectedEnvironments.map(env => 
        `<div style="background: #e8f1ff; padding: 8px 12px; border-radius: 6px; font-size: 13px; font-weight: 600; color: #0071e3; display: flex; align-items: center; gap: 8px;">
          ${env.icon} ${env.label}
        </div>`
      ).join('');
      
      countDisplay.textContent = `${selectedEnvironments.length}/2 environments selected`;
      
      // Update checkbox states - disable others when 2 are selected
      const checkboxes = modal.querySelectorAll('input[type="checkbox"]');
      checkboxes.forEach(checkbox => {
        const isSelected = selectedEnvironments.some(env => env.value === checkbox.value);
        if (selectedEnvironments.length === 2 && !isSelected) {
          checkbox.disabled = true;
          checkbox.parentElement.style.opacity = '0.5';
          checkbox.parentElement.style.cursor = 'not-allowed';
        } else {
          checkbox.disabled = false;
          checkbox.parentElement.style.opacity = '1';
          checkbox.parentElement.style.cursor = 'pointer';
        }
      });
      
      return true;
    };

    const submitHandler = function() {
      if (selectedEnvironments.length !== 2) {
        alert('Please select exactly 2 environments for comparison');
        return;
      }

      modal.remove();
      resolve(selectedEnvironments);
    };

    modal.innerHTML = `
      <div style="
        background: white;
        border-radius: 18px;
        padding: 40px;
        max-width: 500px;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        animation: slideUp 0.3s ease-out;
      ">
        <div style="font-size: 50px; margin-bottom: 20px;">🌐</div>
        <h2 style="
          font-size: 22px;
          font-weight: 600;
          margin: 0 0 8px 0;
          color: #1d1d1f;
        ">
          Select Environments to Compare
        </h2>
        <p style="
          font-size: 14px;
          color: #666666;
          margin: 0 0 24px 0;
        ">
          Choose exactly 2 environments for history comparison
        </p>

        <!-- Selection Status -->
        <div style="
          background: #f8f9fa;
          padding: 16px;
          border-radius: 8px;
          margin-bottom: 24px;
          text-align: center;
        ">
          <div id="selection-count" style="
            font-size: 14px;
            font-weight: 600;
            color: #0071e3;
            margin-bottom: 8px;
          ">0/2 environments selected</div>
          <div id="selected-environments" style="
            display: flex;
            gap: 8px;
            justify-content: center;
            flex-wrap: wrap;
          "></div>
        </div>

        <!-- Environment Options -->
        <div style="margin-bottom: 32px;">
          <div style="display: flex; flex-direction: column; gap: 8px;">
            ${environmentsArray.map(env => `
              <label style="
                display: flex;
                align-items: center;
                cursor: pointer;
                font-size: 14px;
                padding: 12px;
                border: 1px solid #e5e5e7;
                border-radius: 8px;
                transition: all 0.2s;
                background: white;
              " onmouseover="this.style.background='#f5f5f7'" onmouseout="this.style.background='white'">
                <input type="checkbox" value="${env.value}" 
                  style="margin-right: 12px; width: 18px; height: 18px; cursor: pointer;"
                  onchange="window.handleEnvSelection('${modalId}', '${env.value}', this.checked)">
                <span style="flex: 1;">
                  <strong>${env.icon} ${env.label}</strong>
                  <div style="font-size: 12px; color: #999999; margin-top: 2px;">
                    ${env.branch} • Risk: ${env.risk.toUpperCase()}
                  </div>
                </span>
              </label>
            `).join('')}
          </div>
        </div>

        <!-- Info Message -->
        <div style="
          background: #e8f4fd;
          border: 1px solid #b6d7f2;
          border-radius: 8px;
          padding: 12px 16px;
          margin-bottom: 24px;
        ">
          <div style="display: flex; align-items: flex-start; gap: 8px;">
            <div style="font-size: 16px;">💡</div>
            <div>
              <div style="font-size: 13px; font-weight: 600; color: #1d1d1f; margin-bottom: 2px;">
                Selection Help
              </div>
              <div style="font-size: 12px; color: #666666;">
                Select 2 environments to compare. Other options will be disabled until you deselect one.
              </div>
            </div>
          </div>
        </div>

        <!-- Buttons -->
        <div style="display: flex; gap: 12px;">
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
          " onmouseover="this.style.background='#e5e5e7'" onmouseout="this.style.background='#f5f5f7'">
            Cancel
          </button>
          <button id="submitBtn-${modalId}" style="
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
            Continue
          </button>
        </div>
      </div>
      <style>
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        input[type="checkbox"]:disabled {
          cursor: not-allowed !important;
        }
        
        input[type="checkbox"]:disabled + span {
          opacity: 0.5;
        }
      </style>
    `;

    document.body.appendChild(modal);
    
    // Attach the update function to the modal
    modal.updateSelection = updateSelection;

    // Add global handler function
    window.handleEnvSelection = function(modalId, envValue, isChecked) {
      const modal = document.getElementById(modalId);
      if (modal && modal.updateSelection) {
        modal.updateSelection(envValue, isChecked);
      }
    };

    const submitBtn = modal.querySelector(`#submitBtn-${modalId}`);
    submitBtn.addEventListener('click', submitHandler);
  });
}
/**
 * Prompt for commit limit selection
 */
/**
 * Prompt for commit limit selection - Simplified version
 */
async function promptForCommitLimit() {
  return new Promise((resolve) => {
    const modal = document.createElement('div');
    const modalId = 'history-limit-modal-' + Date.now();
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

    let selectedLimit = 2; // Default value

    const submitHandler = function() {
      modal.remove();
      resolve(selectedLimit);
    };

    modal.innerHTML = `
      <div style="
        background: white;
        border-radius: 18px;
        padding: 40px;
        max-width: 400px;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        animation: slideUp 0.3s ease-out;
      ">
        <div style="font-size: 50px; margin-bottom: 20px;">📊</div>
        <h2 style="
          font-size: 22px;
          font-weight: 600;
          margin: 0 0 8px 0;
          color: #1d1d1f;
        ">
          Commit History Limit
        </h2>
        <p style="
          font-size: 14px;
          color: #666666;
          margin: 0 0 24px 0;
        ">
          How many recent commits to show per component?
        </p>

        <!-- Default Option -->
        <div style="
          background: #e8f1ff;
          border: 2px solid #0071e3;
          border-radius: 12px;
          padding: 20px;
          margin-bottom: 20px;
          text-align: center;
          cursor: pointer;
          transition: all 0.2s;
        " onclick="
          const modal = document.getElementById('${modalId}');
          modal.selectedLimit = 2;
          modal.querySelector('.default-option').style.background = '#e8f1ff';
          modal.querySelector('.default-option').style.borderColor = '#0071e3';
          modal.querySelector('.custom-option').style.background = '#f8f9fa';
          modal.querySelector('.custom-option').style.borderColor = '#e5e5e7';
        " class="default-option">
          <div style="font-size: 32px; font-weight: 700; color: #0071e3; margin-bottom: 8px;">
            2 Commits
          </div>
          <div style="font-size: 13px; color: #0071e3; font-weight: 600;">
            🎯 Recommended Default
          </div>
          <div style="font-size: 12px; color: #666666; margin-top: 4px;">
            Optimal balance of detail and performance
          </div>
        </div>

        <!-- Custom Option -->
        <div style="
          background: #f8f9fa;
          border: 1px solid #e5e5e7;
          border-radius: 12px;
          padding: 20px;
          margin-bottom: 24px;
          cursor: pointer;
          transition: all 0.2s;
        " onclick="
          const modal = document.getElementById('${modalId}');
          modal.querySelector('.default-option').style.background = '#f8f9fa';
          modal.querySelector('.default-option').style.borderColor = '#e5e5e7';
          modal.querySelector('.custom-option').style.background = '#e8f1ff';
          modal.querySelector('.custom-option').style.borderColor = '#0071e3';
          modal.querySelector('.custom-input').focus();
        " class="custom-option">
          <div style="
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 12px;
          ">
            <div style="font-size: 16px; font-weight: 600; color: #1d1d1f;">
              Custom Limit
            </div>
            <div style="
              background: #0071e3;
              color: white;
              padding: 4px 8px;
              border-radius: 12px;
              font-size: 11px;
              font-weight: 600;
            ">
              MAX: 5
            </div>
          </div>
          
          <div style="display: flex; align-items: center; gap: 12px;">
            <input 
              type="number" 
              min="1" 
              max="5" 
              value="2"
              class="custom-input"
              style="
                flex: 1;
                padding: 12px;
                border: 1px solid #d2d2d7;
                border-radius: 8px;
                font-size: 16px;
                font-weight: 600;
                text-align: center;
                box-sizing: border-box;
              "
              onchange="
                const modal = document.getElementById('${modalId}');
                const value = Math.min(5, Math.max(1, parseInt(this.value) || 2));
                this.value = value;
                modal.selectedLimit = value;
                modal.querySelector('.custom-option').style.background = '#e8f1ff';
                modal.querySelector('.custom-option').style.borderColor = '#0071e3';
                modal.querySelector('.default-option').style.background = '#f8f9fa';
                modal.querySelector('.default-option').style.borderColor = '#e5e5e7';
              "
              onfocus="
                const modal = document.getElementById('${modalId}');
                modal.selectedLimit = parseInt(this.value) || 2;
                modal.querySelector('.custom-option').style.background = '#e8f1ff';
                modal.querySelector('.custom-option').style.borderColor = '#0071e3';
                modal.querySelector('.default-option').style.background = '#f8f9fa';
                modal.querySelector('.default-option').style.borderColor = '#e5e5e7';
              "
            >
            <div style="font-size: 14px; color: #666666; font-weight: 600;">
              Commits
            </div>
          </div>
          
          <div style="
            font-size: 12px;
            color: #666666;
            margin-top: 12px;
            text-align: center;
          ">
            For performance reasons, maximum is 5 commits per component
          </div>
        </div>

        <!-- Performance Note -->
        <div style="
          background: #fff8e6;
          border: 1px solid #ffd54f;
          border-radius: 8px;
          padding: 12px 16px;
          margin-bottom: 24px;
        ">
          <div style="display: flex; align-items: flex-start; gap: 8px;">
            <div style="font-size: 16px;">⚡</div>
            <div>
              <div style="font-size: 13px; font-weight: 600; color: #1d1d1f; margin-bottom: 2px;">
                Performance Note
              </div>
              <div style="font-size: 12px; color: #666666;">
                Higher limits may slow down the comparison for components with extensive history.
              </div>
            </div>
          </div>
        </div>

        <!-- Buttons -->
        <div style="display: flex; gap: 12px;">
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
          " onmouseover="this.style.background='#e5e5e7'" onmouseout="this.style.background='#f5f5f7'">
            Cancel
          </button>
          <button id="submitBtn-${modalId}" style="
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
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        input[type="number"] {
          -moz-appearance: textfield;
        }
        
        input[type="number"]::-webkit-outer-spin-button,
        input[type="number"]::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
      </style>
    `;

    document.body.appendChild(modal);
    modal.selectedLimit = 2;

    const submitBtn = modal.querySelector(`#submitBtn-${modalId}`);
    submitBtn.addEventListener('click', submitHandler);
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
      <p style="font-size: 15px; color: #666666; margin: 0; font-weight: 500;">
        ${message}
      </p>
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
 * Show error modal
 */
function showError(title, message, icon = '⚠️') {
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
      <h2 style="font-size: 22px; font-weight: 600; margin: 0 0 12px 0; color: #1d1d1f;">
        ${title}
      </h2>
      <p style="font-size: 15px; color: #666666; margin: 0 0 24px 0; line-height: 1.5;">
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
      ">
        Dismiss
      </button>
    </div>
    <style>
      @keyframes slideUp {
        from { opacity: 0; transform: translateY(20px); }
        to { opacity: 1; transform: translateY(0); }
      }
    </style>
  `;

  document.body.appendChild(modal);
}

// ===== MAIN FUNCTION =====
/**
 * Run Multi-Org History Comparison - Enhanced version
 */
export async function runMultiOrgHistory(components = []) {
  console.log('🔄 Multi-Org History Comparison triggered');

  try {
    // ===== STEP 1: Get components to check =====
    let componentsToCheck = components;

    if (!componentsToCheck || componentsToCheck.length === 0) {
      componentsToCheck = await showComponentInputUI();
    }

    if (!componentsToCheck || componentsToCheck.length === 0) {
      showError('No Components', 'Please provide components to compare history', '📦');
      return;
    }

    console.log('✅ Found', componentsToCheck.length, 'components');

    // ===== STEP 2: Get environment selection (exactly 2) =====
    const environments = await promptForEnvironments();
    if (!environments) return;

    // ===== STEP 3: Get commit limit =====
    const limit = await promptForCommitLimit();
    if (!limit) return;

    // ===== STEP 4: Show enhanced loading with progress =====
    const loadingModal = createEnhancedLoadingModal('Fetching component history...', environments);
    document.body.appendChild(loadingModal);

    try {
      // ===== STEP 5: Call Multi-Org History API =====
      console.log('📡 Calling multi-org history API...');
      const result = await getMultiOrgComponentHistory({
        orgA: environments[0].key,
        orgB: environments[1].key,
        branchA: environments[0].branch,
        branchB: environments[1].branch,
        components: componentsToCheck,
        limit: limit
      });

      console.log('✅ Multi-Org History API Response:', result);

      // ===== STEP 6: Hide loading =====
      loadingModal.remove();

      // ===== STEP 7: Process and show enhanced results =====
      if (result.meta && result.meta.success) {
  showEnhancedComparisonResults(result, componentsToCheck, environments, limit);
} else {
  throw new Error(result.meta?.error || 'Failed to fetch history data');
}

      console.log('✅ Multi-Org History comparison completed');

    } catch (apiError) {
      loadingModal.remove();
      throw apiError;
    }

  } catch (error) {
    console.error('❌ Multi-Org History error:', error);
    document.querySelectorAll('[id^="loading-modal"]').forEach(m => m.remove());
    showError('History Error', error.message || 'An error occurred while fetching history', '⚠️');
  }
}






/**
 * Show enhanced comparison results with expanded commit rows
 */
function showEnhancedComparisonResults(result, components, environments, limit) {
  const modal = document.createElement('div');
  const modalId = 'history-results-' + Date.now();
  modal.id = modalId;

  // Handle API response structure
  const { results = {}, meta = {} } = result;
  const [envA, envB] = environments;

  // Convert results object to array format for table generation
  const historyArray = Object.entries(results).map(([componentKey, componentData]) => {
    const [component_type, component_name] = componentKey.split('/');
    return {
      component_name,
      component_type,
      orgA: componentData.orgA || [],
      orgB: componentData.orgB || []
    };
  });

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
    padding: 20px;
  `;

  // Generate expanded table HTML with separate commit rows
  const tableHTML = generateExpandedCommitTable(historyArray, envA, envB, limit);

  modal.innerHTML = `
    <div style="
      background: white;
      border-radius: 18px;
      padding: 40px;
      max-width: 1400px;
      width: 100%;
      max-height: 90vh;
      overflow-y: auto;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      animation: slideUp 0.3s ease-out;
      display: flex;
      flex-direction: column;
    ">
      <!-- Header -->
      <div style="text-align: center; margin-bottom: 24px; padding-bottom: 20px; border-bottom: 1px solid #e5e5e7;">
        <h2 style="font-size: 28px; font-weight: 700; margin: 0 0 8px 0; color: #1d1d1f;">
          🔄 History Comparison
        </h2>
        <p style="font-size: 15px; color: #666666; margin: 8px 0 0 0;">
          Detailed commit history comparison across ${envA.label} and ${envB.label}
        </p>
        <p style="font-size: 13px; color: #4caf50; margin: 4px 0 0 0; font-weight: 600;">
          ✅ Successfully compared ${meta.totalComponents || historyArray.length} components
        </p>
      </div>

      <!-- Environment Summary -->
      <div style="
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 16px;
        margin-bottom: 24px;
      ">
        <div style="
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 20px;
          border-radius: 12px;
          text-align: center;
        ">
          <div style="font-size: 32px; margin-bottom: 4px;">${envA.icon}</div>
          <div style="font-size: 16px; font-weight: 600;">${envA.label}</div>
          <div style="font-size: 12px; opacity: 0.9;">${envA.branch}</div>
        </div>

        <div style="
          background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
          color: white;
          padding: 20px;
          border-radius: 12px;
          text-align: center;
        ">
          <div style="font-size: 32px; margin-bottom: 4px;">${envB.icon}</div>
          <div style="font-size: 16px; font-weight: 600;">${envB.label}</div>
          <div style="font-size: 12px; opacity: 0.9;">${envB.branch}</div>
        </div>
      </div>

      <!-- Search and Filter -->
      <div style="
        display: flex;
        gap: 12px;
        margin-bottom: 20px;
        align-items: center;
      ">
        <input 
          type="text" 
          placeholder="Search components..." 
          class="search-input-${modalId}"
          style="
            flex: 1;
            padding: 10px 16px;
            border: 1px solid #d2d2d7;
            border-radius: 8px;
            font-size: 14px;
          "
          onkeyup="filterExpandedHistoryTable('${modalId}')"
        >
        <select class="filter-type-${modalId}" style="
          padding: 10px 16px;
          border: 1px solid #d2d2d7;
          border-radius: 8px;
          font-size: 14px;
          cursor: pointer;
        " onchange="filterExpandedHistoryTable('${modalId}')">
          <option value="">All Types</option>
          <option value="ApexClass">ApexClass</option>
          <option value="Flow">Flow</option>
          <option value="DataRaptor">DataRaptor</option>
          <option value="CustomObject">CustomObject</option>
          <option value="Page">Page</option>
          <option value="Component">Component</option>
        </select>
      </div>

      <!-- Results Summary -->
      <div style="
        background: #f8f9fa;
        padding: 16px;
        border-radius: 8px;
        margin-bottom: 16px;
        font-size: 14px;
        color: #666;
      ">
        <strong>${historyArray.length}</strong> components compared • 
        Showing up to <strong>${limit}</strong> commits per component
      </div>

      <!-- Expanded Table -->
      <div style="
        overflow-x: auto;
        border: 1px solid #e5e5e7;
        border-radius: 12px;
        flex: 1;
        margin-bottom: 24px;
      ">
        ${tableHTML}
      </div>

      <!-- Action Buttons -->
      <div style="
        display: grid;
        grid-template-columns: 1fr 1fr 1fr;
        gap: 12px;
        padding-top: 24px;
        border-top: 1px solid #e5e5e7;
      ">
        <button onclick="exportExpandedHistoryAsCSV('${modalId}')" style="
          padding: 12px 16px;
          border: 1px solid #d2d2d7;
          background: white;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          color: #0071e3;
          cursor: pointer;
          transition: all 0.2s;
        " onmouseover="this.style.background='#f5f5f7'" onmouseout="this.style.background='white'">
          📊 Export as CSV
        </button>
        <button onclick="exportExpandedHistoryAsJSON('${modalId}')" style="
          padding: 12px 16px;
          border: 1px solid #d2d2d7;
          background: white;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          color: #0071e3;
          cursor: pointer;
          transition: all 0.2s;
        " onmouseover="this.style.background='#f5f5f7'" onmouseout="this.style.background='white'">
          📋 Export as JSON
        </button>
        <button onclick="document.getElementById('${modalId}').remove()" style="
          padding: 12px 16px;
          border: none;
          background: #0071e3;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          color: white;
          cursor: pointer;
          transition: all 0.2s;
        " onmouseover="this.style.background='#0077ed'" onmouseout="this.style.background='#0071e3'">
          Close
        </button>
      </div>
    </div>

    <style>
      @keyframes slideUp {
        from { opacity: 0; transform: translateY(20px); }
        to { opacity: 1; transform: translateY(0); }
      }
      
      .expanded-history-table {
        width: 100%;
        border-collapse: collapse;
        background: white;
        font-size: 13px;
      }
      
      .expanded-history-table th {
        background: #f8f9fa;
        padding: 16px 12px;
        text-align: left;
        border-bottom: 2px solid #e5e5e7;
        font-weight: 600;
        color: #1d1d1f;
        position: sticky;
        top: 0;
      }
      
      .expanded-history-table td {
        padding: 12px;
        border-bottom: 1px solid #e5e5e7;
        vertical-align: top;
      }
      
      .expanded-history-table tr.component-row:hover {
        background: #fafafa;
      }
      
      .component-type {
        background: #f0f0f0;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 11px;
        font-weight: 600;
      }
      
      .commit-row {
        border-left: 4px solid transparent;
      }
      
      .commit-row.common {
        border-left-color: #4caf50;
        background: #f8fff8;
      }
      
      .commit-row.unique {
        border-left-color: #ff6b6b;
        background: #fff8f8;
      }
      
      .commit-message {
        font-weight: 600;
        margin-bottom: 4px;
        color: #1d1d1f;
        line-height: 1.4;
      }
      
      .commit-meta {
        font-size: 11px;
        color: #666666;
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
      }
      
      .commit-author {
        font-weight: 600;
        color: #1d1d1f;
      }
      
      .commit-date {
        color: #999;
      }
      
      .commit-hash {
        font-family: monospace;
        background: #e5e5e7;
        padding: 2px 6px;
        border-radius: 3px;
        font-size: 10px;
      }
      
      .status-badge {
        display: inline-block;
        padding: 2px 8px;
        border-radius: 12px;
        font-size: 10px;
        font-weight: 600;
        margin-left: 8px;
      }
      
      .status-common {
        background: #e8f5e9;
        color: #1b5e20;
      }
      
      .status-unique {
        background: #ffebee;
        color: #b71c1c;
      }
      
      .no-commits {
        text-align: center;
        color: #999999;
        font-style: italic;
        padding: 20px;
        background: #f8f9fa;
        border-radius: 6px;
      }
      
      .commit-count-header {
        font-size: 11px;
        color: #666;
        font-weight: normal;
        display: block;
        margin-top: 4px;
      }
      
      .environment-header {
        text-align: center;
        font-weight: 600;
        font-size: 14px;
      }
      
      @media (max-width: 768px) {
        .expanded-history-table {
          font-size: 12px;
        }
        
        .expanded-history-table th,
        .expanded-history-table td {
          padding: 8px 6px;
        }
        
        .commit-meta {
          flex-direction: column;
          gap: 4px;
        }
      }
    </style>
  `;

  document.body.appendChild(modal);
  
  // Add global functions for filtering
  window.filterExpandedHistoryTable = filterExpandedHistoryTable;
  window.exportExpandedHistoryAsCSV = exportExpandedHistoryAsCSV;
  window.exportExpandedHistoryAsJSON = exportExpandedHistoryAsJSON;

  return modal;
}

/**
 * Generate expanded history table with separate commit rows
 */
function generateExpandedCommitTable(historyArray, envA, envB, limit) {
  let html = `
    <table class="expanded-history-table">
      <thead>
        <tr>
          <th style="width: 200px;">Component</th>
          <th style="width: 100px;">Type</th>
          <th style="width: 350px;" class="environment-header">
            ${envA.icon} ${envA.label}
            <span class="commit-count-header">Individual commits</span>
          </th>
          <th style="width: 350px;" class="environment-header">
            ${envB.icon} ${envB.label}
            <span class="commit-count-header">Individual commits</span>
          </th>
        </tr>
      </thead>
      <tbody>
  `;

  if (historyArray.length === 0) {
    html += `
      <tr>
        <td colspan="4" style="text-align: center; padding: 40px; color: #666;">
          <div style="font-size: 48px; margin-bottom: 16px;">📭</div>
          <div style="font-size: 16px; font-weight: 600; margin-bottom: 8px;">No History Data</div>
          <div style="font-size: 14px;">No commit history found for the selected components and environments.</div>
        </td>
      </tr>
    `;
  } else {
    historyArray.forEach(item => {
      const { component_name, component_type, orgA, orgB } = item;
      
      const orgACommits = orgA || [];
      const orgBCommits = orgB || [];
      
      // Identify unique commits for highlighting
      const orgAHashes = new Set(orgACommits.map(commit => commit.hash));
      const orgBHashes = new Set(orgBCommits.map(commit => commit.hash));

      // Calculate max rows needed for this component
      const maxRows = Math.max(
        Math.min(orgACommits.length, limit),
        Math.min(orgBCommits.length, limit),
        1 // At least one row for "no commits"
      );

      html += `
        <tr class="component-row" data-component="${component_name}" data-type="${component_type}">
          <td style="font-weight: 600; color: #1d1d1f;" rowspan="${maxRows}">
            ${component_name}
          </td>
          <td rowspan="${maxRows}">
            <span class="component-type">${component_type}</span>
          </td>
      `;

      // Generate commit rows
      for (let i = 0; i < maxRows; i++) {
        if (i > 0) {
          html += `<tr class="component-row" data-component="${component_name}" data-type="${component_type}">`;
        }

        // Org A commit cell
        if (i < orgACommits.length && i < limit) {
          const commit = orgACommits[i];
          const isUnique = !orgBHashes.has(commit.hash);
          const rowClass = isUnique ? 'commit-row unique' : 'commit-row common';
          const statusBadge = isUnique ? '<span class="status-badge status-unique">UNIQUE</span>' : '<span class="status-badge status-common">COMMON</span>';
          
          html += `
            <td class="${rowClass}">
              <div class="commit-message">
                ${commit.message || 'No commit message'}
                ${statusBadge}
              </div>
              <div class="commit-meta">
                <span class="commit-author">${formatAuthor(commit.author)}</span>
                <span class="commit-date">${formatDetailedDate(commit.date)}</span>
                ${commit.hash ? `<span><code class="commit-hash">${commit.hash.substring(0, 7)}</code></span>` : ''}
              </div>
            </td>
          `;
        } else if (i === 0 && orgACommits.length === 0) {
          html += `
            <td>
              <div class="no-commits">No commits found</div>
            </td>
          `;
        } else {
          html += `<td></td>`;
        }

        // Org B commit cell
        if (i < orgBCommits.length && i < limit) {
          const commit = orgBCommits[i];
          const isUnique = !orgAHashes.has(commit.hash);
          const rowClass = isUnique ? 'commit-row unique' : 'commit-row common';
          const statusBadge = isUnique ? '<span class="status-badge status-unique">UNIQUE</span>' : '<span class="status-badge status-common">COMMON</span>';
          
          html += `
            <td class="${rowClass}">
              <div class="commit-message">
                ${commit.message || 'No commit message'}
                ${statusBadge}
              </div>
              <div class="commit-meta">
                <span class="commit-author">${formatAuthor(commit.author)}</span>
                <span class="commit-date">${formatDetailedDate(commit.date)}</span>
                ${commit.hash ? `<span><code class="commit-hash">${commit.hash.substring(0, 7)}</code></span>` : ''}
              </div>
            </td>
          `;
        } else if (i === 0 && orgBCommits.length === 0) {
          html += `
            <td>
              <div class="no-commits">No commits found</div>
            </td>
          `;
        } else {
          html += `<td></td>`;
        }

        html += `</tr>`;
      }

      // Add overflow indicator if needed
      const orgAOverflow = orgACommits.length > limit;
      const orgBOverflow = orgBCommits.length > limit;
      
      if (orgAOverflow || orgBOverflow) {
        html += `
          <tr class="component-row" data-component="${component_name}" data-type="${component_type}">
            <td colspan="2" style="background: #f8f9fa; font-size: 11px; color: #666; text-align: center;">
              ${orgAOverflow ? `+${orgACommits.length - limit} more commits in ${envA.label}` : ''}
              ${orgAOverflow && orgBOverflow ? ' • ' : ''}
              ${orgBOverflow ? `+${orgBCommits.length - limit} more commits in ${envB.label}` : ''}
            </td>
            <td style="background: #f8f9fa;"></td>
            <td style="background: #f8f9fa;"></td>
          </tr>
        `;
      }
    });
  }

  html += `
      </tbody>
    </table>
  `;

  return html;
}

/**
 * Format detailed date for commit display
 */
function formatDetailedDate(dateString) {
  if (!dateString) return 'N/A';
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return dateString;
  }
}

/**
 * Filter expanded history table
 */
function filterExpandedHistoryTable(modalId) {
  const modal = document.getElementById(modalId);
  const searchInput = modal.querySelector('.search-input-' + modalId);
  const typeFilter = modal.querySelector('.filter-type-' + modalId);

  const searchTerm = searchInput.value.toLowerCase();
  const typeValue = typeFilter.value;

  const rows = modal.querySelectorAll('tbody tr.component-row');

  let visibleComponents = new Set();

  // First pass: determine which components to show
  rows.forEach(row => {
    const componentName = row.getAttribute('data-component').toLowerCase();
    const componentType = row.getAttribute('data-type');

    let show = true;

    // Search filter
    if (searchTerm && !componentName.includes(searchTerm)) {
      show = false;
    }

    // Type filter
    if (typeValue && componentType !== typeValue) {
      show = false;
    }

    if (show) {
      visibleComponents.add(componentName);
    }
  });

  // Second pass: show/hide rows based on component visibility
  rows.forEach(row => {
    const componentName = row.getAttribute('data-component');
    const shouldShow = visibleComponents.has(componentName);
    row.style.display = shouldShow ? '' : 'none';
  });

  // Update results summary
  const summary = modal.querySelector('[style*="background: #f8f9fa"]');
  if (summary) {
    const totalCount = visibleComponents.size;
    const allComponents = new Set(Array.from(rows).map(row => row.getAttribute('data-component')));
    const totalComponents = allComponents.size;
    
    if (totalCount === totalComponents) {
      summary.innerHTML = `<strong>${totalComponents}</strong> components compared • Showing up to <strong>${modal.dataset.limit}</strong> commits per component`;
    } else {
      summary.innerHTML = `<strong>${totalCount}</strong> of <strong>${totalComponents}</strong> components • Filtered results`;
    }
  }
}

/**
 * Export expanded history as CSV
 */
function exportExpandedHistoryAsCSV(modalId) {
  const modal = document.getElementById(modalId);
  const exportData = JSON.parse(modal.dataset.exportData);
  const { result, environments, limit } = exportData;
  const { results = {} } = result;

  let csv = 'Component,Type,Environment,Commit Number,Author,Date,Commit Hash,Message,Status\n';

  Object.entries(results).forEach(([componentKey, componentData]) => {
    const [component_type, component_name] = componentKey.split('/');
    const orgACommits = componentData.orgA || [];
    const orgBCommits = componentData.orgB || [];
    
    const orgAHashes = new Set(orgACommits.map(commit => commit.hash));
    const orgBHashes = new Set(orgBCommits.map(commit => commit.hash));

    // Org A commits
    orgACommits.slice(0, limit).forEach((commit, index) => {
      const isUnique = !orgBHashes.has(commit.hash);
      const status = isUnique ? 'Unique to ' + environments[0].label : 'Common';
      
      const row = [
        component_name,
        component_type,
        environments[0].label,
        index + 1,
        `"${formatAuthor(commit.author)}"`,
        `"${formatDetailedDate(commit.date)}"`,
        commit.hash || '',
        `"${(commit.message || '').replace(/"/g, '""')}"`,
        status
      ];
      
      csv += row.join(',') + '\n';
    });

    // Org B commits
    orgBCommits.slice(0, limit).forEach((commit, index) => {
      const isUnique = !orgAHashes.has(commit.hash);
      const status = isUnique ? 'Unique to ' + environments[1].label : 'Common';
      
      const row = [
        component_name,
        component_type,
        environments[1].label,
        index + 1,
        `"${formatAuthor(commit.author)}"`,
        `"${formatDetailedDate(commit.date)}"`,
        commit.hash || '',
        `"${(commit.message || '').replace(/"/g, '""')}"`,
        status
      ];
      
      csv += row.join(',') + '\n';
    });
  });

  // Download CSV
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `history-comparison-detailed-${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
  URL.revokeObjectURL(url);

  showExportSuccess();
}

/**
 * Export expanded history as JSON
 */
function exportExpandedHistoryAsJSON(modalId) {
  const modal = document.getElementById(modalId);
  const exportData = JSON.parse(modal.dataset.exportData);
  const { result, environments } = exportData;
  const { results = {}, meta = {} } = result;

  const jsonData = {
    exportedAt: new Date().toISOString(),
    metadata: {
      environments: environments.map(env => ({
        label: env.label,
        branch: env.branch,
        key: env.key
      })),
      componentCount: Object.keys(results).length,
      apiMeta: meta
    },
    components: Object.entries(results).map(([componentKey, componentData]) => {
      const [component_type, component_name] = componentKey.split('/');
      const orgACommits = componentData.orgA || [];
      const orgBCommits = componentData.orgB || [];
      
      const orgAHashes = new Set(orgACommits.map(commit => commit.hash));
      const orgBHashes = new Set(orgBCommits.map(commit => commit.hash));

      return {
        component_name,
        component_type,
        orgA: {
          commit_count: orgACommits.length,
          commits: orgACommits.map((commit, index) => ({
            commit_number: index + 1,
            author: formatAuthor(commit.author),
            date: commit.date,
            hash: commit.hash,
            message: commit.message,
            status: orgBHashes.has(commit.hash) ? 'common' : 'unique'
          }))
        },
        orgB: {
          commit_count: orgBCommits.length,
          commits: orgBCommits.map((commit, index) => ({
            commit_number: index + 1,
            author: formatAuthor(commit.author),
            date: commit.date,
            hash: commit.hash,
            message: commit.message,
            status: orgAHashes.has(commit.hash) ? 'common' : 'unique'
          }))
        }
      };
    })
  };

  const jsonStr = JSON.stringify(jsonData, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `history-comparison-detailed-${new Date().toISOString().split('T')[0]}.json`;
  link.click();
  URL.revokeObjectURL(url);

  showExportSuccess();
}

/**
 * Show enhanced comparison results with improved table

// ===== ENHANCED FUNCTIONS =====
/**
 * Create enhanced loading modal with environment info
 */
function createEnhancedLoadingModal(message, environments) {
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

  const [envA, envB] = environments;

  modal.innerHTML = `
    <div style="
      background: white;
      border-radius: 18px;
      padding: 40px;
      text-align: center;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      animation: slideUp 0.3s ease-out;
      min-width: 400px;
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
      
      <!-- Environment Progress -->
      <div style="
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 16px;
        margin: 20px 0;
      ">
        <div style="text-align: center;">
          <div style="font-size: 24px; margin-bottom: 4px;">${envA.icon}</div>
          <div style="font-size: 12px; font-weight: 600; color: #666;">${envA.label}</div>
          <div style="font-size: 10px; color: #999;">${envA.branch}</div>
        </div>
        <div style="text-align: center;">
          <div style="font-size: 24px; margin-bottom: 4px;">${envB.icon}</div>
          <div style="font-size: 12px; font-weight: 600; color: #666;">${envB.label}</div>
          <div style="font-size: 10px; color: #999;">${envB.branch}</div>
        </div>
      </div>
      
      <p style="font-size: 13px; color: #666666; margin: 0; font-weight: 500;">
        Comparing commit history across environments...
      </p>
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
 * Show enhanced comparison results with improved table
 */



/**
 * Generate enhanced history comparison table
 */
function generateEnhancedHistoryTable(history, components, envA, envB, limit) {
  let html = `
    <table class="enhanced-history-table">
      <thead>
        <tr>
          <th style="width: 200px;">Component</th>
          <th style="width: 100px;">Type</th>
          <th style="width: 350px;" class="environment-header">
            ${envA.icon} ${envA.label}
            <div class="commit-count">Up to ${limit} commits</div>
          </th>
          <th style="width: 350px;" class="environment-header">
            ${envB.icon} ${envB.label}
            <div class="commit-count">Up to ${limit} commits</div>
          </th>
        </tr>
      </thead>
      <tbody>
  `;

  if (history.length === 0) {
    html += `
      <tr>
        <td colspan="4" style="text-align: center; padding: 40px; color: #666;">
          <div style="font-size: 48px; margin-bottom: 16px;">📭</div>
          <div style="font-size: 16px; font-weight: 600; margin-bottom: 8px;">No History Data</div>
          <div style="font-size: 14px;">No commit history found for the selected components and environments.</div>
        </td>
      </tr>
    `;
  } else {
    history.forEach(item => {
      const { component_name, component_type, orgA, orgB } = item;
      
      const orgACommits = orgA?.commits || [];
      const orgBCommits = orgB?.commits || [];
      
      // Identify unique commits for highlighting
      const orgAHashes = new Set(orgACommits.map(commit => commit.hash));
      const orgBHashes = new Set(orgBCommits.map(commit => commit.hash));

      html += `
        <tr data-component="${component_name}" data-type="${component_type}">
          <td style="font-weight: 600; color: #1d1d1f;">
            ${component_name}
          </td>
          <td>
            <span class="component-type">${component_type}</span>
          </td>
          <td>
      `;

      // Org A commits
      if (orgACommits.length > 0) {
        orgACommits.slice(0, limit).forEach(commit => {
          const isUnique = !orgBHashes.has(commit.hash);
          const cardClass = isUnique ? 'commit-card unique' : 'commit-card common';
          
          html += `
            <div class="${cardClass}">
              <div class="commit-message">${commit.message || 'No commit message'}</div>
              <div class="commit-meta">
                <span><strong>By:</strong> ${formatAuthor(commit.author)}</span>
                <span><strong>Date:</strong> ${formatDate(commit.date)}</span>
                ${commit.hash ? `<span><strong>Commit:</strong> <code class="commit-hash">${commit.hash.substring(0, 7)}</code></span>` : ''}
                ${isUnique ? '<span style="color: #ff6b6b; font-weight: 600;">UNIQUE</span>' : ''}
              </div>
            </div>
          `;
        });
        
        if (orgACommits.length > limit) {
          html += `
            <div style="text-align: center; font-size: 11px; color: #666666; margin-top: 8px; padding: 8px; background: #f0f0f0; border-radius: 4px;">
              +${orgACommits.length - limit} more commits (showing ${limit})
            </div>
          `;
        }
      } else {
        html += `<div class="no-commits">No commits found</div>`;
      }

      html += `
          </td>
          <td>
      `;

      // Org B commits
      if (orgBCommits.length > 0) {
        orgBCommits.slice(0, limit).forEach(commit => {
          const isUnique = !orgAHashes.has(commit.hash);
          const cardClass = isUnique ? 'commit-card unique' : 'commit-card common';
          
          html += `
            <div class="${cardClass}">
              <div class="commit-message">${commit.message || 'No commit message'}</div>
              <div class="commit-meta">
                <span><strong>By:</strong> ${formatAuthor(commit.author)}</span>
                <span><strong>Date:</strong> ${formatDate(commit.date)}</span>
                ${commit.hash ? `<span><strong>Commit:</strong> <code class="commit-hash">${commit.hash.substring(0, 7)}</code></span>` : ''}
                ${isUnique ? '<span style="color: #ff6b6b; font-weight: 600;">UNIQUE</span>' : ''}
              </div>
            </div>
          `;
        });
        
        if (orgBCommits.length > limit) {
          html += `
            <div style="text-align: center; font-size: 11px; color: #666666; margin-top: 8px; padding: 8px; background: #f0f0f0; border-radius: 4px;">
              +${orgBCommits.length - limit} more commits (showing ${limit})
            </div>
          `;
        }
      } else {
        html += `<div class="no-commits">No commits found</div>`;
      }

      html += `
          </td>
        </tr>
      `;
    });
  }

  html += `
      </tbody>
    </table>
  `;

  return html;
}

/**
 * Show enhanced comparison results with improved compact table

/**
 * Generate compact history comparison table

/**
 * Generate environment section with commit summary
 */
function generateEnvironmentSection(commits, environment) {
  if (!commits || commits.length === 0) {
    return `
      <div class="environment-section">
        <div class="commit-count" style="color: #ff6b6b;">0 commits</div>
        <div class="no-commits">No commits found</div>
      </div>
    `;
  }

  const latestCommit = commits[0]; // Most recent commit is first
  const commitCount = commits.length;

  return `
    <div class="environment-section">
      <div class="commit-count">${commitCount} commit${commitCount !== 1 ? 's' : ''}</div>
      <div class="latest-commit">
        <div class="author-name">${formatAuthor(latestCommit.author)}</div>
        <div>${truncateMessage(latestCommit.message || 'No commit message', 40)}</div>
        <div class="commit-date">${formatCompactDate(latestCommit.date)}</div>
      </div>
    </div>
  `;
}

/**
 * Calculate sync status between two commit arrays
 */
function calculateSyncStatus(orgACommits, orgBCommits) {
  if (orgACommits.length === 0 && orgBCommits.length === 0) {
    return '🟢'; // Both empty - considered in sync
  }

  if (orgACommits.length === 0 || orgBCommits.length === 0) {
    return '🔴'; // One has commits, other doesn't - out of sync
  }

  // Check if latest commits match
  const latestA = orgACommits[0];
  const latestB = orgBCommits[0];

  if (latestA.hash === latestB.hash) {
    // Check if all commits match (simple check)
    const aHashes = orgACommits.map(c => c.hash);
    const bHashes = orgBCommits.map(c => c.hash);
    
    const allMatch = aHashes.length === bHashes.length && 
                    aHashes.every((hash, index) => hash === bHashes[index]);
    
    return allMatch ? '🟢' : '🟡';
  }

  return '🔴';
}

/**
 * Truncate commit message
 */
function truncateMessage(message, maxLength) {
  if (!message) return 'No commit message';
  if (message.length <= maxLength) return message;
  return message.substring(0, maxLength) + '...';
}

/**
 * Compact date formatting
 */
function formatCompactDate(dateString) {
  if (!dateString) return 'N/A';
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return 'Today';
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays}d ago`;
    } else if (diffDays < 30) {
      return `${Math.floor(diffDays / 7)}w ago`;
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      });
    }
  } catch {
    return dateString;
  }
}

/**
 * Filter compact history table
 */
function filterCompactHistoryTable(modalId) {
  const modal = document.getElementById(modalId);
  const searchInput = modal.querySelector('.search-input-' + modalId);
  const typeFilter = modal.querySelector('.filter-type-' + modalId);
  const statusFilter = modal.querySelector('.filter-status-' + modalId);

  const searchTerm = searchInput.value.toLowerCase();
  const typeValue = typeFilter.value;
  const statusValue = statusFilter.value;

  const rows = modal.querySelectorAll('tbody tr[data-component]');

  let visibleCount = 0;

  rows.forEach(row => {
    const componentName = row.getAttribute('data-component').toLowerCase();
    const componentType = row.getAttribute('data-type');
    const componentStatus = row.getAttribute('data-status');

    let show = true;

    // Search filter
    if (searchTerm && !componentName.includes(searchTerm)) {
      show = false;
    }

    // Type filter
    if (typeValue && componentType !== typeValue) {
      show = false;
    }

    // Status filter
    if (statusValue && componentStatus !== statusValue) {
      show = false;
    }

    row.style.display = show ? '' : 'none';
    if (show) visibleCount++;
  });

  // Update results summary
  const summary = modal.querySelector('[style*="background: #f8f9fa"]');
  if (summary) {
    const totalCount = rows.length;
    const countElement = summary.querySelector('div:first-child');
    if (countElement) {
      if (visibleCount === totalCount) {
        countElement.innerHTML = `<strong>${totalCount}</strong> components • Limit: <strong>${modal.dataset.limit}</strong> commits per component`;
      } else {
        countElement.innerHTML = `<strong>${visibleCount}</strong> of <strong>${totalCount}</strong> components • Filtered results`;
      }
    }
  }
}

/**
 * Export compact history as CSV
 */
function exportCompactHistoryAsCSV(modalId) {
  const modal = document.getElementById(modalId);
  const exportData = JSON.parse(modal.dataset.exportData);
  const { result, environments } = exportData;
  const { results = {} } = result;

  let csv = 'Component,Type,Environment,Commit Count,Latest Author,Latest Date,Latest Message,Status\n';

  Object.entries(results).forEach(([componentKey, componentData]) => {
    const [component_type, component_name] = componentKey.split('/');
    const orgACommits = componentData.orgA || [];
    const orgBCommits = componentData.orgB || [];
    
    const status = calculateSyncStatus(orgACommits, orgBCommits);

    // Org A data
    const latestA = orgACommits[0];
    const rowA = [
      component_name,
      component_type,
      environments[0].label,
      orgACommits.length,
      `"${formatAuthor(latestA?.author)}"`,
      `"${formatCompactDate(latestA?.date)}"`,
      `"${(latestA?.message || '').replace(/"/g, '""')}"`,
      status
    ];
    csv += rowA.join(',') + '\n';

    // Org B data
    const latestB = orgBCommits[0];
    const rowB = [
      component_name,
      component_type,
      environments[1].label,
      orgBCommits.length,
      `"${formatAuthor(latestB?.author)}"`,
      `"${formatCompactDate(latestB?.date)}"`,
      `"${(latestB?.message || '').replace(/"/g, '""')}"`,
      status
    ];
    csv += rowB.join(',') + '\n';
  });

  // Download CSV
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `history-comparison-compact-${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
  URL.revokeObjectURL(url);

  showExportSuccess();
}

/**
 * Export compact history as JSON
 */
function exportCompactHistoryAsJSON(modalId) {
  const modal = document.getElementById(modalId);
  const exportData = JSON.parse(modal.dataset.exportData);
  const { result, environments } = exportData;
  const { results = {}, meta = {} } = result;

  const jsonData = {
    exportedAt: new Date().toISOString(),
    metadata: {
      environments: environments.map(env => ({
        label: env.label,
        branch: env.branch,
        key: env.key
      })),
      componentCount: Object.keys(results).length,
      apiMeta: meta
    },
    components: Object.entries(results).map(([componentKey, componentData]) => {
      const [component_type, component_name] = componentKey.split('/');
      const orgACommits = componentData.orgA || [];
      const orgBCommits = componentData.orgB || [];
      
      return {
        component_name,
        component_type,
        status: calculateSyncStatus(orgACommits, orgBCommits),
        orgA: {
          commit_count: orgACommits.length,
          latest_commit: orgACommits[0] || null
        },
        orgB: {
          commit_count: orgBCommits.length,
          latest_commit: orgBCommits[0] || null
        }
      };
    })
  };

  const jsonStr = JSON.stringify(jsonData, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `history-comparison-compact-${new Date().toISOString().split('T')[0]}.json`;
  link.click();
  URL.revokeObjectURL(url);

  showExportSuccess();
}

/**
 * Format author name (extract from email format if needed)
 */
function formatAuthor(authorString) {
  if (!authorString) return 'Unknown';
  
  // If it's in "Name <email>" format, extract just the name
  const match = authorString.match(/^([^<]+)</);
  if (match) {
    return match[1].trim();
  }
  
  return authorString;
}

/**
 * Enhanced date formatting
 */
function formatDate(dateString) {
  if (!dateString) return 'N/A';
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return 'Today ' + date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Yesterday ' + date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    }
  } catch {
    return dateString;
  }
}

/**
 * Filter history table based on search and type
 */
function filterHistoryTable(modalId) {
  const modal = document.getElementById(modalId);
  const searchInput = modal.querySelector('.search-input-' + modalId);
  const typeFilter = modal.querySelector('.filter-type-' + modalId);

  const searchTerm = searchInput.value.toLowerCase();
  const typeValue = typeFilter.value;

  const rows = modal.querySelectorAll('tbody tr[data-component]');

  let visibleCount = 0;

  rows.forEach(row => {
    const componentName = row.getAttribute('data-component').toLowerCase();
    const componentType = row.getAttribute('data-type');

    let show = true;

    // Search filter
    if (searchTerm && !componentName.includes(searchTerm)) {
      show = false;
    }

    // Type filter
    if (typeValue && componentType !== typeValue) {
      show = false;
    }

    row.style.display = show ? '' : 'none';
    if (show) visibleCount++;
  });

  // Update results summary
  const summary = modal.querySelector('[style*="background: #f8f9fa"]');
  if (summary) {
    const totalCount = rows.length;
    if (visibleCount === totalCount) {
      summary.innerHTML = `<strong>${totalCount}</strong> components compared • Limit: <strong>${modal.dataset.limit}</strong> commits per component`;
    } else {
      summary.innerHTML = `<strong>${visibleCount}</strong> of <strong>${totalCount}</strong> components • Filtered results`;
    }
  }
}

/**
/**
 * Export history as CSV
 */
function exportHistoryAsCSV(modalId) {
  const modal = document.getElementById(modalId);
  const exportData = JSON.parse(modal.dataset.exportData);
  const { result, environments, limit } = exportData;
  const { results = {} } = result;

  let csv = 'Component,Type,Environment,Commit Hash,Author,Date,Message,Status\n';

  Object.entries(results).forEach(([componentKey, componentData]) => {
    const [component_type, component_name] = componentKey.split('/');
    const orgACommits = componentData.orgA || [];
    const orgBCommits = componentData.orgB || [];
    
    const orgAHashes = new Set(orgACommits.map(commit => commit.hash));
    const orgBHashes = new Set(orgBCommits.map(commit => commit.hash));

    // Org A commits
    orgACommits.slice(0, limit).forEach(commit => {
      const isUnique = !orgBHashes.has(commit.hash);
      const status = isUnique ? 'Unique to ' + environments[0].label : 'Common';
      
      const row = [
        component_name,
        component_type,
        environments[0].label,
        commit.hash || '',
        `"${formatAuthor(commit.author)}"`,
        `"${formatDate(commit.date)}"`,
        `"${(commit.message || '').replace(/"/g, '""')}"`,
        status
      ];
      
      csv += row.join(',') + '\n';
    });

    // Org B commits
    orgBCommits.slice(0, limit).forEach(commit => {
      const isUnique = !orgAHashes.has(commit.hash);
      const status = isUnique ? 'Unique to ' + environments[1].label : 'Common';
      
      const row = [
        component_name,
        component_type,
        environments[1].label,
        commit.hash || '',
        `"${formatAuthor(commit.author)}"`,
        `"${formatDate(commit.date)}"`,
        `"${(commit.message || '').replace(/"/g, '""')}"`,
        status
      ];
      
      csv += row.join(',') + '\n';
    });
  });

  // Download CSV
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `history-comparison-${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
  URL.revokeObjectURL(url);

  showExportSuccess();
}

/**
 * Export history as JSON
 */
function exportHistoryAsJSON(modalId) {
  const modal = document.getElementById(modalId);
  const exportData = JSON.parse(modal.dataset.exportData);
  const { result, environments, limit } = exportData;
  const { results = {}, meta = {} } = result;

  const jsonData = {
    exportedAt: new Date().toISOString(),
    metadata: {
      limit: limit,
      environments: environments.map(env => ({
        label: env.label,
        branch: env.branch,
        key: env.key
      })),
      componentCount: Object.keys(results).length,
      apiMeta: meta
    },
    history: Object.entries(results).map(([componentKey, componentData]) => {
      const [component_type, component_name] = componentKey.split('/');
      return {
        component_name,
        component_type,
        orgA: {
          commit_count: (componentData.orgA || []).length,
          commits: componentData.orgA || []
        },
        orgB: {
          commit_count: (componentData.orgB || []).length,
          commits: componentData.orgB || []
        }
      };
    })
  };

  const jsonStr = JSON.stringify(jsonData, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `history-comparison-${new Date().toISOString().split('T')[0]}.json`;
  link.click();
  URL.revokeObjectURL(url);

  showExportSuccess();
}

/**
 * Show export success notification
 */
function showExportSuccess() {
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: #388e3c;
    color: white;
    padding: 14px 20px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 600;
    z-index: 20000;
    animation: slideIn 0.3s ease-out;
  `;
  notification.textContent = '✓ Export completed successfully!';
  document.body.appendChild(notification);

  setTimeout(() => notification.remove(), 3000);
}

export default { runMultiOrgHistory };