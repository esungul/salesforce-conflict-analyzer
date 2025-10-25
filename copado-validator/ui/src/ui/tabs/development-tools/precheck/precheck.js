// src/ui/tabs/development-tools/precheck/precheck-multi-org.js
// Multi-Org Multi-Environment Pre-Check Tool
// Supports checking multiple components across multiple environments simultaneously

import { checkProductionState } from '../../../../api/endpoints.js';
import COMPONENT_CONFIG from '../../../../config/component-config.js';

/**
 * Make parallel API calls for multiple branches
 */
async function checkProductionStateMultiBranchWithProgress(
  components,
  branches,
  onProgress = null
) {
  console.log('📡 Making PARALLEL API calls for', branches.length, 'branches...');

  let completed = 0;

  const promises = branches.map(branch => {
    console.log(`📡 Calling API for branch: ${branch}`);

    const payload = {
      components: components,
      branch: branch
    };

    return checkProductionState(payload)
      .then(response => {
        completed++;

        if (onProgress) {
          onProgress({
            branch: branch,
            completed: completed,
            total: branches.length,
            percentage: Math.round((completed / branches.length) * 100)
          });
        }

        console.log(`✅ ${branch}: ${completed}/${branches.length}`);

        return {
          branch: branch,
          data: response
        };
      })
      .catch(error => {
        completed++;

        if (onProgress) {
          onProgress({
            branch: branch,
            completed: completed,
            total: branches.length,
            percentage: Math.round((completed / branches.length) * 100),
            error: error.message
          });
        }

        console.log(`❌ ${branch}: ${completed}/${branches.length} -`, error.message);

        return {
          branch: branch,
          data: null,
          error: error.message
        };
      });
  });

  console.log('⏳ Waiting for all parallel API calls to complete...');
  const results = await Promise.all(promises);

  console.log('✅ All parallel API calls completed');

  return {
    results: results.reduce((acc, r) => {
      acc[r.branch] = r.data || { components: [], meta: { error: r.error } };
      return acc;
    }, {}),
    summary: {
      total_branches: branches.length,
      successful: results.filter(r => r.data).length,
      failed: results.filter(r => !r.data).length
    }
  };
}

/**
 * Run Pre-Check Tool - Multi-Org with Parallel API Calls
 */
export async function runPrecheck(components, branch = 'master') {
  console.log('🛡️ Pre-check triggered with components:', components);

  try {
    // ===== STEP 1: Add components with types =====
    let componentsWithTypes = [];

    if (components && components.length > 0) {
      componentsWithTypes = components.map(comp => {
        if (typeof comp === 'object' && comp.name && comp.type) {
          return comp;
        }
        return null;
      }).filter(c => c !== null);
    }

    if (!componentsWithTypes || componentsWithTypes.length === 0) {
      console.log('No components provided, showing input UI...');
      componentsWithTypes = await showComponentInputUI();
      console.log('User provided components:', componentsWithTypes);
    }

    if (!componentsWithTypes || componentsWithTypes.length === 0) {
      const errorModal = createErrorModal(
        'No Components',
        'Please provide at least one component to validate',
        '📦'
      );
      document.body.appendChild(errorModal);
      return;
    }

    // ===== STEP 2: Get options (multi-environment selection + filter) =====
    const options = await promptForMultiEnvOptions();
    console.log('User selected options:', options);

    console.log('✅ Found', componentsWithTypes.length, 'components for', options.branches.length, 'environments');

    // ===== STEP 3: Show loading modal with progress tracking =====
    const loadingModal = createLoadingModalWithProgress('Validating across environments...');
    document.body.appendChild(loadingModal);

    // ===== STEP 4: PARALLEL API CALLS - One per branch =====
    console.log('📡 Starting PARALLEL validation across:', options.branches);
    const result = await checkProductionStateMultiBranchWithProgress(
      componentsWithTypes,
      options.branches,
      (progress) => {
        updateLoadingProgress(loadingModal, progress);
      }
    );

    console.log('✅ All API calls completed:', result);

    // ===== STEP 5: Hide loading =====
    loadingModal.remove();

    // ===== STEP 6: Map multi-org API response to UI format =====
    const mappedResult = mapMultiOrgResponseToUIFormat(result);
    console.log('✅ Mapped Multi-Org Response:', mappedResult);

    // ===== STEP 7: Apply filters =====
    const filteredResult = applyFiltersMultiOrg(mappedResult, options.filter);
    console.log('✅ Filtered Results:', filteredResult);

    // ===== STEP 8: Display multi-org results in TABLE FORMAT =====
    const resultModal = createTableComparisonModal(filteredResult, componentsWithTypes, options);
    document.body.appendChild(resultModal);

    console.log('✅ Pre-check complete');

  } catch (error) {
    console.error('❌ Pre-check error:', error);
    document.querySelectorAll('[id^="loading-modal"]').forEach(m => m.remove());

    const errorModal = createErrorModal(
      'Pre-Check Error',
      error.message || 'An error occurred during validation',
      '⚠️'
    );
    document.body.appendChild(errorModal);
  }
}

