// ui/src/ui/tabs/enforcement-enhanced.js
import { createFilterBar } from '../components/filterBar.js';
import { createStatusBadge } from '../components/statusBadge.js';

const $ = (s, r=document) => r.querySelector(s);

let ENF_STATE = {
  query: localStorage.getItem('ui.enf.query') || '',
  sort: localStorage.getItem('ui.enf.sort') || 'recent'
};

export function renderEnforcementTab(analysis = {}) {
  const panel = $('#tab-enforcement');
  if (!panel) return;

  const rawBlocked = Array.isArray(analysis.blocked_stories) ? analysis.blocked_stories : [];

  if (!rawBlocked.length) {
    panel.innerHTML = '';
    panel.append(
      createElement('div', { className: 'section-header' }, [
        createElement('h2', {}, 'Enforcement / Blocked'),
        createElement('p', { className: 'muted' }, 'No blocked stories detected')
      ])
    );
    panel.append(emptyCard('All clear!', 'No stories are blocked by production dependencies.'));
    injectCss();
    return;
  }

  // Process blocked stories with their components
  const blockedStories = rawBlocked.map(story => ({
    // Story info
    story_id: story.story_id,
    title: story.title || story.name || '',
    developer: story.developer || 'Unknown',
    jira_key: story.jira_key || '',
    component_count: story.component_count || 0,
    
    // Components causing the block
    components: (story.components || []).map(comp => ({
      id: comp.id,
      type: comp.type,
      name: comp.api_name,
      status: comp.status,
      commit_hash: comp.commit_hash,
      commit_date: comp.story_commit_date,
      
      // Blocking reasons
      has_old_commit: comp.has_old_commit || false,
      production_story_id: comp.production_story_id,
      production_story_title: comp.production_story_title,
      production_commit_date: comp.production_commit_date,
      story_commit_date: comp.story_commit_date,
      
      // Additional blocking info
      reason: comp.has_old_commit ? 
        `Component version is older than production` : 
        (comp.reason || 'Production dependency detected')
    }))
  }));

  let filtered = blockedStories;

  if (ENF_STATE.query.trim()) {
    const q = ENF_STATE.query.toLowerCase();
    filtered = filtered.filter(story =>
      story.title.toLowerCase().includes(q) ||
      story.jira_key.toLowerCase().includes(q) ||
      story.developer.toLowerCase().includes(q) ||
      story.story_id.toLowerCase().includes(q)
    );
  }

  filtered.sort((a, b) => {
    if (ENF_STATE.sort === 'name') {
      return a.title.localeCompare(b.title);
    }
    if (ENF_STATE.sort === 'components') {
      return b.component_count - a.component_count;
    }
    // Default sort by recent (using first component's date)
    const aDate = a.components[0] ? new Date(a.components[0].commit_date).getTime() : 0;
    const bDate = b.components[0] ? new Date(b.components[0].commit_date).getTime() : 0;
    return bDate - aDate;
  });

  panel.innerHTML = '';
  
  const header = createElement('div', { className: 'section-header' }, [
    createElement('h2', {}, 'Enforcement / Blocked'),
    createElement('p', { className: 'muted' }, 
      `${filtered.length} story(ies) blocked by production dependencies`)
  ]);
  panel.append(header);

  const SEARCH_DELAY = 300;
  let searchTimeout;

  const filterBar = createFilterBar({
    query: ENF_STATE.query,
    onQueryChange: (q) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        ENF_STATE.query = q;
        localStorage.setItem('ui.enf.query', q);
        renderEnforcementTab(analysis);
      }, SEARCH_DELAY);
    },
    sort: ENF_STATE.sort,
    onSortChange: (s) => {
      ENF_STATE.sort = s;
      localStorage.setItem('ui.enf.sort', s);
      renderEnforcementTab(analysis);
    },
    sortOptions: [
      { value: 'recent', label: 'Recently Updated' },
      { value: 'name', label: 'Story Name' },
      { value: 'components', label: 'Blocking Components' }
    ]
  });
  panel.append(filterBar);

  if (filtered.length === 0) {
    panel.append(emptyCard('No blocked stories match filters', 'Try adjusting your search criteria.'));
  } else {
    const enfList = createElement('div', { className: 'enforcement-list' });
    filtered.forEach(story => {
      enfList.append(createEnforcementCard(story));
    });
    panel.append(enfList);
  }

  injectCss();
}

