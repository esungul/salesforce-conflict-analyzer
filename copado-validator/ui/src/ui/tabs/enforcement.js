// ui/src/ui/tabs/enforcement.js
import { checkProductionState } from '../../api/endpoints.js';

const $ = (s, r=document) => r.querySelector(s);

// Local UI state
let ENF_STATE = {
  branch: 'master', // Fixed to master
  scope:  localStorage.getItem('ui.enf.scope')  || 'violations',
  query:  localStorage.getItem('ui.enf.query')  || '',
  loading: false,
  lastRunAt: null,
  expandedCards: new Set(),
  lastAnalysisHash: null // Track analysis data to detect changes
};

// In-memory results
let ENF_RESULTS = [];

export function renderEnforcementTab(analysis = {}) {
  const panel = $('#tab-enforcement');
  if (!panel) return;

  panel.innerHTML = '';
  panel.append(
    sectionHeader('Enforcement', 'Check selected stories against Production to prevent regressions.'),
    filterBar(),
    resultsRegion()
  );

  injectEnforcementCss();

  // Check if analysis data has changed
  const currentAnalysisHash = generateAnalysisHash(analysis);
  const analysisChanged = currentAnalysisHash !== ENF_STATE.lastAnalysisHash;

  if (analysis && analysis.all_stories && analysis.all_stories.length > 0) {
    // If analysis changed, run the check
    if (analysisChanged) {
      console.log('📊 [Enforcement] New analysis detected, running check');
      ENF_STATE.lastAnalysisHash = currentAnalysisHash;
      ENF_RESULTS = []; // Clear old results
      ENF_STATE.expandedCards.clear();
      runCheck(analysis).catch(err => toast(err.message || String(err)));
    } else if (ENF_RESULTS.length > 0) {
      // Analysis same AND we have results, use cache immediately
      console.log('✓ [Enforcement] Using cached results');
      // Make sure spinner is hidden before painting results
      setTimeout(() => {
        paintLoading(false);
        paintResults();
      }, 0);
    } else {
      // Analysis same but no results yet (shouldn't happen but handle it)
      console.log('⚠️ [Enforcement] No cached results, running check');
      ENF_STATE.lastAnalysisHash = currentAnalysisHash;
      runCheck(analysis).catch(err => toast(err.message || String(err)));
    }
  }
}

// Generate hash of analysis to detect real changes
function generateAnalysisHash(analysis) {
  if (!analysis || !analysis.all_stories) return null;
  const storyCount = analysis.all_stories.length;
  const firstStoryId = analysis.all_stories[0]?.id || analysis.all_stories[0]?.key || '';
  return `${storyCount}:${firstStoryId}`;
}

/* ---------------- Actions ---------------- */

async function runCheck(analysis) {
  ENF_STATE.loading = true; 
  paintLoading(true);

  try {
    const comps = collectUniqueComponents(analysis);

    if (!comps.length) {
      console.warn('⚠️ [Enforcement] No components found in analysis');
      ENF_RESULTS = [];
      paintResults();
      return;
    }

    console.log('🔍 [Enforcement] Sending to API:', { componentCount: comps.length, branch: ENF_STATE.branch });

    const { components: prod, meta } = await checkProductionState({ 
      components: comps, 
      branch: ENF_STATE.branch 
    });

    console.log('📦 [Enforcement] API Response:', { productionCount: (prod || []).length });

    // Index production response
    const pmap = new Map();
    (prod || []).forEach(p => {
      const type = p?.type || '';
      const name = p?.name || '';
      const key = `${type}::${name}`.toLowerCase();
      pmap.set(key, {
        exists: !!p.exists,
        commit_date: p.commit_date || '',
        commit_sha: p.commit_sha || '',
        author: p.author || '',
        branch: p.branch || (meta?.branch || ENF_STATE.branch)
      });
    });

    // Merge + classify
    ENF_RESULTS = comps.map(c => {
      const key = `${c.type}::${c.name}`.toLowerCase();
      const prodRec = pmap.get(key) || { exists: false, commit_date: '', commit_sha: '', branch: ENF_STATE.branch };
      const status = classify(c.storyDateISO, prodRec.commit_date, prodRec.exists);
      
      return {
        type: c.type,
        name: c.name,
        devs: Array.from(c.developers || []),
        storyDateISO: c.storyDateISO || '',
        prodDateISO: prodRec.commit_date || '',
        prodSha: prodRec.commit_sha || '',
        prodAuthor: prodRec.author || '',
        exists: !!prodRec.exists,
        branch: prodRec.branch || ENF_STATE.branch,
        status,
        // For BEHIND_PROD tracking
        primaryStoryId: c.primaryStoryId || '',
        storyCommitDate: c.storyCommitDate || ''
      };
    });

    // Enrich BEHIND_PROD components with story information
    enrichBehindProdWithStories(ENF_RESULTS, analysis.all_stories || [], pmap);

    console.log('✅ [Enforcement] Processing complete:', { totalResults: ENF_RESULTS.length });
    ENF_STATE.lastRunAt = new Date().toISOString();
  } catch (err) {
    console.error('❌ [Enforcement] Error in runCheck:', err);
    toast(err.message || String(err));
    ENF_RESULTS = [];
  } finally {
    ENF_STATE.loading = false; 
    paintLoading(false);
    paintResults();
  }
}

