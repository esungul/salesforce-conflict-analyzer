// ui/src/ui/tabs/stories.js
const $ = (s, r=document) => r.querySelector(s);

let STORIES_STATE = {
  query: localStorage.getItem('ui.stories.query') || '',
  sort:  localStorage.getItem('ui.stories.sort')  || 'recent',
  scope: localStorage.getItem('ui.stories.scope') || 'conflicted',
  in:    localStorage.getItem('ui.stories.in')    || 'all',
};

export function renderStoriesTab(analysis = {}) {
  const panel = document.querySelector('#tab-stories');
  if (!panel) return;

  // ---- 1) Collect conflicts → Set of story IDs involved in any conflict ----
  const conflicts = Array.isArray(analysis.conflicts)
    ? analysis.conflicts
    : Array.isArray(analysis.component_conflicts)
    ? analysis.component_conflicts
    : [];

  const conflictIds = new Set();
  for (const c of conflicts) {
    const inv = Array.isArray(c?.involved_stories) ? c.involved_stories : [];
    inv.forEach(id => conflictIds.add(String(id)));
  }

  // ---- 2) Normalize stories, tag hasConflict, gather developers, compute commit_date ----
  const rawStories = Array.isArray(analysis.all_stories) ? analysis.all_stories : [];
  const stories = normalizeStories(rawStories, conflictIds);

  // ---- 3) Scope: 'conflicted' or 'all' ----
  const scope = (STORIES_STATE?.scope || 'conflicted');
  const scopedStories = stories.filter(s => !s.hasConflict);


  // ---- 4) Filter: text + "search in" (all | dev | comp | story) ----
  const q = (STORIES_STATE?.query || '').trim().toLowerCase();
  const where = (STORIES_STATE?.in || 'all');

  const filtered = !q ? scopedStories : scopedStories
    .map(s => {
      const storyMatch = (where === 'story' || where === 'all')
        ? String(s.name || '').toLowerCase().includes(q)
        : false;

      // if story matched, keep all components; otherwise filter components by chosen field(s)
      if (storyMatch) return s;

      let comps = s.components;
      // developer match
      if (where === 'dev' || where === 'all') {
        comps = comps.filter(c => c.created_by && c.created_by.toLowerCase().includes(q));
      }
      // component name match (if not restricting to dev only OR if dev match produced 0 in "all" mode)
      if (where === 'comp' || (where === 'all' && comps.length === 0)) {
        comps = s.components.filter(c => c.name && c.name.toLowerCase().includes(q));
      }

      return { ...s, components: comps };
    })
    .filter(s => {
      if (where === 'story') {
        return String(s.name || '').toLowerCase().includes(q);
      }
      return s.components.length > 0;
    });

  // ---- 5) Sort: 'recent' | 'name' | 'components' ----
  const sorted = filtered.slice().sort((a, b) => {
    const mode = STORIES_STATE?.sort || 'recent';
    if (mode === 'name') {
      return String(a.name).localeCompare(String(b.name));
    }
    if (mode === 'components') {
      return b.components.length - a.components.length;
    }
    // default 'recent' → by latest commit_date desc
    const ad = a.commit_date ? new Date(a.commit_date).getTime() : 0;
    const bd = b.commit_date ? new Date(b.commit_date).getTime() : 0;
    return bd - ad;
  });

  // ---- 6) Render ----
panel.innerHTML = '';
panel.append(
  sectionHeader('Safe Stories', `${sorted.length} item${sorted.length === 1 ? '' : 's'}`),
  filterBar()
);


  if (!sorted.length) {
    panel.append(emptyCard('No results', 'Try a different filter/toggle or run another analysis.'));
    injectStoriesCss();
    return;
  }

  const list = document.createElement('div');
  list.className = 'stories-list';
  sorted.forEach((s, i) => list.appendChild(renderStoryCard(s, i)));
  panel.append(list);

  injectStoriesCss();
}

/* ------------------ Model helpers (UNCHANGED) ------------------ */

