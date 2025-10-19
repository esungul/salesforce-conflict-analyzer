// ui/src/ui/tabs/conflicts.js
const $ = (s, r=document) => r.querySelector(s);

let CONFLICTS_STATE = {
  query: localStorage.getItem('ui.conflicts.query') || '',
  sort:  localStorage.getItem('ui.conflicts.sort')  || 'risk',
};

// Add the missing severityRank function at the top level
function severityRank(sev){
  if (/CRITICAL|BLOCKER/i.test(sev)) return 3;
  if (/MEDIUM|WARN|RISK|POTENTIAL/i.test(sev)) return 2;
  if (/LOW|INFO/i.test(sev)) return 1;
  return 0;
}

export function renderConflictsTab(analysis = {}) {
  const panel = $('#tab-conflicts');
  if (!panel) return;

  const raw = Array.isArray(analysis.conflicts)
    ? analysis.conflicts
    : Array.isArray(analysis.component_conflicts)
    ? analysis.component_conflicts
    : [];

  // Normalize conflicts
  const items = raw.map(normalizeConflict);

  // Filter
  const q = CONFLICTS_STATE.query.trim().toLowerCase();
  let filtered = !q ? items : items.filter(it => {
    const hay =
      [it.componentName, it.componentType, it.latestOwner, it.severity]
        .concat(it.storyLabels)
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
    return hay.includes(q);
  });

  // Sort
  filtered = filtered.slice().sort((a, b) => {
    if (CONFLICTS_STATE.sort === 'name') {
      const an = String(a.componentName || '');
      const bn = String(b.componentName || '');
      return an.localeCompare(bn);
    }
    if (CONFLICTS_STATE.sort === 'stories') {
      return (b.storyLabels?.length || 0) - (a.storyLabels?.length || 0);
    }
    // default: risk desc, then severity rank
    const ar = Number.isFinite(a.riskScore) ? a.riskScore : -Infinity;
    const br = Number.isFinite(b.riskScore) ? b.riskScore : -Infinity;
    if (br !== ar) return br - ar;
    return severityRank(b.severity) - severityRank(a.severity);
  });

  // Render
  panel.innerHTML = '';
  panel.append(
    sectionHeader('Conflicts', `${filtered.length} item${filtered.length===1?'':'s'}`),
    filterBar()
  );

  if (!filtered.length) {
    panel.append(emptyCard('No conflicts match your filter.', 'Try clearing the filter or adjusting inputs.'));
    injectCss();
    return;
  }

  const list = document.createElement('div');
  list.className = 'conflicts-list';
  filtered.forEach(c => list.appendChild(conflictCard(c)));
  panel.append(list);

  injectCss();
}

/* ------------------ NORMALIZATION ------------------ */
function normalizeConflict(c) {
  c = c || {};

  var compName = '';
  var compType = '';

  if (c.component) {
    if (typeof c.component === 'string') {
      compName = c.component;
    } else if (typeof c.component === 'object') {
      compName = c.component.name || c.component.fullName || '';
      compType = c.component.type || c.component.metadataType || '';
      if ((!compName || !compType) && c.component.api_name) {
        var s = String(c.component.api_name);
        var dot = s.indexOf('.');
        if (dot > -1) {
          if (!compType) compType = s.slice(0, dot);
          if (!compName) compName = s.slice(dot + 1);
        } else if (!compName) {
          compName = s;
        }
      }
    }
  }

  var storiesRich = Array.isArray(c.stories_with_commit_info) ? c.stories_with_commit_info : [];
  var storiesRaw  = Array.isArray(c.involved_stories) ? c.involved_stories : [];
  var stories     = (storiesRich.length ? storiesRich : storiesRaw).map(toStory);

  var deployOrder = Array.isArray(c.deploy_order_hint) ? c.deploy_order_hint.map(String) : [];

  var devSet = {};
  var lastISO = '';
  for (var i = 0; i < stories.length; i++) {
    var st = stories[i];
    if (st.dev) devSet[st.dev] = true;
    if (st.dateISO) {
      if (!lastISO || new Date(st.dateISO) > new Date(lastISO)) lastISO = st.dateISO;
    }
  }
  var developers = Object.keys(devSet);

  var actionRaw   = c.recommendation && c.recommendation.action ? String(c.recommendation.action) : '';
  var priorityRaw = c.recommendation && c.recommendation.priority
    ? String(c.recommendation.priority)
    : (c.priority ? String(c.priority) : '');

  return {
    componentName: compName || 'Component',
    componentType: compType || 'Component',
    latestOwner: c.latest_owner || '',
    severity: c.severity ? String(c.severity).toUpperCase() : '',
    riskScore: Number(c.risk_score != null ? c.risk_score : 0),

    developers: developers,
    lastActivityISO: lastISO,

    recommendation: {
      action: actionRaw ? actionRaw.replace(/_/g, ' ').toUpperCase() : '',
      priority: priorityRaw ? priorityRaw.toUpperCase() : ''
    },

    riskFactors: Array.isArray(c.risk_factors) ? c.risk_factors : [],

    stories: stories,
    storyLabels: stories.map(function(x){ return x.label; }),
    deployOrder: deployOrder
  };
}

