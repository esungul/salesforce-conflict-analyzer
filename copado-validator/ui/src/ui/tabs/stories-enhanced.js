// ui/src/ui/tabs/stories-enhanced.js
import { createFilterBar } from '../components/filterBar.js';
import { createStatusBadge } from '../components/statusBadge.js';

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
  const stories = rawStories.map(s => ({
    id: s.id || s.key || s.name || s.story_id || '',
    name: s.title || s.name || s.key || '',
    developer: s.developer || s.created_by || 'Unknown',
    component_count: s.component_count || 0,
    status: s.status || 'safe',
    jira_key: s.jira_key || s.key || '',
    commit_hash: (s.components && s.components[0]?.commit_hash) || '',
    components: s.components || []
  }));
console.log('Mapped stories:', stories); // Log mapped data

  let filtered = stories;
  

  if (STORIES_STATE.query.trim()) {
    const q = STORIES_STATE.query.toLowerCase();
    filtered = filtered.filter(s =>
      s.name.toLowerCase().includes(q) ||
      s.jira_key.toLowerCase().includes(q) ||
      s.developer.toLowerCase().includes(q)
    );
  }

  filtered.sort((a, b) => {
    if (STORIES_STATE.sort === 'name') {
      return a.name.localeCompare(b.name);
    }
    if (STORIES_STATE.sort === 'count') {
      return b.component_count - a.component_count;
    }
    const aDate = new Date(a.commit_date).getTime() || 0;
    const bDate = new Date(b.commit_date).getTime() || 0;
    return bDate - aDate;
  });

  panel.innerHTML = '';
  
  const header = createElement('div', { className: 'section-header' }, [
    createElement('h2', {}, 'Safe Stories'),
    createElement('p', { className: 'muted' }, `${filtered.length} story(ies) ready to deploy`)
  ]);
  panel.append(header);

  const SEARCH_DELAY = 1200;
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
      { value: 'count', label: 'Components' }
    ]
  });
  panel.append(filterBar);

  if (filtered.length === 0) {
    panel.append(emptyCard('No stories found', 'Try adjusting your filters'));
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
  console.log('Creating card for story:', story); // Log story object
  console.log('Commit hash:', story.commit_hash); // Log commit hash specifically
  const card = createElement('div', { className: 'story-card' });

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

  if (story.commit_date) {
    const date = new Date(story.commit_date);
    idsHtml += `
      <span class="commit-date">📅 ${date.toLocaleDateString()}</span>
    `;
  }

  ids.innerHTML = idsHtml;
  titleSection.append(title, ids);

  const status = createStatusBadge(story.status || 'safe');
  header.append(titleSection, status);
  card.append(header);

  // Meta info
  const meta = createElement('div', { className: 'story-meta' });
  
  if (story.developer) {
    const devInfo = createElement('div', { className: 'meta-item' });
    devInfo.innerHTML = `<span class="meta-label">Developer:</span> <span class="meta-value">${escapeHtml(story.developer)}</span>`;
    meta.append(devInfo);
  }

  if (story.component_count > 0) {
    const compInfo = createElement('div', { className: 'meta-item' });
    compInfo.innerHTML = `<span class="meta-label">Components:</span> <span class="meta-value">${story.component_count}</span>`;
    meta.append(compInfo);
  }

  if (story.commit_date) {
    const dateInfo = createElement('div', { className: 'meta-item' });
    const date = new Date(story.commit_date);
    dateInfo.innerHTML = `<span class="meta-label">Updated:</span> <span class="meta-value">${date.toLocaleDateString()}</span>`;
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
      compCard.innerHTML = `
        <div class="comp-header">
          <strong>${escapeHtml(comp.type || 'Component')}</strong>
          ${createStatusBadge(comp.status || 'safe', { small: true }).outerHTML}
        </div>
        <div class="comp-name">📦 ${escapeHtml(comp.api_name || 'Unknown')}</div>
        <div class="comp-details">
          <div><span class="label">In Production:</span> ${comp.production_story_id || 'N/A'}</div>
          <div><span class="label">Prod Story:</span> ${escapeHtml(comp.production_story_title || 'N/A')}</div>
          <div><span class="label">Prod Date:</span> ${comp.production_commit_date ? new Date(comp.production_commit_date).toLocaleDateString() : 'N/A'}</div>
          <div><span class="label">Current Date:</span> ${comp.story_commit_date ? new Date(comp.story_commit_date).toLocaleDateString() : 'N/A'}</div>
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
      .stories-list { display: flex; flex-direction: column; gap: 12px; }

      .story-card {
        background: white;
        border: 1px solid #e5e5e7;
        border-radius: 8px;
        padding: 16px;
        transition: all 0.3s ease;
      }

      .story-card:hover { box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08); border-color: #d2d2d7; }

      .story-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 12px;
        margin-bottom: 12px;
      }

      .story-title-section { flex: 1; }

      .story-title {
        margin: 0 0 6px;
        font-size: 15px;
        font-weight: 600;
        color: #1d1d1f;
        line-height: 1.4;
      }

      .story-ids {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }

      .story-id, .story-jira {
        display: inline-block;
        font-size: 12px;
        color: #86868b;
        font-family: monospace;
        background: #f5f5f7;
        padding: 2px 6px;
        border-radius: 4px;
      }

      .commit-info {
        margin: 8px 0;
        padding: 8px 0;
        border-bottom: 1px solid #f5f5f7;
      }

      .commit-link {
        font-size: 12px;
        color: #0071e3;
        text-decoration: none;
        transition: all 0.3s ease;
      }

      .commit-link:hover { text-decoration: underline; }

      .story-meta {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        gap: 12px;
        padding: 12px 0;
        border-bottom: 1px solid #f5f5f7;
        margin-bottom: 12px;
      }

      .meta-item { font-size: 13px; }

      .meta-label {
        color: #86868b;
        font-weight: 500;
      }

      .meta-value {
        color: #1d1d1f;
        margin-left: 4px;
      }

      .components-section { margin-top: 12px; }

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

      .comp-toggle:hover { background: #e8e8ed; }

      .components-list {
        margin-top: 8px;
        display: flex;
        flex-direction: column;
        gap: 8px;
        max-height: 500px;
        overflow-y: auto;
      }

      .components-list.hidden { display: none; }

      .component-item {
        background: #fafafa;
        border: 1px solid #e5e5e7;
        padding: 12px;
        border-radius: 6px;
        font-size: 12px;
      }

      .comp-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;
        font-weight: 600;
      }

      .comp-name {
        font-family: monospace;
        font-size: 11px;
        color: #0071e3;
        margin-bottom: 8px;
        word-break: break-all;
      }

      .comp-details {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
        font-size: 11px;
      }

      .comp-details div { color: #1d1d1f; }

      .comp-details .label {
        font-weight: 600;
        color: #86868b;
      }

      .empty-card {
        text-align: center;
        padding: 40px 20px;
        color: #86868b;
      }

      .empty-icon { font-size: 48px; margin-bottom: 12px; }

      .empty-card h3 {
        margin: 12px 0 4px;
        font-size: 16px;
        font-weight: 600;
        color: #1d1d1f;
      }

      .empty-card p { margin: 0; font-size: 13px; }

      @media (max-width: 768px) {
        .story-meta { grid-template-columns: 1fr; }
        .comp-details { grid-template-columns: 1fr; }
      }
    `;

    document.head.appendChild(Object.assign(document.createElement('style'), { textContent: css }));
  };
})();