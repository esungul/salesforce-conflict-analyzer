// src/ui/tabs/development-tools/multi-org-comparison.js
// Multi-Org Component Comparison Tool — v2 API adaptation (complete file)
// - Uses centralized endpoints: compareOrgsV2Status / compareOrgsV2Diff
// - Reads branches from COMPONENT_CONFIG environments (master, prep, uatsfdc, qasales)
// - Keeps your inline styles; no CSS framework changes
// - Adds spinners where needed
// - Adds console logs for payloads, timings, and result shapes

import COMPONENT_CONFIG from '../../../../config/component-config.js';
import { compareOrgsV2Status, compareOrgsV2Diff } from '../../../../api/endpoints.js';

/* -----------------------------
   Utilities (spinner + helpers)
------------------------------*/

// REPLACE your old createLoadingModal with this richer, informative spinner:
function createLoadingModal(title, lines = []) {
  const modal = document.createElement('div');
  const modalId = 'loading-modal-' + Date.now();
  modal.id = modalId;
  modal.style.cssText = `
    position: fixed; inset: 0; background: rgba(0,0,0,.35);
    display: flex; align-items: center; justify-content: center; z-index: 9999; backdrop-filter: blur(2px);
  `;
  const items = lines.map(l => `<li style="margin:6px 0;">${l}</li>`).join('');
  modal.innerHTML = `
    <div style="background: white; border-radius: 18px; padding: 28px 32px; text-align: left; box-shadow: 0 20px 60px rgba(0,0,0,.3); animation: slideUp .25s ease-out; min-width: 360px; max-width: 520px;">
      <div style="display:flex; gap:14px; align-items:center; margin-bottom:12px;">
        <div style="width: 44px; height: 44px; border: 4px solid #e5e5e7; border-top-color: #0071e3; border-radius: 50%; animation: spin 1s linear infinite;"></div>
        <div>
          <h3 style="font-size: 18px; font-weight: 700; margin: 0 0 4px 0; color: #1d1d1f;">${title}</h3>
          ${items ? `<ul style="padding-left:18px; margin: 8px 0 0 0; font-size: 13px; color:#444;">${items}</ul>` : ''}
        </div>
      </div>
    </div>
    <style>
      @keyframes spin { to { transform: rotate(360deg); } }
      @keyframes slideUp { from { opacity: 0; transform: translateY(18px) } to { opacity: 1; transform: translateY(0) } }
    </style>
  `;
  return modal;
}


function esc(s){ const d=document.createElement('div'); d.textContent=String(s??''); return d.innerHTML; }