function toStory(s) {
  if (typeof s === 'string') {
    return { id: s, dev: '', sha: '', url: '', dateISO: '', label: s };
  }
  s = s || {};

  var core = s.story && typeof s.story === 'object' ? s.story : s;

  var id =
    core.id || core.name || core.story || core.story_id || core.jira_key || core.key ||
    core.latest_owner || core.owner || '';

  var dev =
    s.created_by || s.developer || core.created_by || core.developer || core.owner_name || '';

  var sha = s.commit_sha || core.commit_sha || s.hash || core.hash || '';
  var url = s.commit_url || core.commit_url || s.url || core.url || '';

  var dateISO = s.commit_date || core.last_commit_date || core.lastModifiedDate || '';

  var label = id ? String(id) : (sha ? String(sha).slice(0, 7) : 'story');

  return { id: id || '', dev: dev || '', sha: sha || '', url: url || '', dateISO: dateISO || '', label: label };
}

/* ------------------ CLEAN CARD DESIGN ------------------ */

function conflictCard(it) {
  const card = document.createElement('div');
  card.className = 'apple-conflict-card';

  // Risk badge with color coding
  const riskLevel = getRiskLevel(it.riskScore, it.severity);
  
  const header = document.createElement('div');
  header.className = 'conflict-header';
  header.innerHTML = `
    <div class="conflict-main">
      <div class="conflict-title">
        <h3 class="component-name">${escapeHtml(it.componentName)}</h3>
        <div class="risk-badge risk-${riskLevel}">
          Risk ${it.riskScore}
        </div>
      </div>
      <div class="conflict-meta">
        <span class="component-type">${escapeHtml(it.componentType)}</span>
        <span class="severity-dot severity-${riskLevel}"></span>
        <span class="severity-text">${escapeHtml(it.severity)}</span>
      </div>
    </div>
    <div class="conflict-summary">
      <div class="summary-item">
        <span class="summary-label">Latest</span>
        <span class="summary-value">${escapeHtml(it.latestOwner)}</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">Developers</span>
        <span class="summary-value">${it.developers.slice(0, 2).map(d => escapeHtml(d)).join(', ')}${it.developers.length > 2 ? '...' : ''}</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">Stories</span>
        <span class="summary-value">${it.stories.length} involved</span>
      </div>
    </div>
  `;

  // Expand button
  const expandBtn = document.createElement('button');
  expandBtn.className = 'expand-btn';
  expandBtn.innerHTML = `
    <span class="expand-icon">▼</span>
  `;

  header.appendChild(expandBtn);

  // Details panel (initially hidden)
  const details = document.createElement('div');
  details.className = 'conflict-details';
  details.hidden = true;

  // Build details content
  const storiesSection = it.stories.length ? `
    <div class="details-section">
      <h4 class="details-title">Involved Stories</h4>
      <div class="stories-list">
        ${it.stories.map(story => `
          <div class="story-row">
            <div class="story-info">
              <span class="story-id">${story.url ? `<a href="${story.url}" target="_blank" rel="noopener">${escapeHtml(story.label)}</a>` : escapeHtml(story.label)}</span>
              ${story.dev ? `<span class="story-developer">${escapeHtml(story.dev)}</span>` : ''}
            </div>
            ${story.dateISO ? `<span class="story-date">${escapeHtml(new Date(story.dateISO).toLocaleDateString())}</span>` : ''}
          </div>
        `).join('')}
      </div>
    </div>
  ` : '';

  const deploySection = it.deployOrder.length ? `
    <div class="details-section">
      <h4 class="details-title">Deploy Order</h4>
      <div class="deploy-order">
        ${it.deployOrder.map((sid, i) => `
          <div class="deploy-step">
            <div class="step-number">${i + 1}</div>
            <div class="step-id">${escapeHtml(sid)}</div>
          </div>
        `).join('')}
      </div>
    </div>
  ` : '';

  const recommendationSection = (it.recommendation.action || it.recommendation.priority) ? `
    <div class="details-section">
      <h4 class="details-title">Recommendation</h4>
      <div class="recommendation-box">
        <div class="recommendation-action">${escapeHtml(it.recommendation.action)}</div>
        ${it.recommendation.priority ? `<div class="recommendation-priority">${escapeHtml(it.recommendation.priority)} priority</div>` : ''}
      </div>
    </div>
  ` : '';

  const riskSection = it.riskFactors.length ? `
    <div class="details-section">
      <h4 class="details-title">Risk Factors</h4>
      <div class="risk-factors">
        ${it.riskFactors.map(factor => `
          <div class="risk-factor">
            <span class="risk-bullet">•</span>
            <span class="risk-text">${escapeHtml(factor)}</span>
          </div>
        `).join('')}
      </div>
    </div>
  ` : '';

  details.innerHTML = `
    ${storiesSection}
    ${deploySection}
    ${recommendationSection}
    ${riskSection}
  `;

  // Expand/collapse functionality - make entire header clickable
  header.style.cursor = 'pointer';
  header.addEventListener('click', (e) => {
    // Don't trigger if clicking on a link within the header
    if (e.target.tagName === 'A' || e.target.closest('a')) return;
    
    const isExpanded = !details.hidden;
    details.hidden = isExpanded;
    expandBtn.querySelector('.expand-icon').textContent = isExpanded ? '▼' : '▲';
    expandBtn.classList.toggle('expanded', !isExpanded);
  });

  card.append(header, details);
  return card;
}