function normalizeStories(raw, conflictIds = new Set()) {
  const map = new Map();

  raw.forEach(s => {
    const key = s?.id || s?.name || s?.story || s?.latest_owner || s?.commit_sha || JSON.stringify(s);
    if (!key) return;

    const base = map.get(key) || {
      key,
      name: s?.id || s?.name || s?.story || key,
      commit_sha: s?.commit_sha || '',
      commit_url: s?.commit_url || '',
      components: [],
      developers: new Set(),
      hasConflict: conflictIds.has(String(s?.id || s?.name || s?.story || key)),
      commit_date: null,
    };

    const comps = toComponents(s?.components);
    base.components = dedupeComponents(base.components.concat(comps));
    comps.forEach(c => { if (c.created_by) base.developers.add(c.created_by); });

    // latest commit date across components
    const latest = maxDateFromComponents(s?.components);
    base.commit_date = base.commit_date && latest ? (base.commit_date > latest ? base.commit_date : latest) : (base.commit_date || latest);

    if (!base.commit_sha && s?.commit_sha) base.commit_sha = s.commit_sha;
    if (!base.commit_url && s?.commit_url) base.commit_url = s.commit_url;

    map.set(key, base);
  });

  return Array.from(map.values()).map(s => ({
    ...s,
    developers: Array.from(s.developers),
  }));
}

function toComponents(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map(c => {
    // api_name like "ApexClass.MyClass"
    let type = c?.type || c?.metadataType || '';
    let name = c?.name || c?.fullName || c?.component || '';
    if (c?.api_name) {
      const s = String(c.api_name);
      const dot = s.indexOf('.');
      if (dot > -1) { type = s.slice(0, dot); name = s.slice(dot + 1); }
      else { name = s; }
    }
    return {
      type,
      name,
      status: c?.status || '',
      created_by: c?.created_by || '',
      last_commit_date: c?.last_commit_date || c?.lastModifiedDate || '',
      commit_hash: c?.commit_hash || c?.commit_sha || '',
      url: c?.commit_url || '',
    };
  }).filter(c => c.name);
}

function dedupeComponents(arr) {
  const seen = new Set(), out = [];
  arr.forEach(c => {
    const key = `${c.type}::${c.name}`;
    if (seen.has(key)) return;
    seen.add(key); out.push(c);
  });
  return out;
}

function maxDateFromComponents(arr) {
  if (!Array.isArray(arr)) return null;
  let best = null;
  arr.forEach(c => {
    const d = c?.last_commit_date && new Date(c.last_commit_date);
    if (d && !isNaN(d) && (!best || d > best)) best = d;
  });
  return best;
}

/* ------------------ UPDATED UI BUILDERS ------------------ */