function createEnforcementCard(story) {
  const card = createElement('div', { className: 'enforcement-card' });

  // Header with story info
  const header = createElement('div', { className: 'enforcement-header' });
  
  const titleSection = createElement('div', { className: 'enforcement-title-section' });
  const title = createElement('h3', { className: 'enforcement-title' }, story.title);
  
  const storyInfo = createElement('div', { className: 'enforcement-story-info' });
  let storyInfoHtml = `
    <span class="story-id">${escapeHtml(story.story_id)}</span>
    <span class="story-jira">${escapeHtml(story.jira_key)}</span>
    <span class="story-developer">👤 ${escapeHtml(story.developer)}</span>
  `;
  storyInfo.innerHTML = storyInfoHtml;
  
  titleSection.append(title, storyInfo);
  
  const status = createStatusBadge('blocked');
  header.append(titleSection, status);
  card.append(header);

  // Blocking summary
  const summary = createElement('div', { className: 'blocking-summary' });
  const oldCommitCount = story.components.filter(comp => comp.has_old_commit).length;
  
  summary.innerHTML = `
    <div class="summary-item">
      <span class="summary-label">Blocking Components:</span>
      <span class="summary-value">${story.component_count}</span>
    </div>
    <div class="summary-item">
      <span class="summary-label">Outdated Components:</span>
      <span class="summary-value ${oldCommitCount > 0 ? 'warning' : ''}">${oldCommitCount}</span>
    </div>
  `;
  card.append(summary);

  // Components section (Collapsible)
  if (story.components && story.components.length > 0) {
    const compSection = createElement('div', { className: 'components-section' });
    
    const compToggle = createElement('button', { 
      className: 'comp-toggle',
      type: 'button'
    }, `🔍 Show ${story.components.length} Blocking Components`);

    const compList = createElement('div', { className: 'components-list hidden' });

    story.components.forEach((comp, idx) => {
      const compCard = createElement('div', { 
        className: `component-item ${comp.has_old_commit ? 'has-old-commit' : ''}`
      });
      
      let compHtml = `
        <div class="comp-header">
          <div class="comp-type-name">
            <span class="comp-type">${escapeHtml(comp.type)}</span>
            <strong class="comp-name">${escapeHtml(comp.name)}</strong>
          </div>
          ${comp.has_old_commit ? '<span class="old-commit-badge">🕐 OLDER VERSION</span>' : ''}
        </div>
      `;

      // Add commit hash link
      if (comp.commit_hash) {
        const bitbucketUrl = `https://bitbucket.org/lla-dev/copado_lla/commits/${comp.commit_hash}`;
        compHtml += `
          <div class="comp-commit">
            <a href="${bitbucketUrl}" target="_blank" class="commit-link">
              🔐 ${comp.commit_hash.substring(0, 7)}
            </a>
          </div>
        `;
      }

      // Add blocking reason and dates
      compHtml += `
        <div class="comp-reason">
          <strong>Blocking Reason:</strong> ${escapeHtml(comp.reason)}
        </div>
        <div class="comp-dates">
      `;

      // Show date comparison for old commits
      if (comp.has_old_commit) {
        const storyDate = comp.story_commit_date ? new Date(comp.story_commit_date) : null;
        const prodDate = comp.production_commit_date ? new Date(comp.production_commit_date) : null;
        
        compHtml += `
          <div class="date-comparison">
            <div class="date-item outdated">
              <span class="date-label">Your Version:</span>
              <span class="date-value">${storyDate ? storyDate.toLocaleDateString() : 'Unknown'}</span>
            </div>
            <div class="date-item current">
              <span class="date-label">Production Version:</span>
              <span class="date-value">${prodDate ? prodDate.toLocaleDateString() : 'Unknown'}</span>
            </div>
          </div>
        `;
      }

      // Add production story info if available
      if (comp.production_story_id) {
        compHtml += `
          <div class="production-info">
            <span class="prod-label">Production Story:</span>
            <span class="prod-value">${escapeHtml(comp.production_story_id)}</span>
            ${comp.production_story_title ? `<div class="prod-title">${escapeHtml(comp.production_story_title)}</div>` : ''}
          </div>
        `;
      }

      compHtml += `</div>`; // Close comp-dates
      compCard.innerHTML = compHtml;
      compList.append(compCard);
    });

    compToggle.addEventListener('click', () => {
      compList.classList.toggle('hidden');
      compToggle.textContent = compList.classList.contains('hidden') 
        ? `🔍 Show ${story.components.length} Blocking Components`
        : `🔍 Hide ${story.components.length} Components`;
    });

    compSection.append(compToggle, compList);
    card.append(compSection);
  }

  return card;
}