/* ---------------- Data helpers ---------------- */

function collectUniqueComponents(analysis) {
  const rawStories = Array.isArray(analysis?.all_stories) ? analysis.all_stories : [];
  const map = new Map();
  
  rawStories.forEach((st, storyIndex) => {
    const comps = Array.isArray(st?.components) ? st.components : [];
    
    comps.forEach((c, compIndex) => {
      let type = c?.type || c?.metadataType || '';
      let name = c?.name || c?.fullName || '';
      
      // Parse api_name to extract proper type and name
      if (c?.api_name) {
        const s = String(c.api_name);
        const dot = s.indexOf('.');
        if (dot > -1) {
          type = s.slice(0, dot);
          name = s.slice(dot + 1);
        } else {
          name = name || s;
        }
      }
      
      if (!name) return;

      const key = `${type}::${name}`.toLowerCase();
      const prev = map.get(key) || { type, name, developers: new Set(), storyDateISO: '' };

      const dev = c?.created_by || c?.developer || '';
      if (dev) prev.developers.add(dev);

      const d = c?.last_commit_date || c?.lastModifiedDate || '';
      if (d) {
        const newDate = new Date(d);
        const prevDate = prev.storyDateISO ? new Date(prev.storyDateISO) : null;
        if (!prev.storyDateISO || newDate > prevDate) {
          prev.storyDateISO = d;
        }
      }
      
      map.set(key, prev);
    });
  });

  return Array.from(map.values());
}

function classify(storyISO, prodISO, exists) {
  if (!exists) return 'NEW';
  
  const sd = storyISO ? new Date(storyISO) : null;
  const pd = prodISO ? new Date(prodISO) : null;
  
  if (!sd || !pd || isNaN(sd) || isNaN(pd)) return 'AHEAD_OF_PROD';
  if (sd.getTime() === pd.getTime()) return 'SAME_AS_PROD';
  
  return sd > pd ? 'AHEAD_OF_PROD' : 'BEHIND_PROD';
}

// Enrich BEHIND_PROD components with story information
function enrichBehindProdWithStories(results, allStories, prodMap) {
  results.forEach(comp => {
    if (comp.status === 'BEHIND_PROD') {
      // Find which story(ies) this component belongs to
      const storyMatches = [];
      
      (allStories || []).forEach(story => {
        const storyComps = Array.isArray(story?.components) ? story.components : [];
        
        const hasComponent = storyComps.some(sc => {
          let scType = sc?.type || sc?.metadataType || '';
          let scName = sc?.name || sc?.fullName || '';
          
          if (sc?.api_name) {
            const dot = sc.api_name.indexOf('.');
            if (dot > -1) {
              scType = sc.api_name.slice(0, dot);
              scName = sc.api_name.slice(dot + 1);
            }
          }
          
          return scType === comp.type && scName === comp.name;
        });
        
        if (hasComponent) {
          storyMatches.push({
            storyId: story.id || story.key || story.name || '',
            storyDate: story.commit_date || story.lastModifiedDate || comp.storyDateISO
          });
        }
      });
      
      // Keep the most recent story this component appears in
      if (storyMatches.length > 0) {
        storyMatches.sort((a, b) => new Date(b.storyDate) - new Date(a.storyDate));
        comp.primaryStoryId = storyMatches[0].storyId;
        comp.storyCommitDate = storyMatches[0].storyDate;
        
        // Calculate days behind
        const storyDate = new Date(comp.storyCommitDate);
        const prodDate = new Date(comp.prodDateISO);
        comp.daysBehind = Math.ceil((prodDate - storyDate) / (1000 * 60 * 60 * 24));
        comp.isWarning = comp.daysBehind > 15;
      }
    }
  });
}

