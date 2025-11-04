// ui/src/ui/tabs/stories-enhanced.js
import { createFilterBar } from '../components/filterBar.js';

const $ = (s, r=document) => r.querySelector(s);

let STORIES_STATE = {
  query: localStorage.getItem('ui.stories.query') || '',
  status: localStorage.getItem('ui.stories.status') || 'all',
  sort: localStorage.getItem('ui.stories.sort') || 'recent'
};

export function renderStoriesTab(analysis = {}) {
  const panel = $('#tab-stories');
  if (!panel) return;

  const rawStories = Array.isArray(analysis.all_stories) ? analysis.all_stories : [];
  
  // FILTER: Only show stories with classification_tag: 'Safe with commit' or classification: 'safe'
  const safeStories = rawStories.filter(story => 
    story.classification_tag === 'Safe with commit' || 
    story.classification === 'safe'
  );

  const stories = safeStories.map(s => ({
    id: s.id || s.key || s.name || s.story_id || '',
    name: s.title || s.name || s.key || '',
    developer: s.developer || s.created_by || 'Unknown',
    component_count: s.component_count || 0,
    copado_status: s.classification_tag || s.classification || 'safe',
    jira_key: s.jira_key || s.key || '',
    commit_hash: (s.components && s.components[0]?.commit_hash) || '',
    components: s.components || [],
    commit_date: s.commit_date || (s.components && s.components[0]?.commit_date) || '',
    component_names: (s.components || []).map(comp => comp.api_name || '').filter(name => name)
  }));

  console.log('Mapped safe stories:', stories);

  let filtered = stories;

  if (STORIES_STATE.query.trim()) {
    const q = STORIES_STATE.query.toLowerCase();
    filtered = filtered.filter(s => {
      if (s.name.toLowerCase().includes(q)) return true;
      if (s.jira_key.toLowerCase().includes(q)) return true;
      if (s.developer.toLowerCase().includes(q)) return true;
      if (s.id.toLowerCase().includes(q)) return true;
      if (s.component_names.some(name => name.toLowerCase().includes(q))) return true;
      if (s.copado_status.toLowerCase().includes(q)) return true;
      return false;
    });
  }

  filtered.sort((a, b) => {
    if (STORIES_STATE.sort === 'name') {
      return a.name.localeCompare(b.name);
    }
    if (STORIES_STATE.sort === 'count') {
      return b.component_count - a.component_count;
    }
    if (STORIES_STATE.sort === 'status') {
      return a.copado_status.localeCompare(b.copado_status);
    }
    const aDate = new Date(a.commit_date).getTime() || 0;
    const bDate = new Date(b.commit_date).getTime() || 0;
    return bDate - aDate;
  });

 

panel.innerHTML = '';

const header = createElement('div', { className: 'section-header' }, [
  createElement('h2', { style: 'font-size: 24px; font-weight: 600; margin: 0 0 8px 0; color: white;' }, 'Safe Stories'),
  createElement('p', { className: 'muted', style: 'font-size: 24px; color: white; margin: 0;' }, 
    `${filtered.length} ${filtered.length === 1 ? 'story' : 'stories'} Ready to Deploy`
  )
]);
panel.append(header);


  

  const SEARCH_DELAY = 800;
  let searchTimeout;

  const filterBar = createFilterBar({
    query: STORIES_STATE.query,
    onQueryChange: (q) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        STORIES_STATE.query = q;
        localStorage.setItem('ui.stories.query', q);
        renderStoriesTab(analysis);
      }, SEARCH_DELAY);
    },
    sort: STORIES_STATE.sort,
    onSortChange: (s) => {
      STORIES_STATE.sort = s;
      localStorage.setItem('ui.stories.sort', s);
      renderStoriesTab(analysis);
    },
    sortOptions: [
      { value: 'recent', label: 'Recently Updated' },
      { value: 'name', label: 'Story Name' },
      { value: 'count', label: 'Component Count' },
      { value: 'status', label: 'Copado Status' }
    ]
  });
  panel.append(filterBar);

  if (filtered.length === 0) {
    panel.append(createEmptyCard('No safe stories found', 'Try adjusting your search or check back later'));
  } else {
    const storiesList = createElement('div', { className: 'stories-list' });
    filtered.forEach(story => {
      storiesList.append(createStoryCard(story));
    });
    panel.append(storiesList);
  }

  injectCss();
}