function createElement(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  Object.assign(node, props);
  const childArray = Array.isArray(children) ? children : children ? [children] : [];
  childArray.forEach(child => {
    if (typeof child === 'string') {
      node.appendChild(document.createTextNode(child));
    } else if (child instanceof Node) {
      node.appendChild(child);
    }
  });
  return node;
}

function emptyCard(title, subtitle) {
  const card = createElement('div', { className: 'empty-card' });
  card.innerHTML = `
    <div class="empty-icon">✓</div>
    <h3>${escapeHtml(title)}</h3>
    <p>${escapeHtml(subtitle)}</p>
  `;
  return card;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

const injectCss = (() => {
  let done = false;
  return () => {
    if (done) return;
    done = true;

    const css = `
      .enforcement-list { display: flex; flex-direction: column; gap: 16px; }

      .enforcement-card {
        background: white;
        border: 1px solid #e5e5e7;
        border-radius: 8px;
        padding: 16px;
        transition: all 0.3s ease;
        border-left: 4px solid #FF3B30;
      }

      .enforcement-card:hover { 
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08); 
        border-color: #d2d2d7; 
      }

      .enforcement-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 12px;
        margin-bottom: 12px;
        padding-bottom: 12px;
        border-bottom: 1px solid #f5f5f7;
      }

      .enforcement-title-section { flex: 1; }

      .enforcement-title {
        margin: 0 0 8px;
        font-size: 16px;
        font-weight: 600;
        color: #1d1d1f;
        line-height: 1.4;
      }

      .enforcement-story-info {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }

      .story-id, .story-jira, .story-developer {
        display: inline-block;
        font-size: 12px;
        color: #86868b;
        background: #f5f5f7;
        padding: 4px 8px;
        border-radius: 4px;
      }

      .blocking-summary {
        display: flex;
        gap: 24px;
        margin-bottom: 12px;
        padding: 12px;
        background: #fff3f3;
        border-radius: 6px;
        border: 1px solid #ffd1d1;
      }

      .summary-item {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .summary-label {
        font-size: 12px;
        color: #86868b;
        font-weight: 600;
      }

      .summary-value {
        font-size: 16px;
        font-weight: 700;
        color: #1d1d1f;
      }

      .summary-value.warning {
        color: #FF3B30;
      }

      .components-section {
        margin-top: 12px;
      }

      .comp-toggle {
        background: #f5f5f7;
        border: 1px solid #e5e5e7;
        padding: 8px 12px;
        border-radius: 6px;
        cursor: pointer;
        font-size: 13px;
        font-weight: 600;
        color: #1d1d1f;
        width: 100%;
        text-align: left;
        transition: all 0.3s ease;
      }

      .comp-toggle:hover { 
        background: #e8e8ed; 
      }

      .components-list {
        margin-top: 8px;
        display: flex;
        flex-direction: column;
        gap: 8px;
        max-height: 500px;
        overflow-y: auto;
      }

      .components-list.hidden { 
        display: none; 
      }

      .component-item {
        background: #fafafa;
        border: 1px solid #e5e5e7;
        padding: 12px;
        border-radius: 6px;
        font-size: 12px;
      }

      .component-item.has-old-commit {
        background: #fff3f3;
        border-color: #ffd1d1;
        border-left: 3px solid #FF3B30;
      }

      .comp-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 8px;
        gap: 8px;
      }

      .comp-type-name {
        flex: 1;
      }

      .comp-type {
        font-size: 11px;
        font-weight: 600;
        color: #86868b;
        background: #f5f5f7;
        padding: 2px 6px;
        border-radius: 4px;
        margin-right: 6px;
      }

      .comp-name {
        font-size: 13px;
        color: #1d1d1f;
        font-family: monospace;
        word-break: break-all;
      }

      .old-commit-badge {
        font-size: 10px;
        font-weight: 700;
        color: #FF3B30;
        background: #ffebea;
        padding: 4px 6px;
        border-radius: 4px;
        white-space: nowrap;
      }

      .comp-commit {
        margin-bottom: 8px;
      }

      .commit-link {
        font-size: 11px;
        color: #0071e3;
        text-decoration: none;
        background: #e8f0ff;
        padding: 2px 6px;
        border-radius: 4px;
      }

      .commit-link:hover {
        background: #d4e4ff;
        text-decoration: underline;
      }

      .comp-reason {
        font-size: 12px;
        color: #1d1d1f;
        margin-bottom: 8px;
        padding: 4px 0;
      }

      .comp-reason strong {
        color: #FF3B30;
      }

      .comp-dates {
        font-size: 11px;
      }

      .date-comparison {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
        margin-bottom: 8px;
      }

      .date-item {
        padding: 6px 8px;
        border-radius: 4px;
        border: 1px solid #e5e5e7;
      }

      .date-item.outdated {
        background: #fff3f3;
        border-color: #ffd1d1;
      }

      .date-item.current {
        background: #f0fff4;
        border-color: #d4ffdf;
      }

      .date-label {
        display: block;
        font-weight: 600;
        color: #86868b;
        font-size: 10px;
        margin-bottom: 2px;
      }

      .date-value {
        display: block;
        color: #1d1d1f;
        font-weight: 600;
      }

      .production-info {
        padding: 6px 0;
        border-top: 1px solid #f5f5f7;
        margin-top: 6px;
      }

      .prod-label {
        font-weight: 600;
        color: #86868b;
        margin-right: 4px;
      }

      .prod-value {
        color: #1d1d1f;
        font-family: monospace;
      }

      .prod-title {
        font-size: 11px;
        color: #86868b;
        margin-top: 2px;
        font-style: italic;
      }

      .empty-card {
        text-align: center;
        padding: 40px 20px;
        color: #86868b;
      }

      .empty-icon { 
        font-size: 48px; 
        margin-bottom: 12px; 
      }

      .empty-card h3 {
        margin: 12px 0 4px;
        font-size: 16px;
        font-weight: 600;
        color: #1d1d1f;
      }

      .empty-card p { 
        margin: 0; 
        font-size: 13px; 
      }

      @media (max-width: 768px) {
        .blocking-summary {
          flex-direction: column;
          gap: 12px;
        }
        
        .date-comparison {
          grid-template-columns: 1fr;
        }
        
        .comp-header {
          flex-direction: column;
          align-items: flex-start;
          gap: 6px;
        }
      }
    `;

    document.head.appendChild(Object.assign(document.createElement('style'), { textContent: css }));
  };
})();