/* ---------------- UI COMPONENTS ---------------- */

function filterBar() {
  const wrap = document.createElement('div');
  wrap.className = 'enf-filter-bar';
  
  wrap.innerHTML = `
    <div class="filter-controls">
      <!-- Left: Scope Toggle -->
      <div class="scope-toggle">
        <button type="button" data-scope="violations" class="toggle-btn ${ENF_STATE.scope === 'violations' ? 'active' : ''}">
          Violations (Behind Prod)
        </button>
        <button type="button" data-scope="new" class="toggle-btn ${ENF_STATE.scope === 'new' ? 'active' : ''}">
          New Components
        </button>
        <button type="button" data-scope="ahead" class="toggle-btn ${ENF_STATE.scope === 'ahead' ? 'active' : ''}">
          Ahead of Prod
        </button>
        <button type="button" data-scope="all" class="toggle-btn ${ENF_STATE.scope === 'all' ? 'active' : ''}">
          All Components
        </button>
      </div>

      <!-- Right: Search -->
      <div class="search-container">
        <input id="enf-q" class="search-input" type="search" 
               placeholder="Filter components..." 
               value="${escapeHtml(ENF_STATE.query)}" />
      </div>
    </div>

    <!-- Summary Bar -->
    <div class="summary-bar" id="enf-summary">
      ${ENF_RESULTS.length ? renderSummary() : 'Loading analysis...'}
    </div>
  `;

  // Event handlers
  const scopeBtns = wrap.querySelectorAll('[data-scope]');
  scopeBtns.forEach(b => b.addEventListener('click', () => {
    ENF_STATE.scope = b.dataset.scope;
    localStorage.setItem('ui.enf.scope', ENF_STATE.scope);
    // Update active button
    scopeBtns.forEach(btn => btn.classList.toggle('active', btn.dataset.scope === ENF_STATE.scope));
    // Repaint with new filter
    paintResults();
  }));

  let t;
  wrap.querySelector('#enf-q').addEventListener('input', (e) => {
    clearTimeout(t);
    t = setTimeout(() => {
      ENF_STATE.query = e.target.value || '';
      localStorage.setItem('ui.enf.query', ENF_STATE.query);
      paintResults();
    }, 140);
  });

  return wrap;
}

function renderSummary() {
  const stats = {
    NEW: ENF_RESULTS.filter(r => r.status === 'NEW').length,
    AHEAD_OF_PROD: ENF_RESULTS.filter(r => r.status === 'AHEAD_OF_PROD').length,
    BEHIND_PROD: ENF_RESULTS.filter(r => r.status === 'BEHIND_PROD').length,
    SAME_AS_PROD: ENF_RESULTS.filter(r => r.status === 'SAME_AS_PROD').length
  };

  return `
    <div class="summary-stats">
      <div class="stat-item ${stats.BEHIND_PROD > 0 ? 'danger' : ''}">
        <span class="stat-value">${stats.BEHIND_PROD}</span>
        <span class="stat-label">Behind Prod</span>
      </div>
      <div class="stat-item">
        <span class="stat-value">${stats.NEW}</span>
        <span class="stat-label">New Components</span>
      </div>
      <div class="stat-item safe">
        <span class="stat-value">${stats.AHEAD_OF_PROD}</span>
        <span class="stat-label">Ahead of Prod</span>
      </div>
      <div class="stat-item muted">
        <span class="stat-value">${stats.SAME_AS_PROD}</span>
        <span class="stat-label">Same as Prod</span>
      </div>
      <div class="stat-item total">
        <span class="stat-value">${ENF_RESULTS.length}</span>
        <span class="stat-label">Total</span>
      </div>
    </div>
  `;
}

function resultsRegion() {
  const region = document.createElement('div');
  region.id = 'enf-results';
  region.append(loadingBar(), listContainer());
  return region;
}

function paintLoading(on) {
  const loadingEl = $('#enf-results .enf-loading');
  const listEl = $('#enf-results .enf-list');
  if (!loadingEl) return;
  
  if (on) {
    loadingEl.hidden = false;
    loadingEl.style.display = 'flex';
    if (listEl) listEl.style.display = 'none';
  } else {
    loadingEl.hidden = true;
    loadingEl.style.display = 'none';
    if (listEl) listEl.style.display = 'block';
  }
}