function createStoryCard(story) {
  console.log('Creating card for story:', story);

  const card = createElement('div', { className: 'story-card' });

  // Header with gradient background
  const header = createElement('div', { className: 'story-header' });
  
  const titleSection = createElement('div', { className: 'story-title-section' });
  const title = createElement('h3', { className: 'story-title' }, story.name);
  
  const ids = createElement('div', { className: 'story-ids' });
  let idsHtml = `
    <span class="story-id">${escapeHtml(story.id)}</span>
    <span class="story-jira">${escapeHtml(story.jira_key)}</span>
  `;

  if (story.commit_hash) {
    const bitbucketUrl = `https://bitbucket.org/lla-dev/copado_lla/commits/${story.commit_hash}`;
    idsHtml += `
      <a href="${bitbucketUrl}" target="_blank" class="story-commit">
        📌 ${story.commit_hash.substring(0, 7)}
      </a>
    `;
  }

  ids.innerHTML = idsHtml;
  titleSection.append(title, ids);

  // PROBLEM 1: Show actual Copado status from response
  const status = createElement('div', { 
    className: `copado-status ${getStatusClass(story.copado_status)}` 
  }, `Copado: ${story.copado_status}`);
  header.append(titleSection, status);
  card.append(header);

  // Meta info
  const meta = createElement('div', { className: 'story-meta' });
  
  if (story.developer) {
    const devInfo = createElement('div', { className: 'meta-item' });
    devInfo.innerHTML = `
      <div class="meta-icon">👨‍💻</div>
      <div class="meta-content">
        <div class="meta-label">Developer</div>
        <div class="meta-value">${escapeHtml(story.developer)}</div>
      </div>
    `;
    meta.append(devInfo);
  }

  if (story.component_count > 0) {
    const compInfo = createElement('div', { className: 'meta-item' });
    compInfo.innerHTML = `
      <div class="meta-icon">📦</div>
      <div class="meta-content">
        <div class="meta-label">Components</div>
        <div class="meta-value">${story.component_count}</div>
      </div>
    `;
    meta.append(compInfo);
  }

  if (story.commit_date) {
    const dateInfo = createElement('div', { className: 'meta-item' });
    const date = new Date(story.commit_date);
    dateInfo.innerHTML = `
      <div class="meta-icon">📅</div>
      <div class="meta-content">
        <div class="meta-label">Last Updated</div>
        <div class="meta-value">${date.toLocaleDateString()}</div>
      </div>
    `;
    meta.append(dateInfo);
  }

  card.append(meta);

  // Components (Collapsible)
  if (story.components && story.components.length > 0) {
    const compSection = createElement('div', { className: 'components-section' });
    
    const compToggle = createElement('button', { 
      className: 'comp-toggle',
      type: 'button'
    }, `▼ Show ${story.components.length} Components`);

    const compList = createElement('div', { className: 'components-list hidden' });

    story.components.forEach((comp, idx) => {
      const compCard = createElement('div', { className: 'component-item' });
      
      // PROBLEM 1: Show actual component status from response
      const compStatus = comp.status || 'safe';
      const statusClass = getStatusClass(compStatus);
      const statusText = comp.status || 'No Status';
      
      compCard.innerHTML = `
        <div class="comp-header">
          <div class="comp-type-badge">${comp.type || 'Component'}</div>
          <div class="comp-status ${statusClass}">
            ${statusText}
          </div>
        </div>
        <div class="comp-name">📦 ${escapeHtml(comp.api_name || 'Unknown')}</div>
        <div class="comp-details">
          <div class="detail-row">
            <span class="label">In Production:</span> 
            <span class="value">${comp.production_story_id || 'N/A'}</span>
          </div>
          <div class="detail-row">
            <span class="label">Prod Story:</span> 
            <span class="value">${escapeHtml(comp.production_story_title || 'N/A')}</span>
          </div>
          <div class="detail-row">
            <span class="label">Prod Date:</span> 
            <span class="value">${comp.production_commit_date ? new Date(comp.production_commit_date).toLocaleDateString() : 'N/A'}</span>
          </div>
          <div class="detail-row">
            <span class="label">Current Date:</span> 
            <span class="value">${comp.story_commit_date ? new Date(comp.story_commit_date).toLocaleDateString() : 'N/A'}</span>
          </div>
        </div>
      `;
      compList.append(compCard);
    });

    compToggle.addEventListener('click', () => {
      compList.classList.toggle('hidden');
      compToggle.textContent = compList.classList.contains('hidden') 
        ? `▶ Show ${story.components.length} Components`
        : `▼ Hide ${story.components.length} Components`;
    });

    compSection.append(compToggle, compList);
    card.append(compSection);
  }

  return card;
}