/* ---------------------------------
   Step 1: Add Components (unchanged)
----------------------------------*/
async function showComponentInputUI() {
  return new Promise((resolve) => {
    const modal = document.createElement('div');
    const modalId = 'comparison-components-modal-' + Date.now();
    modal.id = modalId;
    modal.style.cssText = `
      position: fixed; inset: 0; background: rgba(0,0,0,.5);
      display: flex; align-items: center; justify-content: center; z-index: 10000; backdrop-filter: blur(4px); overflow-y: auto;
    `;

    const componentTypes = COMPONENT_CONFIG.getTypesArray();
    let componentsList = [];

    const addComponentRow = () => {
      const rowId = 'comp-row-' + Date.now();
      const newRow = document.createElement('div');
      newRow.id = rowId;
      newRow.style.cssText = `
        display: grid; grid-template-columns: 1fr 1fr auto; gap: 8px; margin-bottom: 12px;
        padding: 12px; background: #f5f5f7; border-radius: 8px; align-items: center;
      `;
      newRow.innerHTML = `
        <div><input type="text" placeholder="Component name" class="comp-name" style="width: 100%; padding: 8px; border: 1px solid #d2d2d7; border-radius: 6px; font-size: 13px; box-sizing: border-box;"></div>
        <div>
          <select class="comp-type" style="width: 100%; padding: 8px; border: 1px solid #d2d2d7; border-radius: 6px; font-size: 13px; box-sizing: border-box;">
            ${componentTypes.map(type => `<option value="${type.id}">${type.icon} ${type.label}</option>`).join('')}
          </select>
        </div>
        <button class="remove-row" style="padding: 8px 12px; background: #ffebee; color: #d32f2f; border: 1px solid #d32f2f; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer; white-space: nowrap;">Remove</button>
      `;
      newRow.querySelector('.remove-row').addEventListener('click', () => {
        newRow.remove();
        componentsList = componentsList.filter(id => id !== rowId);
      });
      modal.querySelector('#components-container').appendChild(newRow);
      componentsList.push(rowId);
    };

    const submitHandler = () => {
      const rows = modal.querySelectorAll('[id^="comp-row-"]');
      const components = Array.from(rows).map(row => {
        const name = row.querySelector('.comp-name').value.trim();
        const typeId = row.querySelector('.comp-type').value;
        const typeObj = COMPONENT_CONFIG.getType(typeId);
        if (!name) return null;
        return { name, type: typeObj.apiValue };
      }).filter(Boolean);
      if (!components.length) { alert('Please add at least one component'); return; }
      console.groupCollapsed('[UI] Components selected');
      console.table(components);
      console.groupEnd();
      modal.remove();
      resolve(components);
    };

    modal.innerHTML = `
      <div style="background: white; border-radius: 18px; padding: 40px; max-width: 600px; width: 90%; margin: 20px auto; box-shadow: 0 20px 60px rgba(0,0,0,.3); animation: slideUp .3s ease-out;">
        <div style="font-size: 60px; margin-bottom: 20px;">⇄</div>
        <h2 style="font-size: 22px; font-weight: 600; margin: 0 0 12px 0; color: #1d1d1f;">Add Components for Comparison</h2>
        <p style="font-size: 14px; color: #666; margin: 0 0 24px 0;">Add one or more components with their types</p>
        <div id="components-container" style="margin-bottom: 20px;"></div>
        <div style="display: flex; gap: 12px;">
          <button id="add-component-btn" style="flex: 1; padding: 10px 16px; background: #0071e3; color: white; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer;">+ Add Component</button>
          <button id="done-btn" style="flex: 1; padding: 10px 16px; background: #34c759; color: white; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer;">Done</button>
          <button id="cancel-btn" style="padding: 10px 16px; background: #8e8e93; color: white; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer;">Cancel</button>
        </div>
      </div>
      <style>@keyframes slideUp { from { opacity: 0; transform: translateY(20px) } to { opacity: 1; transform: translateY(0) } }</style>
    `;
    document.body.appendChild(modal);
    addComponentRow();
    modal.querySelector('#add-component-btn').addEventListener('click', addComponentRow);
    modal.querySelector('#done-btn').addEventListener('click', submitHandler);
    modal.querySelector('#cancel-btn').addEventListener('click', () => { modal.remove(); resolve(null); });
  });
}

/* -------------------------------------
   Step 2: Select Orgs (2–4) + Baseline
   - Reads branches from COMPONENT_CONFIG.getEnvironmentsArray()
--------------------------------------*/

// REPLACE your showOrgSelectionUI with this version.
// It uses your COMPONENT_CONFIG environments and auto-maps to {org, branch}.
// "Prod/master" is preselected. Users can toggle other envs (2–4 total).