function paintResults() {
  const list = $('#enf-results .enf-list');
  const summary = $('#enf-summary');
  if (!list) return;

  // Update summary
  if (summary && ENF_RESULTS.length) {
    summary.innerHTML = renderSummary();
  }

  // Filter results based on current scope
  const q = (ENF_STATE.query || '').toLowerCase().trim();
  let rows = ENF_RESULTS;

  // Apply scope filter
  if (ENF_STATE.scope === 'violations') {
    rows = rows.filter(r => r.status === 'BEHIND_PROD');
  } else if (ENF_STATE.scope === 'new') {
    rows = rows.filter(r => r.status === 'NEW');
  } else if (ENF_STATE.scope === 'ahead') {
    rows = rows.filter(r => r.status === 'AHEAD_OF_PROD');
  }
  // 'all' shows everything
  
  // Apply search filter
  if (q) {
    rows = rows.filter(r => {
      const hay = [
        r.type, r.name,
        ...(r.devs || [])
      ].join(' ').toLowerCase();
      return hay.includes(q);
    });
  }

  // Render list
  list.innerHTML = '';
  if (!rows.length) {
    list.append(emptyCard(
      'No components found', 
      ENF_RESULTS.length ? 
        'No components match your current filter settings.' : 
        'Run "Check vs Production" to analyze components against production.'
    ));
    return;
  }

  // Show result count
  const countEl = document.createElement('div');
  countEl.className = 'result-count';
  countEl.textContent = `Showing ${rows.length} of ${ENF_RESULTS.length} components`;
  list.append(countEl);

  const grid = document.createElement('div');
  grid.className = 'enf-grid';
  rows.forEach((r, idx) => grid.appendChild(componentCard(r, idx)));
  list.append(grid);
}

function componentCard(component, index) {
  const card = document.createElement('div');
  card.className = 'enf-card';
  const cardId = `card-${index}`;
  const isExpanded = ENF_STATE.expandedCards.has(cardId);
  
  const statusInfo = getStatusInfo(component.status);
  const shortSha = component.prodSha ? component.prodSha.slice(0, 7) : '';
  const storyDate = component.storyDateISO ? new Date(component.storyDateISO).toLocaleDateString() : '';
  const prodDate = component.prodDateISO ? new Date(component.prodDateISO).toLocaleDateString() : '';
  
  // For BEHIND_PROD, show story context
  const isBehindProd = component.status === 'BEHIND_PROD';
  const storyInfo = isBehindProd ? `
    <div class="behind-prod-info ${component.isWarning ? 'warning' : ''}">
      <div class="story-header">
        <span class="story-id">${escapeHtml(component.primaryStoryId || 'N/A')}</span>
        <span class="days-badge ${component.isWarning ? 'alert' : ''}">${component.daysBehind || 0}d behind</span>
      </div>
      <div class="story-details">
        <span class="detail-item"><strong>Developer:</strong> ${component.devs.length ? escapeHtml(component.devs[0]) : 'N/A'}</span>
        <span class="detail-item"><strong>Story Commit:</strong> ${storyDate}</span>
        <span class="detail-item"><strong>Prod Commit:</strong> ${prodDate}</span>
      </div>
    </div>
  ` : '';

  card.innerHTML = `
    <div class="card-header" data-card-id="${cardId}">
      <div class="component-title">
        <h3 class="component-name">${escapeHtml(component.name)}</h3>
        <div class="status-badge status-${statusInfo.type} ${component.isWarning ? 'alert-badge' : ''}">
          ${statusInfo.label}
          ${component.isWarning ? ' ⚠️' : ''}
        </div>
      </div>
      <div class="card-footer-minimal">
        <span class="component-type">${escapeHtml(component.type || 'Component')}</span>
        <button class="expand-btn" aria-expanded="${isExpanded ? 'true' : 'false'}" aria-label="Toggle details">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M3 6l5 5 5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </button>
      </div>
    </div>

    ${isBehindProd ? storyInfo : ''}

    <div class="card-details ${isExpanded ? 'expanded' : ''}">
      <div class="meta-grid">
        ${component.devs.length ? `
          <div class="meta-item">
            <span class="meta-label">Developers</span>
            <span class="meta-value developers">${component.devs.map(d => `<span class="dev-pill">${escapeHtml(d)}</span>`).join('')}</span>
          </div>
        ` : ''}
        
        ${storyDate ? `
          <div class="meta-item">
            <span class="meta-label">Story Activity</span>
            <span class="meta-value">${escapeHtml(storyDate)}</span>
          </div>
        ` : ''}
        
        ${component.exists && prodDate ? `
          <div class="meta-item">
            <span class="meta-label">Production</span>
            <span class="meta-value">${escapeHtml(prodDate)}</span>
          </div>
        ` : ''}
        
        ${shortSha ? `
          <div class="meta-item">
            <span class="meta-label">Commit</span>
            <span class="meta-value commit-sha">${escapeHtml(shortSha)}</span>
          </div>
        ` : ''}
      </div>

      <div class="status-message ${statusInfo.type}">
        ${statusInfo.message}
      </div>
    </div>
  `;

  // Toggle expand on header click
  const header = card.querySelector('.card-header');
  const expandBtn = card.querySelector('.expand-btn');
  const details = card.querySelector('.card-details');

  const toggle = () => {
    if (isExpanded) {
      ENF_STATE.expandedCards.delete(cardId);
      details.classList.remove('expanded');
      expandBtn.setAttribute('aria-expanded', 'false');
    } else {
      ENF_STATE.expandedCards.add(cardId);
      details.classList.add('expanded');
      expandBtn.setAttribute('aria-expanded', 'true');
    }
  };

  header.addEventListener('click', toggle);
  expandBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggle();
  });

  return card;
}