function getRiskLevel(score, severity) {
  if (score >= 50) return 'high';
  if (score >= 20) return 'medium';
  return 'low';
}

/* ------------------ FILTER BAR ------------------ */

function filterBar(){
  const wrap = document.createElement('div');
  wrap.className = 'conflict-filter-bar';
  wrap.innerHTML = `
    <div class="search-container">
      <input id="conflicts-q" class="search-input" type="search"
             placeholder="Search conflicts..." 
             value="${escapeHtml(CONFLICTS_STATE.query)}" />
    </div>
    <div class="filter-controls">
      <label class="filter-select">
        <select id="conflicts-sort" aria-label="Sort by">
          <option value="risk">Risk Level</option>
          <option value="name">Name</option>
          <option value="stories">Story Count</option>
        </select>
      </label>
    </div>
  `;

  const input  = wrap.querySelector('#conflicts-q');
  const select = wrap.querySelector('#conflicts-sort');
  select.value = CONFLICTS_STATE.sort;

  let t;
  input.addEventListener('input', (e) => {
    clearTimeout(t);
    t = setTimeout(() => {
      CONFLICTS_STATE.query = e.target.value || '';
      localStorage.setItem('ui.conflicts.query', CONFLICTS_STATE.query);
      renderConflictsTab(window.__analysis || {});
    }, 160);
  });
  select.addEventListener('change', (e) => {
    CONFLICTS_STATE.sort = e.target.value;
    localStorage.setItem('ui.conflicts.sort', CONFLICTS_STATE.sort);
    renderConflictsTab(window.__analysis || {});
  });

  return wrap;
}

/* ------------------ UI HELPERS ------------------ */