async function showOrgSelectionUI() {
  return new Promise((resolve) => {
    const modal = document.createElement('div');
    const modalId = 'environment-selection-modal-' + Date.now();
    modal.id = modalId;
    modal.style.cssText = `
      position: fixed; inset: 0; background: rgba(0,0,0,.5);
      display: flex; align-items: center; justify-content: center; z-index: 10000; backdrop-filter: blur(4px);
    `;

    const ENVS = COMPONENT_CONFIG.getEnvironmentsArray(); // e.g., master, prep, uatsfdc, qasales

    // Stable org-display mapping (no free text)
    const ORG_BY_ENV = {
      master:  'Prod',
      prep:    'Prep',
      uatsfdc: 'UAT',
      qasales: 'QAorg'
    };

    // Pre-select Prod/master
    const preselected = new Set(['master']); // env.value
    const selected = new Set(preselected);   // working set

    const submit = () => {
      const rows = modal.querySelectorAll('.env-checkbox');
      const chosen = [];
      rows.forEach(cb => {
        if (!cb.checked) return;
        const branch = cb.value;                         // env.value (branch)
        const org = ORG_BY_ENV[branch] || branch;       // org label from mapping
        chosen.push({ org, branch });
      });

      const error = modal.querySelector('#error');
      if (chosen.length < 2 || chosen.length > 4) {
        error.textContent = 'Select between 2 and 4 environments (Prod is preselected)';
        error.style.display = 'block';
        return;
      }

      // Baseline is always Prod at launch; can be changed later in results
      modal.remove();
      resolve({ orgs: chosen, baseline: 'Prod' });
    };

    modal.innerHTML = `
      <div style="background: white; border-radius: 18px; padding: 40px; max-width: 720px; width: 92%; box-shadow: 0 20px 60px rgba(0,0,0,.3); animation: slideUp .3s ease-out;">
        <div style="font-size: 60px; margin-bottom: 20px;">🌍</div>
        <h2 style="font-size: 22px; font-weight: 600; margin: 0 0 12px 0; color: #1d1d1f;">Select Environments (2–4)</h2>
        <p style="font-size: 14px; color: #666; margin: 0 0 16px 0;">Prod is selected by default. Pick up to 3 more environments to compare.</p>

        <div id="env-list" style="display: grid; gap: 10px; margin-bottom: 16px; max-height: 360px; overflow-y: auto;">
          ${ENVS.map(e => `
            <label class="env-row" style="display: grid; grid-template-columns: auto 1fr auto; gap: 12px; align-items: center; padding: 12px; background: #f5f5f7; border-radius: 8px;">
              <input type="checkbox" class="env-checkbox" value="${e.value}" ${preselected.has(e.value)?'checked':''} style="width:18px;height:18px;cursor:pointer">
              <div>
                <div style="font-size: 14px; font-weight: 700;">${e.icon || ''} ${ORG_BY_ENV[e.value] || e.label}</div>
                <div style="font-size: 12px; color:#666;">Branch: <code>${e.value}</code> • Env: ${e.label}</div>
              </div>
              <span style="font-size:12px; color:#8c8c8c;">${e.risk ? ('Risk: '+e.risk) : ''}</span>
            </label>
          `).join('')}
        </div>

        <div style="display:flex; gap: 12px; margin-top: 8px;">
          <button id="confirm" style="flex:1; padding:12px 16px; background:#0071e3; color:#fff; border:none; border-radius:8px; font-size:14px; font-weight:600; cursor:pointer;">Compare</button>
          <button id="cancel" style="padding:12px 16px; background:#8e8e93; color:#fff; border:none; border-radius:8px; font-size:14px; font-weight:600; cursor:pointer;">Cancel</button>
        </div>
        <div id="error" style="margin-top:12px; padding:8px 12px; background:#ffebee; color:#d32f2f; border-radius:6px; font-size:13px; display:none;"></div>
      </div>
      <style>@keyframes slideUp { from { opacity:0; transform: translateY(20px) } to { opacity:1; transform: translateY(0) } }</style>
    `;
    document.body.appendChild(modal);

    const error = modal.querySelector('#error');
    modal.querySelectorAll('.env-checkbox').forEach(cb => {
      cb.addEventListener('change', () => {
        if (cb.checked) selected.add(cb.value); else selected.delete(cb.value);
        if (selected.size > 4) { cb.checked = false; selected.delete(cb.value); error.textContent = 'Max 4 environments'; error.style.display = 'block'; }
        else error.style.display = 'none';
      });
    });

    modal.querySelector('#confirm').addEventListener('click', submit);
    modal.querySelector('#cancel').addEventListener('click', () => { modal.remove(); resolve(null); });
  });
}