function getStatusInfo(status) {
  const statusMap = {
    'BEHIND_PROD': {
      type: 'danger',
      label: 'Behind Prod',
      message: 'Story commit is older than Production. Rebase or adjust deploy order.'
    },
    'SAME_AS_PROD': {
      type: 'muted',
      label: 'Same as Prod',
      message: 'Story matches Production. No action needed.'
    },
    'NEW': {
      type: 'info',
      label: 'New',
      message: 'New component – will be introduced by this deployment.'
    },
    'AHEAD_OF_PROD': {
      type: 'safe',
      label: 'Ahead of Prod',
      message: 'Ahead of Production – safe to deploy the change.'
    }
  };
  
  return statusMap[status] || statusMap['AHEAD_OF_PROD'];
}

function loadingBar() {
  const div = document.createElement('div');
  div.className = 'enf-loading';
  div.hidden = true;
  div.innerHTML = `
    <div class="loading-content">
      <div class="spinner"></div>
      <span>Checking production state...</span>
    </div>
  `;
  return div;
}

function listContainer() {
  const div = document.createElement('div');
  div.className = 'enf-list';
  return div;
}

/* ---------------- UI UTILITIES ---------------- */

function sectionHeader(title, subtitle = '') {
  const wrap = document.createElement('div');
  wrap.className = 'section-header';
  const h = document.createElement('h2');
  h.textContent = title;
  h.className = 'section-title';
  const sub = document.createElement('div');
  sub.className = 'section-subtitle';
  sub.textContent = subtitle;
  wrap.append(h, sub);
  return wrap;
}

function emptyCard(title, desc) {
  const card = document.createElement('div');
  card.className = 'empty-state';
  card.innerHTML = `
    <h3>${escapeHtml(title)}</h3>
    <p>${escapeHtml(desc)}</p>
  `;
  return card;
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
}

function toast(msg) {
  const region = document.getElementById('toast-region');
  if (!region) return alert(msg);
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  region.appendChild(t);
  setTimeout(() => t.remove(), 2600);
}

/* ---------------- STYLES ---------------- */