function renderStoryCard(story) {
  const sha = story.commit_sha ? story.commit_sha.slice(0, 7) : '';
  const dateText = story.commit_date ? new Date(story.commit_date).toLocaleDateString() : '';
  const comps = story.components;

  const card = document.createElement('div');
  card.className = 'apple-story-card';

  // Header with expandable toggle
  const header = document.createElement('div');
  header.className = 'story-header';
  
  const statusBadge = story.hasConflict ? 'conflict' : 'safe';
  
  header.innerHTML = `
    <div class="story-main">
      <div class="story-title">
        <h3 class="story-name">${escapeHtml(story.name)}</h3>
        <div class="status-badge status-${statusBadge}">
          ${story.hasConflict ? 'Conflict' : 'Safe'}
        </div>
      </div>
      <div class="story-meta">
        <span class="developers-list">
          ${story.developers.slice(0, 3).map(d => escapeHtml(d)).join(', ')}
          ${story.developers.length > 3 ? '...' : ''}
        </span>
        ${sha ? `<span class="commit-sha">${sha}</span>` : ''}
        ${dateText ? `<span class="commit-date">${dateText}</span>` : ''}
        ${story.commit_url ? `<a href="${story.commit_url}" target="_blank" rel="noopener" class="commit-link">view</a>` : ''}
      </div>
    </div>
    <div class="story-summary">
      <div class="summary-item">
        <span class="summary-label">Components</span>
        <span class="summary-value">${comps.length}</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">Developers</span>
        <span class="summary-value">${story.developers.length}</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">Status</span>
        <span class="summary-value">${story.hasConflict ? 'Conflicted' : 'Clear'}</span>
      </div>
    </div>
  `;

  // Expand button
  const expandBtn = document.createElement('button');
  expandBtn.className = 'expand-btn';
  expandBtn.innerHTML = `<span class="expand-icon">▼</span>`;
  header.appendChild(expandBtn);

  // Details panel (initially hidden)
  const details = document.createElement('div');
  details.className = 'story-details';
  details.hidden = true;
  details.innerHTML = renderComponents(comps);

  // Expand/collapse functionality
  header.style.cursor = 'pointer';
  header.addEventListener('click', (e) => {
    if (e.target.tagName === 'A' || e.target.closest('a')) return;
    
    const isExpanded = !details.hidden;
    details.hidden = isExpanded;
    expandBtn.querySelector('.expand-icon').textContent = isExpanded ? '▼' : '▲';
    expandBtn.classList.toggle('expanded', !isExpanded);
  });

  card.append(header, details);
  return card;
}

function renderComponents(components) {
  if (!components.length) {
    return `<div class="no-components">No component details available.</div>`;
  }
  return `
    <div class="components-section">
      <h4 class="details-title">Components (${components.length})</h4>
      <div class="components-grid">
        ${components.map(c => componentTile(c)).join('')}
      </div>
    </div>
  `;
}

function componentTile(c) {
  const shortHash = c.commit_hash ? String(c.commit_hash).slice(0, 7) : '';
  const dateText = c.last_commit_date ? new Date(c.last_commit_date).toLocaleDateString() : '';
  
  return `
    <div class="component-tile">
      <div class="component-header">
        <div class="component-name">${escapeHtml(c.name)}</div>
        <div class="component-type">${escapeHtml(c.type)}</div>
      </div>
      <div class="component-meta">
        <div class="meta-item">
          <span class="meta-label">Developer</span>
          <span class="meta-value">${escapeHtml(c.created_by || 'Unknown')}</span>
        </div>
        ${dateText ? `
        <div class="meta-item">
          <span class="meta-label">Last Updated</span>
          <span class="meta-value">${escapeHtml(dateText)}</span>
        </div>
        ` : ''}
        ${shortHash ? `
        <div class="meta-item">
          <span class="meta-label">Commit</span>
          <span class="meta-value">${escapeHtml(shortHash)}</span>
        </div>
        ` : ''}
      </div>
      ${c.url ? `<a href="${c.url}" target="_blank" rel="noopener" class="component-link">View Details</a>` : ''}
    </div>
  `;
}

/* ------------------ UPDATED FILTER BAR ------------------ */