/**
 * Show UI to add components with DIFFERENT types
 */
async function showComponentInputUI() {
  return new Promise((resolve) => {
    const modal = document.createElement('div');
    const modalId = 'component-builder-modal-' + Date.now();
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
        <div style="font-size: 60px; margin-bottom: 20px;">📦</div>
        <h2 style="
          font-size: 22px;
          font-weight: 600;
          margin: 0 0 12px 0;
          color: #1d1d1f;
        ">
          Add Components to Validate
        </h2>
        <p style="
          font-size: 14px;
          color: #666666;
          margin: 0 0 24px 0;
          line-height: 1.5;
        ">
          Add each component with its type. You can mix different types!
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
 * Prompt for multi-environment options with checkboxes
 */
async function promptForMultiEnvOptions() {
  return new Promise((resolve) => {
    const modal = document.createElement('div');
    const modalId = 'options-modal-' + Date.now();
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
    const filtersArray = COMPONENT_CONFIG.getFiltersArray();

    const submitHandler = function() {
      const envCheckboxes = modal.querySelectorAll('input[name="environment"]');
      const selectedEnvironments = [];
      
      for (let checkbox of envCheckboxes) {
        if (checkbox.checked) {
          selectedEnvironments.push(checkbox.value);
        }
      }

      if (selectedEnvironments.length === 0) {
        alert('Please select at least one environment');
        return;
      }

      const filterRadios = modal.querySelectorAll('input[name="filter"]');
      let selectedFilter = 'all';
      for (let radio of filterRadios) {
        if (radio.checked) {
          selectedFilter = radio.value;
          break;
        }
      }
      
      modal.remove();
      resolve({
        branches: selectedEnvironments,
        filter: selectedFilter
      });
    };

    modal.innerHTML = `
      <div style="
        background: white;
        border-radius: 18px;
        padding: 40px;
        max-width: 600px;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        animation: slideUp 0.3s ease-out;
      ">
        <div style="font-size: 50px; margin-bottom: 20px;">⚙️</div>
        <h2 style="
          font-size: 22px;
          font-weight: 600;
          margin: 0 0 24px 0;
          color: #1d1d1f;
        ">
          Pre-Check Options
        </h2>

        <!-- Environment Selection (Multi-Select) -->
        <div style="margin-bottom: 32px;">
          <label style="
            display: block;
            font-size: 13px;
            font-weight: 600;
            color: #1d1d1f;
            margin-bottom: 12px;
          ">
            Select Environments (You can choose multiple)
          </label>
          <div style="display: flex; flex-direction: column; gap: 10px;">
            ${environmentsArray.map(env => `
              <label style="
                display: flex;
                align-items: center;
                cursor: pointer;
                font-size: 14px;
                padding: 10px;
                border-radius: 8px;
                transition: background 0.2s;
              " onmouseover="this.style.background='#f5f5f7'" onmouseout="this.style.background='white'">
                <input type="checkbox" name="environment" value="${env.value}" 
                  style="margin-right: 8px; width: 18px; height: 18px; cursor: pointer;">
                <span>
                  <strong>${env.icon} ${env.label}</strong>
                  <div style="font-size: 12px; color: #999999; margin-top: 2px;">
                    Risk: ${env.risk.toUpperCase()} - ${env.description}
                  </div>
                </span>
              </label>
            `).join('')}
          </div>
        </div>

        <!-- Filter Options -->
        <div style="margin-bottom: 32px;">
          <label style="
            display: block;
            font-size: 13px;
            font-weight: 600;
            color: #1d1d1f;
            margin-bottom: 12px;
          ">
            Filter Results
          </label>
          <div style="display: flex; flex-direction: column; gap: 10px;">
            ${filtersArray.map(filter => `
              <label style="display: flex; align-items: center; cursor: pointer; font-size: 14px;">
                <input type="radio" name="filter" value="${filter.value}" 
                  ${filter.id === 'all' ? 'checked' : ''} 
                  style="margin-right: 8px;">
                <span><strong>${filter.label}</strong></span>
              </label>
              <p style="
                font-size: 12px;
                color: #999999;
                margin: -8px 0 0 24px;
              ">
                ${filter.description}
              </p>
            `).join('')}
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
            Validate
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
    const submitBtn = modal.querySelector(`#submitBtn-${modalId}`);
    submitBtn.addEventListener('click', submitHandler);
  });
}

/**
 * Map multi-org API response to UI format
 */
function mapMultiOrgResponseToUIFormat(apiResponse) {
  const mappedResults = {};

  for (const [branch, branchData] of Object.entries(apiResponse.results || {})) {
    mappedResults[branch] = {
      components: (branchData.components || []).map(comp => ({
        component_name: comp.name,
        component_type: comp.type,
        exists_in_prod: comp.exists === true,
        file_path: comp.file_path || null,
        file_size: comp.file_size || 0,
        last_author: comp.author || null,
        last_commit_date: comp.commit_date || null,
        last_commit_hash: comp.commit_sha || null,
        last_commit_message: comp.commit_message || null,
        branch: branch
      })),
      meta: {
        total: branchData.meta?.total || 0,
        existing: branchData.meta?.existing || 0,
        missing: branchData.meta?.missing || 0
      }
    };
  }

  return {
    results: mappedResults,
    branches: Object.keys(mappedResults)
  };
}

/**
 * Apply filters to multi-org results
 */
function applyFiltersMultiOrg(mappedResult, filterType) {
  const filtered = { ...mappedResult, results: {} };

  for (const [branch, branchData] of Object.entries(mappedResult.results)) {
    let filteredComponents = branchData.components;

    if (filterType === 'existing') {
      filteredComponents = branchData.components.filter(c => c.exists_in_prod === true);
    } else if (filterType === 'missing') {
      filteredComponents = branchData.components.filter(c => c.exists_in_prod === false);
    }

    filtered.results[branch] = {
      components: filteredComponents,
      meta: {
        total: filteredComponents.length,
        existing: filteredComponents.filter(c => c.exists_in_prod).length,
        missing: filteredComponents.filter(c => !c.exists_in_prod).length
      }
    };
  }

  return filtered;
}

/**
 * Create loading modal with progress tracking
 */
function createLoadingModalWithProgress(message = 'Loading...') {
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
      <div class="loading-content" style="
        width: 40px;
        height: 40px;
        margin: 0 auto 16px;
        border: 3px solid #e5e5e7;
        border-top-color: #0071e3;
        border-radius: 50%;
        animation: spin 1s linear infinite;
      "></div>
      <p style="font-size: 15px; color: #666666; margin: 0 0 16px; font-weight: 500;">
        ${message}
      </p>
      <div style="
        width: 100%;
        height: 4px;
        background: #e5e5e7;
        border-radius: 2px;
        overflow: hidden;
        margin: 0 0 12px 0;
      ">
        <div class="progress-bar" style="
          width: 0%;
          height: 100%;
          background: linear-gradient(90deg, #0071e3, #00a8ff);
          transition: width 0.3s;
        "></div>
      </div>
      <p class="progress-text" style="font-size: 12px; color: #999999; margin: 0;">
        Waiting for responses...
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
 * Update loading modal progress
 */
function updateLoadingProgress(modal, progress) {
  const progressBar = modal.querySelector('.progress-bar');
  const progressText = modal.querySelector('.progress-text');

  if (progressBar) {
    progressBar.style.width = progress.percentage + '%';
  }

  if (progressText) {
    const statusText = progress.error
      ? `❌ ${progress.branch}: Failed`
      : `✅ ${progress.branch}: Completed`;

    progressText.textContent = `${progress.completed}/${progress.total} environments - ${statusText}`;
  }
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

  return modal;
}

/**
 * Create table-based results modal with comparison view
 */
function createTableComparisonModal(mappedResult, componentsWithTypes, options) {
  const modal = document.createElement('div');
  const modalId = 'precheck-table-' + Date.now();
  modal.id = modalId;

  const { results, branches } = mappedResult;

  // Collect all unique components across all branches
  const allComponents = new Map();
  for (const [branch, branchData] of Object.entries(results)) {
    for (const comp of branchData.components || []) {
      const key = comp.component_name;
      if (!allComponents.has(key)) {
        allComponents.set(key, {
          name: comp.component_name,
          type: comp.component_type,
          author: comp.last_author,
          environments: {}
        });
      }
      allComponents.get(key).environments[branch] = comp;
    }
  }

  // Convert to array and sort
  const componentsArray = Array.from(allComponents.values()).sort((a, b) =>
    a.name.localeCompare(b.name)
  );

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

  // Generate table HTML
  const tableHTML = generateComparisonTable(componentsArray, results, branches, modalId);

  // Generate summary statistics
  const summaryHTML = generateSummaryStatistics(results, branches, componentsArray.length);

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
          Multi-Environment Comparison
        </h2>
        <p style="font-size: 15px; color: #666666; margin: 8px 0 0 0;">
          Compare component status across ${branches.length} environment${branches.length !== 1 ? 's' : ''}
        </p>
      </div>

      <!-- Summary Statistics -->
      ${summaryHTML}

      <!-- Filters & Search -->
      <div style="
        display: flex;
        gap: 12px;
        margin-bottom: 24px;
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
          onkeyup="filterTableRows('${modalId}')"
        >
        <select class="filter-type-${modalId}" style="
          padding: 10px 16px;
          border: 1px solid #d2d2d7;
          border-radius: 8px;
          font-size: 14px;
          cursor: pointer;
        " onchange="filterTableRows('${modalId}')">
          <option value="">All Types</option>
          <option value="ApexClass">ApexClass</option>
          <option value="Flow">Flow</option>
          <option value="DataRaptor">DataRaptor</option>
          <option value="CustomObject">CustomObject</option>
          <option value="Page">Page</option>
          <option value="Component">Component</option>
        </select>
        <select class="filter-status-${modalId}" style="
          padding: 10px 16px;
          border: 1px solid #d2d2d7;
          border-radius: 8px;
          font-size: 14px;
          cursor: pointer;
        " onchange="filterTableRows('${modalId}')">
          <option value="">All Status</option>
          <option value="complete">Exists in All</option>
          <option value="missing">Missing in Some</option>
          <option value="missing-all">Missing in All</option>
        </select>
      </div>

      <!-- Table -->
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
        grid-template-columns: repeat(3, 1fr);
        gap: 12px;
        padding-top: 24px;
        border-top: 1px solid #e5e5e7;
      ">
        <button onclick="exportTableAsCSV('${modalId}')" style="
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
        <button onclick="exportTableAsJSON('${modalId}')" style="
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
      
      table {
        width: 100%;
        border-collapse: collapse;
        background: white;
      }
      
      thead {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        font-weight: 600;
        position: sticky;
        top: 0;
      }
      
      th, td {
        padding: 12px 16px;
        text-align: left;
        border-bottom: 1px solid #e5e5e7;
        font-size: 13px;
      }
      
      tbody tr:hover {
        background: #fafafa;
        cursor: pointer;
      }
      
      .env-header {
        text-align: center;
        font-weight: 600;
      }
      
      .status-cell {
        text-align: center;
        font-weight: 600;
        padding: 8px 4px;
      }
      
      .status-exists {
        background: #e8f5e9;
        color: #1b5e20;
        border-radius: 4px;
      }
      
      .status-missing {
        background: #ffebee;
        color: #b71c1c;
        border-radius: 4px;
      }
      
      .component-type {
        background: #f0f0f0;
        padding: 2px 8px;
        border-radius: 4px;
        font-weight: 600;
        font-size: 12px;
      }
      
      .details-row {
        display: none;
        background: #f9f9f9;
      }
      
      .details-row.show {
        display: table-row;
      }
      
      .date-time {
        font-size: 12px;
        color: #666666;
      }
      
      .commit-hash {
        font-family: monospace;
        font-size: 11px;
        background: #f5f5f7;
        padding: 2px 6px;
        border-radius: 3px;
      }
    </style>
  `;

  document.body.appendChild(modal);

  // Add click handlers for expandable rows
  setTimeout(() => {
    const rows = modal.querySelectorAll('tbody tr[data-component]');
    rows.forEach(row => {
      row.addEventListener('click', function() {
        const detailsRow = this.nextElementSibling;
        if (detailsRow && detailsRow.classList.contains('details-row')) {
          detailsRow.classList.toggle('show');
        }
      });
    });
  }, 0);

  return modal;
}

/**
 * Generate comparison table HTML
 */
function generateComparisonTable(componentsArray, results, branches, modalId) {
  // Get environment config
  const environments = branches.map(b => ({
    branch: b,
    env: COMPONENT_CONFIG.getEnvironment(b)
  }));

  // Generate header
  let headerHTML = `
    <table style="width: 100%; border-collapse: collapse;">
      <thead>
        <tr style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white;">
          <th style="padding: 16px; text-align: left; font-weight: 600;">Component</th>
          <th style="padding: 16px; text-align: center; font-weight: 600;">Type</th>
          <th style="padding: 16px; text-align: center; font-weight: 600;">Author</th>
  `;

  for (const { branch, env } of environments) {
    headerHTML += `
      <th colspan="3" style="
        padding: 16px;
        text-align: center;
        font-weight: 600;
        border-right: 1px solid rgba(255,255,255,0.2);
      ">
        ${env.icon} ${env.label}
        <div style="font-size: 11px; opacity: 0.9;">${env.shortLabel}</div>
      </th>
    `;
  }

  headerHTML += `
        </tr>
        <tr style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white;">
          <th style="padding: 8px 16px;"></th>
          <th style="padding: 8px 16px;"></th>
          <th style="padding: 8px 16px;"></th>
  `;

  for (const { branch, env } of environments) {
    headerHTML += `
      <th style="
        padding: 8px 12px;
        text-align: center;
        font-weight: 600;
        font-size: 12px;
        border-right: 1px solid rgba(255,255,255,0.2);
      ">Status</th>
      <th style="
        padding: 8px 12px;
        text-align: center;
        font-weight: 600;
        font-size: 12px;
        border-right: 1px solid rgba(255,255,255,0.2);
      ">Date</th>
      <th style="
        padding: 8px 12px;
        text-align: center;
        font-weight: 600;
        font-size: 12px;
        border-right: 1px solid rgba(255,255,255,0.2);
      ">Commit</th>
    `;
  }

  headerHTML += `
        </tr>
      </thead>
      <tbody>
  `;

  // Generate rows
  let bodyHTML = '';

  for (const component of componentsArray) {
    // Determine component status across all environments
    const existsCount = Object.values(component.environments).filter(c => c.exists_in_prod).length;
    const statusClass = existsCount === branches.length ? 'complete' : existsCount > 0 ? 'partial' : 'missing-all';

    bodyHTML += `
      <tr data-component="${component.name}" class="component-row ${statusClass}" style="
        cursor: pointer;
      ">
        <td style="padding: 16px; font-weight: 600; color: #1d1d1f;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span>▼</span>
            <span>${component.name}</span>
          </div>
        </td>
        <td style="padding: 16px; text-align: center;">
          <span class="component-type">${component.type}</span>
        </td>
        <td style="padding: 16px; text-align: center; font-size: 12px; color: #666666;">
          ${component.author ? component.author.split('<')[0].trim() : '-'}
        </td>
    `;

    // Add cells for each environment
    for (const { branch, env } of environments) {
      const comp = component.environments[branch];
      
      if (comp && comp.exists_in_prod) {
        const dateObj = new Date(comp.last_commit_date);
        const dateStr = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const timeStr = dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        const commitShort = (comp.last_commit_hash || '').substring(0, 8);

        bodyHTML += `
          <td class="status-cell status-exists" style="border-right: 1px solid #e5e5e7;">
            ✓ EXISTS
          </td>
          <td style="
            padding: 12px 8px;
            text-align: center;
            font-size: 12px;
            color: #666666;
            border-right: 1px solid #e5e5e7;
          ">
            <div>${dateStr}</div>
            <div style="font-size: 11px; color: #999999;">${timeStr}</div>
          </td>
          <td style="
            padding: 12px 8px;
            text-align: center;
            border-right: 1px solid #e5e5e7;
          ">
            <code class="commit-hash">${commitShort}</code>
          </td>
        `;
      } else {
        bodyHTML += `
          <td class="status-cell status-missing" style="border-right: 1px solid #e5e5e7;">
            ✗ MISSING
          </td>
          <td style="
            padding: 12px 8px;
            text-align: center;
            color: #999999;
            border-right: 1px solid #e5e5e7;
          ">
            -
          </td>
          <td style="
            padding: 12px 8px;
            text-align: center;
            color: #999999;
            border-right: 1px solid #e5e5e7;
          ">
            -
          </td>
        `;
      }
    }

    bodyHTML += `
      </tr>
      <!-- Details Row -->
      <tr class="details-row" style="background: #f9f9f9; display: none;">
        <td colspan="999" style="padding: 24px;">
          <div style="
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
          ">
    `;

    // Add details for each environment
    for (const { branch, env } of environments) {
      const comp = component.environments[branch];
      const status = comp && comp.exists_in_prod;

      bodyHTML += `
        <div style="
          border: 1px solid #e5e5e7;
          border-radius: 8px;
          padding: 16px;
          background: white;
        ">
          <div style="
            font-size: 13px;
            font-weight: 600;
            margin-bottom: 12px;
            color: #1d1d1f;
          ">
            ${env.icon} ${env.label}
          </div>
          
          <div style="
            background: ${status ? '#e8f5e9' : '#ffebee'};
            color: ${status ? '#1b5e20' : '#b71c1c'};
            padding: 8px 12px;
            border-radius: 6px;
            font-size: 12px;
            font-weight: 600;
            margin-bottom: 12px;
            text-align: center;
          ">
            ${status ? '✓ EXISTS' : '✗ MISSING'}
          </div>
      `;

      if (comp && status) {
        const dateObj = new Date(comp.last_commit_date);
        const fullDate = dateObj.toLocaleString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        });

        bodyHTML += `
          <div style="font-size: 12px; margin-bottom: 8px; color: #666666;">
            <strong>Date:</strong> ${fullDate}
          </div>
          <div style="font-size: 12px; margin-bottom: 8px; color: #666666;">
            <strong>Commit:</strong> <code style="background: #f5f5f7; padding: 2px 6px; border-radius: 3px; font-family: monospace;">${comp.last_commit_hash}</code>
          </div>
          <div style="font-size: 12px; margin-bottom: 8px; color: #666666;">
            <strong>Author:</strong> ${comp.last_author}
          </div>
          ${comp.last_commit_message ? `
            <div style="font-size: 12px; color: #666666;">
              <strong>Message:</strong> <em>${comp.last_commit_message.substring(0, 50)}...</em>
            </div>
          ` : ''}
        `;
      } else {
        bodyHTML += `
          <div style="font-size: 12px; color: #999999; text-align: center; padding: 8px;">
            No data available
          </div>
        `;
      }

      bodyHTML += `
        </div>
      `;
    }

    bodyHTML += `
          </div>
        </td>
      </tr>
    `;
  }

  headerHTML += bodyHTML + `
      </tbody>
    </table>
  `;

  return headerHTML;
}

/**
 * Generate summary statistics HTML
 */
function generateSummaryStatistics(results, branches, totalComponents) {
  let summaryHTML = `
    <div style="
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
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
        <div style="font-size: 32px; font-weight: 700; margin-bottom: 4px;">
          ${totalComponents}
        </div>
        <div style="font-size: 13px; font-weight: 600; opacity: 0.9;">
          Total Components
        </div>
      </div>
  `;

  for (const branch of branches) {
    const env = COMPONENT_CONFIG.getEnvironment(branch);
    const branchData = results[branch];
    const total = branchData.meta.total;
    const existing = branchData.meta.existing;
    const missing = branchData.meta.missing;
    const percentage = total > 0 ? Math.round((existing / total) * 100) : 0;

    summaryHTML += `
      <div style="
        background: linear-gradient(135deg, ${env.color === '#ff5252' ? '#f43f5e' : env.color === '#ff9800' ? '#f97316' : env.color === '#4caf50' ? '#10b981' : '#06b6d4'} 0%, ${env.color === '#ff5252' ? '#e11d48' : env.color === '#ff9800' ? '#ea580c' : env.color === '#4caf50' ? '#059669' : '#0891b2'} 100%);
        color: white;
        padding: 20px;
        border-radius: 12px;
      ">
        <div style="
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 12px;
        ">
          <div style="font-size: 16px; font-weight: 600;">
            ${env.icon} ${env.shortLabel}
          </div>
          <div style="
            font-size: 20px;
            font-weight: 700;
          ">
            ${percentage}%
          </div>
        </div>
        <div style="
          background: rgba(255,255,255,0.2);
          height: 4px;
          border-radius: 2px;
          overflow: hidden;
          margin-bottom: 8px;
        ">
          <div style="
            width: ${percentage}%;
            height: 100%;
            background: rgba(255,255,255,0.8);
          "></div>
        </div>
        <div style="font-size: 12px; opacity: 0.9;">
          ${existing}/${total} components exist
        </div>
      </div>
    `;
  }

  summaryHTML += `
    </div>
  `;

  return summaryHTML;
}

/**
 * Filter table rows based on search and filters
 */
function filterTableRows(modalId) {
  const modal = document.getElementById(modalId);
  const searchInput = modal.querySelector('.search-input-' + modalId);
  const typeFilter = modal.querySelector('.filter-type-' + modalId);
  const statusFilter = modal.querySelector('.filter-status-' + modalId);

  const searchTerm = searchInput.value.toLowerCase();
  const typeValue = typeFilter.value;
  const statusValue = statusFilter.value;

  const rows = modal.querySelectorAll('tbody tr[data-component]');

  rows.forEach(row => {
    let show = true;

    // Search filter
    if (searchTerm) {
      const componentName = row.getAttribute('data-component').toLowerCase();
      if (!componentName.includes(searchTerm)) {
        show = false;
      }
    }

    // Type filter
    if (typeValue && show) {
      const typeCell = row.querySelector('.component-type');
      if (typeCell && !typeCell.textContent.includes(typeValue)) {
        show = false;
      }
    }

    // Status filter
    if (statusValue && show) {
      const rowStatus = row.className.split(' ').find(c => ['complete', 'partial', 'missing-all'].includes(c));
      if (statusValue === 'complete' && rowStatus !== 'complete') show = false;
      if (statusValue === 'missing' && rowStatus === 'complete') show = false;
      if (statusValue === 'missing-all' && rowStatus !== 'missing-all') show = false;
    }

    row.style.display = show ? 'table-row' : 'none';
  });
}

/**
 * Export table as CSV
 */
function exportTableAsCSV(modalId) {
  const modal = document.getElementById(modalId);
  const table = modal.querySelector('table');

  let csv = '';
  for (let row of table.rows) {
    if (row.classList.contains('details-row')) continue;

    let line = [];
    for (let cell of row.cells) {
      if (cell.textContent && !cell.textContent.includes('▼')) {
        line.push('"' + cell.textContent.trim().replace(/"/g, '""') + '"');
      }
    }
    csv += line.join(',') + '\n';
  }

  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `precheck-comparison-${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
  URL.revokeObjectURL(url);

  showExportSuccess();
}

/**
 * Export table as JSON
 */
function exportTableAsJSON(modalId) {
  const modal = document.getElementById(modalId);
  const rows = modal.querySelectorAll('tbody tr[data-component]');

  const data = [];
  rows.forEach(row => {
    if (!row.style.display || row.style.display !== 'none') {
      const componentName = row.getAttribute('data-component');
      const cells = row.querySelectorAll('td');

      const rowData = {
        component: componentName,
        type: cells[1].textContent.trim(),
        author: cells[2].textContent.trim(),
        environments: {}
      };

      // TODO: Parse environment data
      data.push(rowData);
    }
  });

  const jsonStr = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `precheck-comparison-${new Date().toISOString().split('T')[0]}.json`;
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
  notification.textContent = '✓ Exported successfully!';
  document.body.appendChild(notification);

  setTimeout(() => notification.remove(), 3000);
}

export default { runPrecheck };