/* ---------------------------------------
   Main flow (Phase 1 → Phase 2 on demand)
----------------------------------------*/
async function runMultiOrgComparison() {
  try {
    const components = await showComponentInputUI();
    if (!components) return;

    const orgSel = await showOrgSelectionUI();
    if (!orgSel) return;

    const payload1 = {
      orgs: orgSel.orgs,
      components,
      diff_base_org: orgSel.baseline,
      unified_context: 3
    };

    console.groupCollapsed('[API] Phase 1 payload (status only)');
    console.dir(payload1);
    console.groupEnd();

   const loading = createLoadingModal(
  'Comparing environments…',
  [
    'Fetching component file lists from each environment',
    'Computing fast content hashes per file',
    `Evaluating differences vs baseline: ${orgSel.baseline}`,
    'No code diffs yet — this is status & metadata only'
  ]
);
document.body.appendChild(loading);


    console.time('[API] compareOrgsV2Status');
    const resp = await compareOrgsV2Status(payload1);
    console.timeEnd('[API] compareOrgsV2Status');

    loading.remove();

    console.groupCollapsed('[API] Phase 1 response (v2 status)');
    console.log('meta:', resp.meta);
    console.log('components:', resp.components?.length);
    console.log('perf:', resp.perf);
    console.groupEnd();

    displayComparisonResultsV2(resp);
  } catch (e) {
    document.querySelectorAll('[id^="loading-modal-"]').forEach(m => m.remove());
    console.error('[ERR] runMultiOrgComparison', e);
    alert('Error: ' + e.message);
  }
}