function filterBar() {
  const wrap = document.createElement('div');
  wrap.className = 'story-filter-bar';
  wrap.innerHTML = `
    <!-- Right: Search and Filters -->
    <div class="filter-controls">
      <div class="search-in-group">
        <label class="filter-select">
          <select id="stories-in" aria-label="Search in">
            <option value="all" ${STORIES_STATE.in === 'all' ? 'selected' : ''}>All Fields</option>
            <option value="dev" ${STORIES_STATE.in === 'dev' ? 'selected' : ''}>Developers</option>
            <option value="comp" ${STORIES_STATE.in === 'comp' ? 'selected' : ''}>Components</option>
            <option value="story" ${STORIES_STATE.in === 'story' ? 'selected' : ''}>Story ID</option>
          </select>
        </label>
      </div>

      <div class="search-container">
        <input id="stories-q" class="search-input" type="search"
               placeholder="Search stories..." 
               value="${escapeHtml(STORIES_STATE.query)}" />
      </div>

      <div class="sort-group">
        <label class="filter-select">
          <select id="stories-sort" aria-label="Sort by">
            <option value="recent" ${STORIES_STATE.sort === 'recent' ? 'selected' : ''}>Recent</option>
            <option value="name" ${STORIES_STATE.sort === 'name' ? 'selected' : ''}>Story ID</option>
            <option value="components" ${STORIES_STATE.sort === 'components' ? 'selected' : ''}>Components</option>
          </select>
        </label>
      </div>
    </div>
  `;

  const input = wrap.querySelector('#stories-q');
  const sortSel = wrap.querySelector('#stories-sort');
  const inSel = wrap.querySelector('#stories-in');
  const scopeBtns = wrap.querySelectorAll('.scope-toggle .toggle-btn');

  // Events
  let t;
  input.addEventListener('input', (e) => {
    clearTimeout(t);
    t = setTimeout(() => {
      STORIES_STATE.query = e.target.value || '';
      localStorage.setItem('ui.stories.query', STORIES_STATE.query);
      renderStoriesTab(window.__analysis || {});
    }, 180);
  });

  sortSel.addEventListener('change', (e) => {
    STORIES_STATE.sort = e.target.value;
    localStorage.setItem('ui.stories.sort', STORIES_STATE.sort);
    renderStoriesTab(window.__analysis || {});
  });

  inSel.addEventListener('change', (e) => {
    STORIES_STATE.in = e.target.value;
    localStorage.setItem('ui.stories.in', STORIES_STATE.in);
    renderStoriesTab(window.__analysis || {});
  });

  scopeBtns.forEach(b => {
    b.addEventListener('click', () => {
      STORIES_STATE.scope = b.dataset.scope;
      localStorage.setItem('ui.stories.scope', STORIES_STATE.scope);
      renderStoriesTab(window.__analysis || {});
    });
  });

  return wrap;
}

/* ------------------ UPDATED UI UTILS ------------------ */

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

/* ------------------ UPDATED STYLES ------------------ */