function sectionHeader(title, subtitle='') {
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

function emptyCard(title, desc){
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

/* ------------------ CLEAN STYLES ------------------ */

let cssInjected = false;

function injectCss(){
  if (cssInjected) return; 
  cssInjected = true;
  
  const css = `
  .conflicts-list {
    display: grid;
    gap: 16px;
    max-width: 800px;
    margin: 0 auto;
  }

  /* Main Card */
  .apple-conflict-card {
    background: #ffffff;
    border-radius: 16px;
    box-shadow: 0 2px 16px rgba(0, 0, 0, 0.08);
    border: 1px solid #e5e5e7;
    overflow: hidden;
    transition: all 0.2s ease;
  }

  .apple-conflict-card:hover {
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.12);
    transform: translateY(-1px);
  }

  /* Header */
  .conflict-header {
    padding: 20px 24px;
    position: relative;
  }

  .conflict-main {
    margin-bottom: 16px;
  }

  .conflict-title {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 8px;
  }

  .component-name {
    font-size: 20px;
    font-weight: 600;
    color: #1d1d1f;
    margin: 0;
    line-height: 1.2;
  }

  /* Risk Badges */
  .risk-badge {
    padding: 6px 12px;
    border-radius: 20px;
    font-size: 13px;
    font-weight: 600;
    border: 1.5px solid;
  }

  .risk-high {
    background: #feeeed;
    color: #d70015;
    border-color: #ff3b30;
  }

  .risk-medium {
    background: #fff4e6;
    color: #b95000;
    border-color: #ff9f0a;
  }

  .risk-low {
    background: #e6f4ea;
    color: #0d7c37;
    border-color: #34c759;
  }

  /* Meta Info */
  .conflict-meta {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    color: #86868b;
  }

  .severity-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
  }

  .severity-high { background: #ff3b30; }
  .severity-medium { background: #ff9f0a; }
  .severity-low { background: #34c759; }

  /* Summary Grid */
  .conflict-summary {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 16px;
    padding-top: 16px;
    border-top: 1px solid #f5f5f7;
  }

  .summary-item {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .summary-label {
    font-size: 12px;
    color: #86868b;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .summary-value {
    font-size: 14px;
    color: #1d1d1f;
    font-weight: 500;
  }

  /* Expand Button */
  .expand-btn {
    position: absolute;
    top: 24px;
    right: 24px;
    background: none;
    border: none;
    padding: 8px;
    cursor: pointer;
    border-radius: 8px;
    transition: background-color 0.2s ease;
  }

  .expand-btn:hover {
    background: #f5f5f7;
  }

  .expand-icon {
    font-size: 12px;
    color: #86868b;
    transition: transform 0.2s ease;
  }

  .expand-btn.expanded .expand-icon {
    transform: rotate(180deg);
  }

  /* Details Panel */
  .conflict-details {
    padding: 0 24px 24px;
    border-top: 1px solid #f5f5f7;
  }

  .details-section {
    margin-bottom: 24px;
  }

  .details-section:last-child {
    margin-bottom: 0;
  }

  .details-title {
    font-size: 16px;
    font-weight: 600;
    color: #1d1d1f;
    margin: 0 0 12px 0;
  }

  /* Stories List */
  .stories-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .story-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px;
    background: #fbfbfd;
    border-radius: 8px;
  }

  .story-info {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .story-id a {
    font-weight: 500;
    color: #007aff;
    text-decoration: none;
  }

  .story-id a:hover {
    text-decoration: underline;
  }

  .story-developer {
    font-size: 13px;
    color: #86868b;
  }

  .story-date {
    font-size: 13px;
    color: #86868b;
  }

  /* Deploy Order */
  .deploy-order {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .deploy-step {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
    background: #fbfbfd;
    border-radius: 8px;
  }

  .step-number {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: #007aff;
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: 600;
  }

  .step-id {
    font-weight: 500;
    color: #1d1d1f;
  }

  /* Recommendation */
  .recommendation-box {
    padding: 16px;
    background: #f0f7ff;
    border: 1px solid #007aff;
    border-radius: 12px;
  }

  .recommendation-action {
    font-weight: 600;
    color: #1d1d1f;
    margin-bottom: 4px;
  }

  .recommendation-priority {
    font-size: 13px;
    color: #007aff;
    font-weight: 500;
  }

  /* Risk Factors */
  .risk-factors {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .risk-factor {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding: 8px 0;
  }

  .risk-bullet {
    color: #ff3b30;
    font-weight: bold;
  }

  .risk-text {
    color: #1d1d1f;
    line-height: 1.4;
  }

  /* Filter Bar */
  .conflict-filter-bar {
    display: flex;
    gap: 16px;
    margin-bottom: 24px;
    align-items: center;
  }

  .search-container {
    flex: 1;
  }

  .search-input {
    width: 100%;
    padding: 12px 16px;
    border: 1px solid #e5e5e7;
    border-radius: 12px;
    font-size: 15px;
    background: #ffffff;
    transition: border-color 0.2s ease;
  }

  .search-input:focus {
    outline: none;
    border-color: #007aff;
  }

  .filter-select select {
    padding: 12px 16px;
    border: 1px solid #e5e5e7;
    border-radius: 12px;
    font-size: 15px;
    background: #ffffff;
    cursor: pointer;
  }

  /* Section Header */
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

  /* Empty State */
  .empty-state {
    text-align: center;
    padding: 48px 24px;
    color: #86868b;
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

  /* Performance optimizations for large datasets */
  .conflicts-list {
    will-change: transform;
    contain: layout style;
  }

  .apple-conflict-card {
    will-change: transform;
  }

  /* Dark Mode Support */
  @media (prefers-color-scheme: dark) {
    .apple-conflict-card {
      background: #1c1c1e;
      border-color: #38383a;
    }

    .component-name,
    .summary-value,
    .details-title,
    .step-id,
    .recommendation-action,
    .risk-text {
      color: #ffffff;
    }

    .conflict-meta,
    .summary-label,
    .story-developer,
    .story-date,
    .section-subtitle {
      color: #98989d;
    }

    .conflict-summary,
    .conflict-details {
      border-color: #38383a;
    }

    .expand-btn:hover {
      background: #2c2c2e;
    }

    .story-row,
    .deploy-step {
      background: #2c2c2e;
    }

    .search-input,
    .filter-select select {
      background: #2c2c2e;
      border-color: #38383a;
      color: #ffffff;
    }

    .recommendation-box {
      background: #1a2a3a;
      border-color: #0a84ff;
    }

    .empty-state h3 {
      color: #ffffff;
    }
  }
  `;

  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
}