function displayComparisonResultsV2(data) {
  const meta = data.meta || {};
  const comps = (data.components || []).slice();
  let baseline = meta.diff_base_org || (meta.orgs?.[0]?.org);

  // local UI state
  let showOnlyChanged = true;
  let searchTerm = '';

  // quick totals
  const totalFiles = comps.reduce((n,c)=> n + (c.summary?.files_total||0), 0);
  const changedFiles = comps.reduce((n,c)=> n + (c.summary?.files_changed||0), 0);

  // modal
  const modal = document.createElement('div');
  const modalId = 'comparison-results-modal-' + Date.now();
  modal.id = modalId;
  modal.style.cssText = `
    position: fixed; inset: 0; background: rgba(0,0,0,.5);
    display: flex; align-items: center; justify-content: center; z-index: 10000; backdrop-filter: blur(4px); overflow-y: auto; padding: 20px;
  `;

  // build outer container (we reference it for fullscreen)
  const headerChips = (meta.orgs||[]).map(o=> `<span style="padding:8px 12px; background:#f5f5f7; border:1px solid #e5e5e7; border-radius:12px; font-size:12px; font-weight:600;">${esc(o.org)}/${esc(o.branch)}</span>`).join('');

  modal.innerHTML = `
    <div id="results-shell" style="background: white; border-radius: 18px; max-width: 1200px; width: 95%; max-height: 90vh; overflow: hidden; box-shadow: 0 20px 60px rgba(0,0,0,.3); animation: slideUp .3s ease-out; display: grid; grid-template-rows: auto auto auto 1fr auto;">
      <!-- Header -->
      <div style="padding: 20px 24px 8px;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
          <div>
            <h2 style="font-size:24px; font-weight:700; margin:0 0 8px 0;">Multi-Org Comparison Results</h2>
            <div style="display:flex; gap:12px; align-items:center; flex-wrap: wrap;">
              ${headerChips}
              <span id="baseline-pill" style="padding:8px 12px; background:#e3f2fd; color:#1976d2; border-radius:12px; font-size:12px; font-weight:600;">Baseline: ${esc(baseline)}</span>
            </div>
          </div>
          <div style="display:flex; gap:8px;">
            <button id="fullscreen-btn" title="Full screen" style="padding:8px 12px; border:1px solid #d2d2d7; background:white; border-radius:6px; font-size:13px; font-weight:600; color:#1d1d1f; cursor:pointer;">⛶ Full Screen</button>
            <button onclick="document.getElementById('${modalId}').remove()" style="padding:8px 12px; border:1px solid #d2d2d7; background:white; border-radius:6px; font-size:13px; font-weight:600; color:#1d1d1f; cursor:pointer;">✕ Close</button>
          </div>
        </div>
      </div>

      <!-- Controls -->
      <div style="padding: 0 24px 8px;">
        <div style="display:flex; gap:12px; align-items:center; flex-wrap: wrap;">
          <label style="display:inline-flex; align-items:center; gap:8px; padding:8px 12px; background:#f5f5f7; border:1px solid #e5e5e7; border-radius:10px; font-size:12px;">
            <input id="toggle-changed" type="checkbox" checked style="width:16px;height:16px;cursor:pointer"> Show only changed
          </label>
          <input id="filter-input" type="text" placeholder="Filter by component or path…" style="flex:1; min-width:220px; padding:8px 12px; border:1px solid #d2d2d7; border-radius:8px; font-size:13px;">
          <div style="display:inline-flex; align-items:center; gap:8px; padding:8px 12px; background:#f5f5f7; border:1px solid #e5e5e7; border-radius:10px; font-size:12px;">
            <span>Baseline</span>
            <select id="baseline-select" style="padding:6px 8px; border:1px solid #d2d2d7; border-radius:6px; font-size:12px;">
              ${(meta.orgs||[]).map(o => `<option value="${esc(o.org)}" ${o.org===baseline?'selected':''}>${esc(o.org)}</option>`).join('')}
            </select>
          </div>
        </div>
      </div>

      <!-- Stats -->
      <div style="padding: 0 24px 16px;">
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap:16px;">
          <div style="padding:20px; background:#fff3e0; border-left:4px solid #f57c00; border-radius:8px;">
            <div style="font-size:28px; font-weight:700; color:#f57c00; margin-bottom:4px;">${changedFiles}</div>
            <div style="font-size:13px; color:#666;">Files Changed</div>
          </div>
          <div style="padding:20px; background:#e8f5e9; border-left:4px solid #388e3c; border-radius:8px;">
            <div style="font-size:28px; font-weight:700; color:#388e3c; margin-bottom:4px;">${totalFiles - changedFiles}</div>
            <div style="font-size:13px; color:#666;">Files Unchanged</div>
          </div>
          <div style="padding:20px; background:#f5f5f7; border-left:4px solid #8e8e93; border-radius:8px;">
            <div style="font-size:28px; font-weight:700; color:#8e8e93; margin-bottom:4px;">${totalFiles}</div>
            <div style="font-size:13px; color:#666;">Files Total</div>
          </div>
        </div>
      </div>

      <!-- Body -->
      <div id="results-body" style="overflow:auto; padding: 0 24px 16px;"></div>

      <!-- Footer -->
      <div style="padding: 0 24px 24px;">
        <button onclick="document.getElementById('${modalId}').remove(); window.runMultiOrgComparison();" style="padding:10px 20px; background:#0071e3; color:white; border:none; border-radius:8px; font-size:14px; font-weight:600; cursor:pointer;">🔄 New Comparison</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  const shell = modal.querySelector('#results-shell');
  let fullscreen = false;
  modal.querySelector('#fullscreen-btn').addEventListener('click', () => {
    fullscreen = !fullscreen;
    toggleFullscreen(shell, fullscreen);
    modal.querySelector('#fullscreen-btn').textContent = fullscreen ? '🗗 Exit Full Screen' : '⛶ Full Screen';
  });

  // RENDER TABLE (component sections + per-env columns)
  const renderTable = () => {
    const container = modal.querySelector('#results-body');
    if (!container) return;
    let html = '';

    // sort: with changes first
    const sorted = comps.slice().sort((a,b) => {
      const ca = a.summary?.files_changed || 0;
      const cb = b.summary?.files_changed || 0;
      return cb - ca || a.name.localeCompare(b.name);
    });

    let visibleBlocks = 0;

    sorted.forEach(c => {
      const visibleFiles = (c.files||[]).filter(f => {
        if (showOnlyChanged && !(f.status === 'DIFF' || f.status === 'NEW')) return false;
        if (searchTerm) {
          const hay = (c.type + ' ' + c.name + ' ' + f.path).toLowerCase();
          if (!hay.includes(searchTerm.toLowerCase())) return false;
        }
        return true;
      });
      if (!visibleFiles.length) return;

      visibleBlocks++;

      const changed = c.summary?.files_changed || 0;
      const total   = c.summary?.files_total || 0;

      // per-env header row
      const envHead = (meta.orgs||[]).map(o => `
        <th style="padding:10px; text-align:left; font-size:12px; color:#666;">
          ${esc(o.org)}<div style="font-size:11px; color:#8c8c8c;">${esc(o.branch)}</div>
        </th>
      `).join('');

      const rows = visibleFiles.map(f => {
        const per = f.per_org_meta || [];
        const base = per.find(p => p.org === (f.base_org || baseline));
        const baseSha = base?.sha256 || null;

        // one cell per environment, shows dot + (Same/Diff/Missing)
        const envCells = (meta.orgs||[]).map(o => {
          const m = per.find(p => p.org === o.org);
          if (!m || !m.exists) return `<td style="padding:10px; font-size:12px; color:#8c8c8c;">⚪️ Missing</td>`;
          const same = baseSha && m.sha256 === baseSha;
          const dot  = same ? '🟢' : '🟡';
          const txt  = same ? 'Same' : 'Diff';
          return `<td style="padding:10px; font-size:12px;">${dot} ${txt}</td>`;
        }).join('');

        const canView = (f.status === 'DIFF' || f.status === 'NEW');
        const action = canView
          ? `<button class="view-details" data-type="${esc(c.type)}" data-name="${esc(c.name)}" data-path="${encodeURIComponent(f.path)}" style="padding:6px 12px; background:#0071e3; color:white; border:none; border-radius:6px; font-size:12px; font-weight:600; cursor:pointer;">View Details</button>`
          : '—';

        return `
          <tr style="border-top:1px solid #e5e5e7;">
            <td style="padding:10px; font-size:12px; vertical-align:top;">
              <div style="font-family:ui-monospace,Menlo,monospace; color:#1d1d1f;">${esc(f.path)}</div>
              <div style="font-size:11px; color:#8c8c8c;">Status: ${esc(f.status)} · Baseline: ${esc(f.base_org || baseline)}</div>
            </td>
            ${envCells}
            <td style="padding:10px; font-size:12px; text-align:center; vertical-align:top;">${action}</td>
          </tr>
        `;
      }).join('');

      html += `
        <div style="margin-bottom: 16px; border:1px solid #e5e5e7; border-radius:12px; overflow:hidden; background:white;">
          <div style="display:flex; justify-content:space-between; align-items:center; padding:12px 16px; background:#f5f5f7; border-bottom:1px solid #e5e5e7;">
            <div>
              <div style="font-size:14px; font-weight:700; color:#1d1d1f;">${esc(c.type)} / ${esc(c.name)}</div>
              <div style="font-size:12px; color:#666;">${changed} changed · ${total} total</div>
            </div>
          </div>
          <table style="width:100%; border-collapse:collapse;">
            <thead style="background:#fafafa;">
              <tr>
                <th style="padding:10px; text-align:left; font-size:12px; color:#666;">File</th>
                ${envHead}
                <th style="padding:10px; text-align:center; font-size:12px; color:#666;">Action</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      `;
    });

    if (!visibleBlocks) {
      html = `<div style="padding:20px; color:#666;">No results match your filters.</div>`;
    }
    container.innerHTML = html;

    // wire "View Details" buttons (Phase 2 trigger + logs)
    container.querySelectorAll('.view-details').forEach(btn => {
      btn.addEventListener('click', async () => {
        const type = btn.getAttribute('data-type');
        const name = btn.getAttribute('data-name');
        const encodedPath = btn.getAttribute('data-path');

        const payload2 = {
          orgs: meta.orgs,
          component: { type, name },
          diff_base_org: baseline, // current selection
          unified_context: 3
        };

        console.groupCollapsed('[API] Phase 2 payload (diffs)');
        console.dir(payload2);
        console.groupEnd();

        const loading = createLoadingModal(
  `Preparing diffs for ${type}/${name}`,
  [
    'Requesting server-side git diff',
    `Baseline: ${baseline}`,
    'Building unified hunks & word-level tokens',
    'Sending results to viewer'
  ]
);
document.body.appendChild(loading);

        try {
          console.time('[API] compareOrgsV2Diff');
          const compResp = await compareOrgsV2Diff(payload2);
          console.timeEnd('[API] compareOrgsV2Diff');
          loading.remove();

          const comp = (compResp.components||[])[0];
          if (!comp) return alert('No component data');
          const path = decodeURIComponent(encodedPath);
          const f = (comp.files||[]).find(x => x.path === path);
          if (!f || !f.diff) return alert('No diff available for this file');

          showDiffModalV2(path, f.diff);
        } catch (e) {
          loading.remove();
          console.error('[ERR] viewDetailsV2', e);
          alert('Error: ' + e.message);
        }
      });
    });
  };

  // initial render
  renderTable();

  // controls
  const toggle = modal.querySelector('#toggle-changed');
  const filter = modal.querySelector('#filter-input');
  const baselineSelect = modal.querySelector('#baseline-select');
  const baselinePill = modal.querySelector('#baseline-pill');

  toggle.addEventListener('change', () => {
    showOnlyChanged = !!toggle.checked;
    console.log('[UI] Show only changed:', showOnlyChanged);
    renderTable();
  });

  let filterTimer = null;
  filter.addEventListener('input', () => {
    clearTimeout(filterTimer);
    filterTimer = setTimeout(() => {
      searchTerm = filter.value.trim();
      console.log('[UI] Filter:', searchTerm);
      renderTable();
    }, 150);
  });

  baselineSelect.addEventListener('change', () => {
    baseline = baselineSelect.value;
    baselinePill.textContent = `Baseline: ${baseline}`;
    console.log('[UI] Baseline switched to:', baseline);
    renderTable();
  });
}

function toggleFullscreen(container, on) {
  if (on) {
    container.style.maxWidth = '100vw';
    container.style.width = '100vw';
    container.style.maxHeight = '100vh';
    container.style.height = '100vh';
    container.style.borderRadius = '0';
  } else {
    container.style.maxWidth = '1200px';
    container.style.width = '95%';
    container.style.maxHeight = '90vh';
    container.style.height = '';
    container.style.borderRadius = '18px';
  }
}

/* ---------------------------------------
   Diff modal (renders backend hunks/tokens)
----------------------------------------*/
function showDiffModalV2(path, diffObj) {
  const modal = document.createElement('div');
  const modalId = 'detailed-diff-modal-' + Date.now();
  modal.id = modalId;
  modal.style.cssText = `
    position: fixed; inset: 0; background: rgba(0,0,0,.7);
    display: flex; align-items: center; justify-content: center; z-index: 10001; backdrop-filter: blur(4px); padding: 20px;
  `;

  const renderUnifiedHunks = (hunks=[]) => hunks.map(h => {
    const head = h.header ? `<div style="color:#8c8c8c; margin:8px 0; font-family:ui-monospace,Menlo,monospace;">${esc(h.header)}</div>` : '';
    const ll = (h.lines||[]).map(ln => {
      const cls = ln.startsWith('+') ? 'background:#e8f5e9;color:#1d1d1f;' :
                 ln.startsWith('-') ? 'background:#ffebee;color:#1d1d1f;' :
                 (ln.startsWith('--- ')||ln.startsWith('+++ ')) ? 'color:#8c8c8c;' : '';
      return `<div style="white-space:pre; font-family:ui-monospace,Menlo,monospace; border-bottom:1px solid #f5f5f7; padding:2px 6px; ${cls}">${esc(ln)}</div>`;
    }).join('');
    return head + ll;
  }).join('');

  const renderWordTokens = (chunks=[]) => {
    return `<div style="white-space:pre-wrap; font-family:ui-monospace,Menlo,monospace; border:1px solid #e5e5e7; border-radius:8px; padding:8px;">${
      (chunks||[]).map(t => {
        if (t.type === 'add') return `<span style="background:#e8f5e9">${esc(t.text)}</span>`;
        if (t.type === 'del') return `<span style="background:#ffebee;text-decoration:line-through;">${esc(t.text)}</span>`;
        return `<span>${esc(t.text)}</span>`;
      }).join('')
    }</div>`;
  };

  const blocks = (diffObj?.items || []).map(it => {
    if (it.format === 'git_unified') return renderUnifiedHunks(it.hunks);
    if (it.format === 'git_word_porcelain') return renderWordTokens(it.chunks);
    if (it.lines) return renderUnifiedHunks([it]); // legacy single hunk
    return '';
  }).join('<hr style="border:none; border-top:1px solid #eee; margin:12px 0;">');

  modal.innerHTML = `
    <div style="background:white; border-radius:18px; max-width: 1200px; width:95%; max-height:90vh; overflow: hidden; box-shadow: 0 20px 60px rgba(0,0,0,.3); animation: slideUp .3s ease-out; display:grid; grid-template-rows:auto 1fr;">
      <div style="padding: 16px 20px; border-bottom:1px solid #e5e5e7; display:flex; justify-content:space-between; align-items:center;">
        <div>
          <div style="font-size: 16px; font-weight: 700; color:#1d1d1f;">Diff • ${esc(path)}</div>
          <div style="font-size: 12px; color:#666;">(server-side hunks)</div>
        </div>
        <button onclick="document.getElementById('${modalId}').remove()" style="padding:8px 12px; border:1px solid #d2d2d7; background:white; border-radius:6px; font-size:13px; font-weight:600; color:#1d1d1f; cursor:pointer;">✕ Close</button>
      </div>
      <div style="overflow:auto; padding: 12px 16px; background:#fafafa;">
        ${blocks || '<div style="color:#666; padding:20px;">No diff content.</div>'}
      </div>
    </div>
    <style>@keyframes slideUp { from { opacity:0; transform: translateY(20px) } to { opacity:1; transform: translateY(0) } }</style>
  `;
  document.body.appendChild(modal);

  // Log a quick glance of diff object to verify format seen
  try {
    const formats = (diffObj.items || []).map(i => i.format || (i.lines ? 'unified' : 'unknown'));
    console.groupCollapsed('[UI] Diff formats in modal');
    console.log('path:', path);
    console.log('formats:', formats);
    console.groupEnd();
  } catch(_) {}
}

/* ---------------------------------------
   Public entry
----------------------------------------*/
window.runMultiOrgComparison = runMultiOrgComparison;
export { runMultiOrgComparison };