let cssInjected = false;
function injectEnforcementCss() {
  if (cssInjected) return;
  cssInjected = true;

  const css = `
  .enf-filter-bar {
    margin-bottom: 24px;
  }

  .filter-controls {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
    margin-bottom: 16px;
    flex-wrap: wrap;
  }

  .scope-toggle {
    display: flex;
    background: #f5f5f7;
    border-radius: 10px;
    padding: 4px;
    border: 1px solid #e5e5e7;
    gap: 4px;
  }

  .toggle-btn {
    padding: 8px 12px;
    border: none;
    background: transparent;
    border-radius: 8px;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    white-space: nowrap;
  }

  .toggle-btn.active {
    background: #ffffff;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    color: #007aff;
  }

  .search-container {
    min-width: 200px;
  }

  .search-input {
    width: 100%;
    padding: 10px 14px;
    border: 1px solid #e5e5e7;
    border-radius: 10px;
    font-size: 14px;
    background: #ffffff;
  }

  .search-input:focus {
    outline: none;
    border-color: #007aff;
  }

  .summary-bar {
    background: #fbfbfd;
    border: 1px solid #e5e5e7;
    border-radius: 12px;
    padding: 16px 20px;
  }

  .summary-stats {
    display: flex;
    gap: 24px;
    align-items: center;
    flex-wrap: wrap;
  }

  .stat-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }

  .stat-value {
    font-size: 24px;
    font-weight: 700;
    line-height: 1;
  }

  .stat-label {
    font-size: 12px;
    color: #86868b;
    font-weight: 500;
    text-transform: uppercase;
  }

  .stat-item.danger .stat-value { color: #ff3b30; }
  .stat-item.safe .stat-value { color: #34c759; }
  .stat-item.muted .stat-value { color: #86868b; }
  .stat-item.total .stat-value { color: #007aff; }

  .result-count {
    font-size: 13px;
    color: #86868b;
    padding: 12px 0;
    border-bottom: 1px solid #e5e5e7;
    margin-bottom: 16px;
  }

  .enf-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
    gap: 12px;
  }

  .enf-card {
    background: #ffffff;
    border-radius: 12px;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
    border: 1px solid #e5e5e7;
    overflow: hidden;
    transition: all 0.2s ease;
  }

  .enf-card:hover {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  .card-header {
    padding: 14px 16px;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    gap: 8px;
    border-bottom: 1px solid #f5f5f7;
  }

  .behind-prod-info {
    padding: 12px 16px;
    background: #fef3f2;
    border-bottom: 1px solid #fecaca;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .behind-prod-info.warning {
    background: #fff7ed;
    border-bottom-color: #fed7aa;
  }

  .story-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
  }

  .story-id {
    font-weight: 600;
    font-size: 13px;
    color: #7f1d1d;
  }

  .days-badge {
    font-size: 11px;
    font-weight: 600;
    background: #fee2e2;
    color: #991b1b;
    padding: 3px 8px;
    border-radius: 12px;
    border: 1px solid #fecaca;
  }

  .days-badge.alert {
    background: #fef3c7;
    color: #92400e;
    border-color: #fcd34d;
  }

  .story-details {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .detail-item {
    font-size: 11px;
    color: #7f1d1d;
    line-height: 1.4;
  }

  .detail-item strong {
    font-weight: 600;
  }

  .alert-badge {
    background: #feeeed !important;
    color: #d70015 !important;
    border-color: #ffcccc !important;
    animation: pulse-warning 2s infinite;
  }

  @keyframes pulse-warning {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.7; }
  }

  .component-title {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 8px;
  }

  .component-name {
    font-size: 15px;
    font-weight: 600;
    color: #1d1d1f;
    margin: 0;
    line-height: 1.3;
    flex: 1;
    word-break: break-word;
  }

  .status-badge {
    padding: 4px 10px;
    border-radius: 16px;
    font-size: 11px;
    font-weight: 600;
    border: 1.5px solid;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .status-danger { background: #feeeed; color: #d70015; border-color: #ff3b30; }
  .status-safe { background: #e6f4ea; color: #0d7c37; border-color: #34c759; }
  .status-info { background: #eef2ff; color: #273b7a; border-color: #007aff; }
  .status-muted { background: rgba(148,163,184,.15); color: #475569; border-color: rgba(148,163,184,.35); }

  .card-footer-minimal {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
  }

  .component-type {
    font-size: 12px;
    color: #86868b;
    background: #f5f5f7;
    padding: 3px 6px;
    border-radius: 4px;
    flex-shrink: 0;
  }

  .expand-btn {
    background: none;
    border: none;
    cursor: pointer;
    color: #86868b;
    padding: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform 0.2s ease, color 0.2s ease;
    flex-shrink: 0;
  }

  .expand-btn:hover {
    color: #007aff;
  }

  .expand-btn[aria-expanded="true"] {
    transform: rotate(180deg);
    color: #007aff;
  }

  .card-details {
    max-height: 0;
    overflow: hidden;
    transition: max-height 0.3s ease;
  }

  .card-details.expanded {
    max-height: 500px;
  }

  .meta-grid {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 12px 16px;
    border-bottom: 1px solid #f5f5f7;
  }

  .meta-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    font-size: 12px;
  }

  .meta-label {
    color: #86868b;
    font-weight: 500;
    flex-shrink: 0;
  }

  .meta-value {
    color: #1d1d1f;
    font-weight: 500;
    text-align: right;
    flex: 1;
  }

  .developers {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
    justify-content: flex-end;
  }

  .dev-pill {
    background: #007aff;
    color: white;
    padding: 2px 6px;
    border-radius: 10px;
    font-size: 10px;
    font-weight: 500;
  }

  .commit-sha {
    font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
    background: #f5f5f7;
    padding: 2px 4px;
    border-radius: 3px;
    font-size: 10px;
  }

  .status-message {
    padding: 10px 16px;
    border-radius: 0;
    font-size: 12px;
    font-weight: 500;
    line-height: 1.4;
  }

  .status-message.danger { background: #fee2e2; border-top: 1px solid #fecaca; color: #7f1d1d; }
  .status-message.safe { background: #dcfce7; border-top: 1px solid #bbf7d0; color: #065f46; }
  .status-message.info { background: #eef2ff; border-top: 1px solid #e0e7ff; color: #273b7a; }
  .status-message.muted { background: #f0f4f8; border-top: 1px solid #e2e8f0; color: #475569; }

  .enf-loading {
    display: flex;
    justify-content: center;
    padding: 40px 20px;
  }

  .loading-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    color: #86868b;
  }

  .spinner {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    border: 3px solid rgba(0, 0, 0, 0.1);
    border-top-color: #007aff;
    border-right-color: #34c759;
    animation: spin 1.2s cubic-bezier(0.68, -0.55, 0.265, 1.55) infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .section-header {
    margin-bottom: 24px;
  }

  .section-title {
    font-size: 28px;
    font-weight: 700;
    color: #1d1d1f;
    margin: 0 0 4px 0;
  }

  .section-subtitle {
    font-size: 15px;
    color: #86868b;
  }

  .empty-state {
    text-align: center;
    padding: 48px 24px;
    color: #86868b;
    grid-column: 1 / -1;
  }

  .empty-state h3 {
    font-size: 18px;
    color: #1d1d1f;
    margin: 0 0 8px 0;
  }

  .empty-state p {
    margin: 0;
    font-size: 15px;
  }

  @media (prefers-color-scheme: dark) {
    .enf-card {
      background: #1c1c1e;
      border-color: #38383a;
    }

    .card-header {
      border-color: #38383a;
    }

    .component-name {
      color: #ffffff;
    }

    .component-type {
      background: #38383a;
      color: #98989d;
    }

    .expand-btn {
      color: #98989d;
    }

    .expand-btn:hover,
    .expand-btn[aria-expanded="true"] {
      color: #0a84ff;
    }

    .meta-label {
      color: #98989d;
    }

    .meta-value {
      color: #ffffff;
    }

    .commit-sha {
      background: #38383a;
      color: #ffffff;
    }

    .summary-bar {
      background: #2c2c2e;
      border-color: #38383a;
    }

    .scope-toggle {
      background: #2c2c2e;
      border-color: #38383a;
    }

    .toggle-btn.active {
      background: #38383a;
      color: #0a84ff;
    }

    .search-input {
      background: #2c2c2e;
      border-color: #38383a;
      color: #ffffff;
    }

    .empty-state h3 {
      color: #ffffff;
    }

    .result-count {
      color: #98989d;
      border-color: #38383a;
    }

    .status-message.danger { background: #2a0a0a; border-color: #3a0a0a; color: #ff6961; }
    .status-message.safe { background: #0a2a0a; border-color: #0a3a0a; color: #30d158; }
    .status-message.info { background: #0a0a2a; border-color: #0a0a3a; color: #5ac8fa; }
    .status-message.muted { background: #2a2a2a; border-color: #3a3a3a; color: #98989d; }
  }

  @media (max-width: 768px) {
    .filter-controls {
      flex-direction: column;
      align-items: stretch;
    }

    .scope-toggle {
      width: 100%;
      flex-wrap: wrap;
    }

    .enf-grid {
      grid-template-columns: 1fr;
    }

    .summary-stats {
      justify-content: center;
    }

    .component-title {
      flex-direction: column;
      align-items: flex-start;
      gap: 8px;
    }

    .status-badge {
      align-self: flex-start;
    }

    .component-name {
      font-size: 14px;
    }

    .toggle-btn {
      padding: 6px 10px;
      font-size: 11px;
    }
  }
  `;

  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
}