// PROBLEM 1: Helper function to get CSS class based on status
function getStatusClass(status) {
  if (!status) return 'status-unknown';
  
  const statusLower = status.toLowerCase();
  if (statusLower.includes('safe') || statusLower.includes('complete')) {
    return 'status-safe';
  } else if (statusLower.includes('conflict') || statusLower.includes('blocked')) {
    return 'status-conflict';
  } else if (statusLower.includes('warning') || statusLower.includes('partial')) {
    return 'status-warning';
  } else {
    return 'status-unknown';
  }
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

function createEmptyCard(title, subtitle) {
  const card = createElement('div', { className: 'empty-card' });
  card.innerHTML = `
    <div class="empty-icon">📭</div>
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
      /* Modern styling matching precheck.js */
      .section-header {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border-radius: 18px;
        padding: 30px;
        text-align: center;
        margin-bottom: 24px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
      }

      .section-title {
        font-size: 28px;
        font-weight: 700;
        margin: 0 0 16px 0;
        color: white;
      }

      /* PROBLEM 3: Bigger number in white with corrected spelling */
      .stories-count-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
      }

      .stories-count-number {
        font-size: 48px;
        font-weight: 800;
        color: white;
        line-height: 1;
        text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
      }

      .stories-count-label {
        font-size: 16px;
        opacity: 0.9;
        font-weight: 500;
      }

      .stories-list { 
        display: flex; 
        flex-direction: column; 
        gap: 16px; 
      }

      .story-card {
        background: white;
        border: 1px solid #e5e5e7;
        border-radius: 18px;
        padding: 0;
        transition: all 0.3s ease;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
        overflow: hidden;
      }

      .story-card:hover { 
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12); 
        border-color: #d2d2d7; 
        transform: translateY(-2px);
      }

      .story-header {
        background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
        padding: 24px;
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 16px;
        border-bottom: 1px solid #e5e5e7;
      }

      .story-title-section { 
        flex: 1; 
      }

      .story-title {
        margin: 0 0 12px;
        font-size: 18px;
        font-weight: 700;
        color: #1d1d1f;
        line-height: 1.4;
      }

      .story-ids {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        align-items: center;
      }

      .story-id, .story-jira {
        display: inline-block;
        font-size: 12px;
        color: #666666;
        font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
        background: rgba(255, 255, 255, 0.8);
        padding: 4px 8px;
        border-radius: 6px;
        font-weight: 600;
        border: 1px solid rgba(0, 0, 0, 0.1);
      }

      .story-commit {
        font-size: 12px;
        color: #0071e3;
        text-decoration: none;
        background: rgba(255, 255, 255, 0.8);
        padding: 4px 8px;
        border-radius: 6px;
        font-weight: 600;
        border: 1px solid rgba(0, 113, 227, 0.2);
        transition: all 0.2s ease;
      }

      .story-commit:hover {
        background: #0071e3;
        color: white;
        text-decoration: none;
      }

      /* PROBLEM 1: Copado status styling */
      .copado-status {
        padding: 8px 12px;
        border-radius: 8px;
        font-size: 12px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        white-space: nowrap;
      }

      .status-safe {
        background: #e8f5e9;
        color: #1b5e20;
        border: 1px solid #a5d6a7;
      }

      .status-conflict {
        background: #ffebee;
        color: #b71c1c;
        border: 1px solid #ef9a9a;
      }

      .status-warning {
        background: #fff3e0;
        color: #e65100;
        border: 1px solid #ffb74d;
      }

      .status-unknown {
        background: #f5f5f5;
        color: #666666;
        border: 1px solid #e0e0e0;
      }

      .story-meta {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 16px;
        padding: 24px;
        border-bottom: 1px solid #f5f5f7;
      }

      .meta-item {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px;
        background: #f8f9fa;
        border-radius: 12px;
        transition: all 0.2s ease;
      }

      .meta-item:hover {
        background: #e9ecef;
        transform: translateY(-1px);
      }

      .meta-icon {
        font-size: 16px;
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: white;
        border-radius: 8px;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      }

      .meta-content {
        flex: 1;
      }

      .meta-label {
        font-size: 11px;
        color: #666666;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin-bottom: 2px;
      }

      .meta-value {
        font-size: 14px;
        color: #1d1d1f;
        font-weight: 600;
      }

      .components-section { 
        margin: 0; 
      }

      .comp-toggle {
        background: #f8f9fa;
        border: none;
        padding: 16px 24px;
        border-radius: 0;
        cursor: pointer;
        font-size: 14px;
        font-weight: 600;
        color: #1d1d1f;
        width: 100%;
        text-align: left;
        transition: all 0.3s ease;
        border-top: 1px solid #e5e5e7;
      }

      .comp-toggle:hover { 
        background: #e9ecef; 
        color: #0071e3;
      }

      .components-list {
        padding: 0 24px 24px;
        display: flex;
        flex-direction: column;
        gap: 12px;
        max-height: 500px;
        overflow-y: auto;
      }

      .components-list.hidden { 
        display: none; 
      }

      .component-item {
        background: white;
        border: 1px solid #e5e5e7;
        padding: 16px;
        border-radius: 12px;
        font-size: 13px;
        transition: all 0.2s ease;
      }

      .component-item:hover {
        border-color: #0071e3;
        box-shadow: 0 2px 8px rgba(0, 113, 227, 0.1);
      }

      .comp-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
      }

      .comp-type-badge {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 4px 8px;
        border-radius: 6px;
        font-size: 11px;
        font-weight: 600;
      }

      .comp-status {
        padding: 4px 8px;
        border-radius: 6px;
        font-size: 11px;
        font-weight: 600;
      }

      .empty-card {
        text-align: center;
        padding: 60px 40px;
        color: #86868b;
        background: white;
        border-radius: 18px;
        border: 2px dashed #e5e5e7;
      }

      .empty-icon { 
        font-size: 64px; 
        margin-bottom: 16px; 
        opacity: 0.5;
      }

      .empty-card h3 {
        margin: 16px 0 8px;
        font-size: 20px;
        font-weight: 600;
        color: #1d1d1f;
      }

      .empty-card p { 
        margin: 0; 
        font-size: 14px; 
        color: #666666;
      }

      /* Modern filter bar styling */
      .filter-bar {
        background: white;
        border-radius: 12px;
        padding: 16px;
        margin-bottom: 24px;
        border: 1px solid #e5e5e7;
        display: flex;
        gap: 12px;
        align-items: center;
      }

      .filter-bar input {
        flex: 1;
        padding: 12px 16px;
        border: 1px solid #d2d2d7;
        border-radius: 8px;
        font-size: 14px;
        transition: all 0.2s ease;
      }

      .filter-bar input:focus {
        outline: none;
        border-color: #0071e3;
        box-shadow: 0 0 0 3px rgba(0, 113, 227, 0.1);
      }

      .filter-bar input::placeholder {
        color: #86868b;
      }

      .filter-bar select {
        padding: 12px 16px;
        border: 1px solid #d2d2d7;
        border-radius: 8px;
        font-size: 14px;
        background: white;
        cursor: pointer;
        transition: all 0.2s ease;
      }

      .filter-bar select:focus {
        outline: none;
        border-color: #0071e3;
        box-shadow: 0 0 0 3px rgba(0, 113, 227, 0.1);
      }

      @media (max-width: 768px) {
        .story-meta { 
          grid-template-columns: 1fr; 
        }
        .comp-details { 
          grid-template-columns: 1fr; 
        }
        .filter-bar {
          flex-direction: column;
        }
        .filter-bar input,
        .filter-bar select {
          width: 100%;
        }
        .story-header {
          flex-direction: column;
          align-items: flex-start;
        }
        
        .stories-count-number {
          font-size: 36px;
        }
      }
    `;

    document.head.appendChild(Object.assign(document.createElement('style'), { textContent: css }));
  };
})();