let cssInjected = false;
function injectStoriesCss() {
  if (cssInjected) return;
  cssInjected = true;

  const css = `
  .stories-list {
    display: grid;
    gap: 16px;
    max-width: 800px;
    margin: 0 auto;
  }

  /* Main Card */
  .apple-story-card {
    background: #ffffff;
    border-radius: 16px;
    box-shadow: 0 2px 16px rgba(0, 0, 0, 0.08);
    border: 1px solid #e5e5e7;
    overflow: hidden;
    transition: all 0.2s ease;
  }

  .apple-story-card:hover {
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.12);
    transform: translateY(-1px);
  }

  /* Header */
  .story-header {
    padding: 20px 24px;
    position: relative;
  }

  .story-main {
    margin-bottom: 16px;
  }

  .story-title {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 8px;
  }

  .story-name {
    font-size: 20px;
    font-weight: 600;
    color: #1d1d1f;
    margin: 0;
    line-height: 1.2;
  }

  /* Status Badges */
  .status-badge {
    padding: 6px 12px;
    border-radius: 20px;
    font-size: 13px;
    font-weight: 600;
    border: 1.5px solid;
  }

  .status-conflict {
    background: #feeeed;
    color: #d70015;
    border-color: #ff3b30;
  }

  .status-safe {
    background: #e6f4ea;
    color: #0d7c37;
    border-color: #34c759;
  }

  /* Meta Info */
  .story-meta {
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 14px;
    color: #86868b;
    flex-wrap: wrap;
  }

  .developers-list {
    font-weight: 500;
    color: #1d1d1f;
  }

  .commit-sha {
    font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
    background: #f5f5f7;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 12px;
  }

  .commit-link {
    color: #007aff;
    text-decoration: none;
  }

  .commit-link:hover {
    text-decoration: underline;
  }

  /* Summary Grid */
  .story-summary {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
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
  .story-details {
    padding: 0 24px 24px;
    border-top: 1px solid #f5f5f7;
  }

  .components-section {
    margin-top: 16px;
  }

  .details-title {
    font-size: 16px;
    font-weight: 600;
    color: #1d1d1f;
    margin: 0 0 16px 0;
  }

  /* Components Grid */
  .components-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 12px;
  }

  .component-tile {
    background: #fbfbfd;
    border: 1px solid #e5e5e7;
    border-radius: 12px;
    padding: 16px;
    transition: all 0.2s ease;
  }

  .component-tile:hover {
    background: #f5f5f7;
    border-color: #d1d1d6;
  }

  .component-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 12px;
  }

  .component-name {
    font-weight: 600;
    color: #1d1d1f;
    font-size: 15px;
  }

  .component-type {
    font-size: 12px;
    color: #86868b;
    background: #e5e5e7;
    padding: 2px 8px;
    border-radius: 10px;
  }

  .component-meta {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-bottom: 12px;
  }

  .meta-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .meta-label {
    font-size: 12px;
    color: #86868b;
  }

  .meta-value {
    font-size: 13px;
    color: #1d1d1f;
    font-weight: 500;
  }

  .component-link {
    display: inline-block;
    padding: 6px 12px;
    background: #007aff;
    color: white;
    text-decoration: none;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 500;
    transition: background-color 0.2s ease;
  }

  .component-link:hover {
    background: #0056cc;
  }

  .no-components {
    text-align: center;
    color: #86868b;
    font-style: italic;
    padding: 20px;
  }

  /* Filter Bar */
  .story-filter-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
    margin-bottom: 24px;
    flex-wrap: wrap;
  }

  .filter-group {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .scope-toggle {
    display: flex;
    background: #f5f5f7;
    border-radius: 10px;
    padding: 4px;
    border: 1px solid #e5e5e7;
  }

  .toggle-btn {
    padding: 8px 16px;
    border: none;
    background: transparent;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .toggle-btn.active {
    background: #ffffff;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    color: #007aff;
  }

  .filter-controls {
    display: flex;
    gap: 12px;
    align-items: center;
    flex-wrap: wrap;
  }

  .search-in-group,
  .sort-group {
    display: flex;
    align-items: center;
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
    transition: border-color 0.2s ease;
  }

  .search-input:focus {
    outline: none;
    border-color: #007aff;
  }

  .filter-select select {
    padding: 10px 14px;
    border: 1px solid #e5e5e7;
    border-radius: 10px;
    font-size: 14px;
    background: #ffffff;
    cursor: pointer;
    min-width: 140px;
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

  /* Performance optimizations */
  .stories-list {
    will-change: transform;
    contain: layout style;
  }

  .apple-story-card {
    will-change: transform;
  }

  /* Dark Mode Support */
  @media (prefers-color-scheme: dark) {
    .apple-story-card {
      background: #1c1c1e;
      border-color: #38383a;
    }

    .story-name,
    .developers-list,
    .summary-value,
    .details-title,
    .component-name,
    .meta-value {
      color: #ffffff;
    }

    .story-meta,
    .summary-label,
    .component-type,
    .meta-label,
    .section-subtitle {
      color: #98989d;
    }

    .story-summary,
    .story-details {
      border-color: #38383a;
    }

    .expand-btn:hover {
      background: #2c2c2e;
    }

    .component-tile {
      background: #2c2c2e;
      border-color: #38383a;
    }

    .component-tile:hover {
      background: #3a3a3c;
    }

    .component-type {
      background: #38383a;
      color: #98989d;
    }

    .commit-sha {
      background: #38383a;
      color: #ffffff;
    }

    .search-input,
    .filter-select select {
      background: #2c2c2e;
      border-color: #38383a;
      color: #ffffff;
    }

    .scope-toggle {
      background: #2c2c2e;
      border-color: #38383a;
    }

    .toggle-btn.active {
      background: #38383a;
      color: #0a84ff;
    }

    .component-link {
      background: #0a84ff;
    }

    .component-link:hover {
      background: #409cff;
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