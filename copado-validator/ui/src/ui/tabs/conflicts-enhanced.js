// ui/src/ui/tabs/conflicts-enhanced.js
import { createFilterBar } from '../components/filterBar.js';
import { createStatusBadge } from '../components/statusBadge.js';

const $ = (s, r=document) => r.querySelector(s);

let CONFLICTS_STATE = {
  query: localStorage.getItem('ui.conflicts.query') || '',
  sort: localStorage.getItem('ui.conflicts.sort') || 'risk'
};

// Cache for better performance
let CONFLICTS_CACHE = {
  rawData: null,
  processedConflicts: null,
  lastAnalysis: null
};

function getSeverity(status) {
  const normalized = String(status || '').toLowerCase();
  if (/critical|blocker|back.promoted/i.test(normalized)) return 3;
  if (/medium|warn|risk|potential/i.test(normalized)) return 2;
  if (/low|info/i.test(normalized)) return 1;
  return 0;
}

// Debounce function to prevent excessive filtering
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

function processConflictsData(analysis) {
  // Return cached data if analysis hasn't changed
  if (CONFLICTS_CACHE.lastAnalysis === analysis) {
    return CONFLICTS_CACHE.processedConflicts;
  }

  const rawConflicts = Array.isArray(analysis.component_conflicts) ? analysis.component_conflicts : [];
  const summary = analysis.summary || {};
  
  // Calculate actual conflict counts
  const totalComponentsWithConflicts = summary.components_with_conflicts || 0;
  const totalStoriesWithConflicts = summary.stories_with_conflicts || rawConflicts.length;

  // Flatten conflicts to show each component conflict individually
  const conflicts = [];
  rawConflicts.forEach(conflictStory => {
    if (conflictStory.components && Array.isArray(conflictStory.components)) {
      conflictStory.components.forEach(component => {
        conflicts.push({
          // Story info
          story_id: conflictStory.story_id,
          story_title: conflictStory.title,
          developer: conflictStory.developer,
          jira_key: conflictStory.jira_key,
          
          // Component info
          component: {
            id: component.id,
            type: component.type,
            name: component.api_name,
            status: component.status,
            commit_hash: component.commit_hash,
            commit_date: component.story_commit_date,
            commit_url: component.commit_url,
            
            // Conflicting stories
            conflicting_stories: component.conflicting_stories || [],
            
            // Production info
            production_story_id: component.production_story_id,
            production_story_title: component.production_story_title,
            production_commit_date: component.production_commit_date
          },
          
          // Pre-computed search fields for performance
          searchFields: [
            conflictStory.story_id?.toLowerCase() || '',
            conflictStory.title?.toLowerCase() || '',
            conflictStory.developer?.toLowerCase() || '',
            conflictStory.jira_key?.toLowerCase() || '',
            component.api_name?.toLowerCase() || '',
            component.type?.toLowerCase() || '',
            component.status?.toLowerCase() || ''
          ].join(' ')
        });
      });
    }
  });

  // Cache the results
  CONFLICTS_CACHE = {
    rawData: analysis,
    processedConflicts: {
      conflicts,
      totalComponentsWithConflicts,
      totalStoriesWithConflicts
    },
    lastAnalysis: analysis
  };

  return CONFLICTS_CACHE.processedConflicts;
}

export function renderConflictsTab(analysis = {}) {
  const panel = $('#tab-conflicts');
  if (!panel) return;

  // Show loading state immediately
  panel.innerHTML = '<div class="loading-state">Loading conflicts...</div>';
  
  // Use setTimeout to allow UI to update before heavy processing
  setTimeout(() => {
    try {
      const processedData = processConflictsData(analysis);
      const { conflicts, totalStoriesWithConflicts } = processedData;

      if (!conflicts.length) {
        panel.innerHTML = '';
        panel.append(
          createElement('div', { className: 'section-header' }, [
            createElement('h2', {}, 'Conflicts'),
            createElement('p', { className: 'muted' }, 'No conflicts detected')
          ])
        );
        panel.append(emptyCard('All clear!', 'No conflicts detected in this analysis.'));
        injectCss();
        return;
      }

      // Filter conflicts
      let filtered = conflicts;
      const query = CONFLICTS_STATE.query.trim().toLowerCase();

      if (query) {
        filtered = conflicts.filter(conflict => 
          conflict.searchFields.includes(query)
        );
      }

      // Sort conflicts
      filtered.sort((a, b) => {
        if (CONFLICTS_STATE.sort === 'name') {
          return (a.component.name || '').localeCompare(b.component.name || '');
        }
        if (CONFLICTS_STATE.sort === 'type') {
          return (a.component.type || '').localeCompare(b.component.type || '');
        }
        const aSev = getSeverity(a.component.status);
        const bSev = getSeverity(b.component.status);
        return bSev - aSev;
      });

      renderConflictsUI(panel, filtered, totalStoriesWithConflicts, analysis);
    } catch (error) {
      console.error('Error rendering conflicts:', error);
      panel.innerHTML = '';
      panel.append(emptyCard('Error loading conflicts', 'Please try refreshing the page.'));
    }
  }, 10);
}

function renderConflictsUI(panel, filteredConflicts, totalStoriesWithConflicts, analysis) {
  panel.innerHTML = '';
  
  const header = createElement('div', { className: 'section-header' }, [
    createElement('h2', {}, 'Conflicts'),
    createElement('p', { className: 'muted' }, 
      `${filteredConflicts.length} component conflict(s) across ${totalStoriesWithConflicts} stories`)
  ]);
  panel.append(header);

  // Debounced search handler
  const handleSearchChange = debounce((query) => {
    CONFLICTS_STATE.query = query;
    localStorage.setItem('ui.conflicts.query', query);
    
    // Re-render with current analysis data (uses cache)
    renderConflictsTab(analysis);
  }, 300); // 300ms debounce

  const handleSortChange = (sort) => {
    CONFLICTS_STATE.sort = sort;
    localStorage.setItem('ui.conflicts.sort', sort);
    
    // Re-render with current analysis data (uses cache)
    renderConflictsTab(analysis);
  };

  const filterBar = createFilterBar({
    query: CONFLICTS_STATE.query,
    onQueryChange: handleSearchChange,
    sort: CONFLICTS_STATE.sort,
    onSortChange: handleSortChange,
    sortOptions: [
      { value: 'risk', label: 'Risk Level' },
      { value: 'name', label: 'Component Name' },
      { value: 'type', label: 'Component Type' }
    ]
  });
  panel.append(filterBar);

  if (filteredConflicts.length === 0) {
    panel.append(emptyCard('No conflicts match filters', 'Try adjusting your search'));
  } else {
    const conflictsList = createElement('div', { className: 'conflicts-list' });
    
    // Use document fragment for batch DOM updates
    const fragment = document.createDocumentFragment();
    filteredConflicts.forEach(conflict => {
      fragment.appendChild(createConflictCard(conflict));
    });
    conflictsList.appendChild(fragment);
    
    panel.append(conflictsList);
  }

  injectCss();
}

// ... (keep the existing createConflictCard function exactly as is)

function createConflictCard(conflict) {
  const card = createElement('div', { className: 'conflict-card' });

  // Header with story info
  const header = createElement('div', { className: 'conflict-header' });
  
  const titleSection = createElement('div', { className: 'conflict-title-section' });
  const storyTitle = createElement('h3', { className: 'conflict-story-title' }, conflict.story_title);
  
  const storyInfo = createElement('div', { className: 'conflict-story-info' });
  let storyInfoHtml = `
    <span class="story-id">${escapeHtml(conflict.story_id)}</span>
    <span class="story-jira">${escapeHtml(conflict.jira_key)}</span>
    <span class="story-developer">👤 ${escapeHtml(conflict.developer)}</span>
  `;

  // Add commit hash link like in stories-enhanced.js
  if (conflict.component.commit_hash) {
    const bitbucketUrl = `https://bitbucket.org/lla-dev/copado_lla/commits/${conflict.component.commit_hash}`;
    storyInfoHtml += `
      <a href="${bitbucketUrl}" target="_blank" class="story-commit">
        📌 ${conflict.component.commit_hash.substring(0, 7)}
      </a>
    `;
  }

  storyInfo.innerHTML = storyInfoHtml;
  
  titleSection.append(storyTitle, storyInfo);
  
  const status = createStatusBadge(conflict.component.status || 'potential-conflict');
  header.append(titleSection, status);
  card.append(header);

  // Component info
  const componentSection = createElement('div', { className: 'component-section' });
  const componentHeader = createElement('div', { className: 'component-header' });
  componentHeader.innerHTML = `
    <span class="component-type">${escapeHtml(conflict.component.type)}</span>
    <strong class="component-name">${escapeHtml(conflict.component.name)}</strong>
  `;
  componentSection.append(componentHeader);
  card.append(componentSection);

  // Conflict summary
  const conflictSummary = createElement('div', { className: 'conflict-summary' });
  const conflictingStoriesCount = conflict.component.conflicting_stories.length;
  conflictSummary.innerHTML = `
    <div class="summary-item">
      <span class="summary-label">Conflicting Stories:</span>
      <span class="summary-value">${conflictingStoriesCount}</span>
    </div>
    ${conflict.component.production_story_id ? `
      <div class="summary-item">
        <span class="summary-label">In Production:</span>
        <span class="summary-value">${escapeHtml(conflict.component.production_story_id)}</span>
      </div>
    ` : ''}
  `;
  card.append(conflictSummary);

  // Timeline view (collapsible)
  const timelineSection = createElement('div', { className: 'timeline-section' });
  
  const timelineToggle = createElement('button', { 
    className: 'timeline-toggle',
    type: 'button'
  }, '🕐 Show Conflict Timeline');

  const timelineContent = createElement('div', { className: 'timeline-content hidden' });
  
  // Build vertical timeline
  const timeline = createElement('div', { className: 'vertical-timeline' });
  
  // Add conflicting stories to timeline
  conflict.component.conflicting_stories.forEach((conflictingStory, index) => {
    const timelineItem = createElement('div', { className: 'timeline-item conflicting-story' });
    timelineItem.innerHTML = `
      <div class="timeline-marker"></div>
      <div class="timeline-content">
        <div class="timeline-header">
          <span class="timeline-title">Conflicting Story ${index + 1}</span>
          <span class="timeline-date">${formatDate(conflictingStory.commit_date)}</span>
        </div>
        <div class="timeline-body">
          <div class="timeline-detail">
            <span class="detail-label">Story:</span>
            <span class="detail-value">${escapeHtml(conflictingStory.jira_key)} (${escapeHtml(conflictingStory.story_id)})</span>
          </div>
          <div class="timeline-detail">
            <span class="detail-label">Developer:</span>
            <span class="detail-value">${escapeHtml(conflictingStory.developer)}</span>
          </div>
          <div class="timeline-detail">
            <span class="detail-label">Commit Date:</span>
            <span class="detail-value">${formatDate(conflictingStory.commit_date)}</span>
          </div>
        </div>
      </div>
    `;
    timeline.append(timelineItem);
  });

  // Add current story to timeline
  const currentStoryItem = createElement('div', { className: 'timeline-item current-story' });
  currentStoryItem.innerHTML = `
    <div class="timeline-marker"></div>
    <div class="timeline-content">
      <div class="timeline-header">
        <span class="timeline-title">Your Story</span>
        <span class="timeline-date">${formatDate(conflict.component.commit_date)}</span>
      </div>
      <div class="timeline-body">
        <div class="timeline-detail">
          <span class="detail-label">Story:</span>
          <span class="detail-value">${escapeHtml(conflict.jira_key)} (${escapeHtml(conflict.story_id)})</span>
        </div>
        <div class="timeline-detail">
          <span class="detail-label">Developer:</span>
          <span class="detail-value">${escapeHtml(conflict.developer)}</span>
        </div>
        <div class="timeline-detail">
          <span class="detail-label">Commit:</span>
          <span class="detail-value">${conflict.component.commit_hash ? conflict.component.commit_hash.substring(0, 7) : 'N/A'}</span>
        </div>
      </div>
    </div>
  `;
  timeline.append(currentStoryItem);

  // Add production info if available
  if (conflict.component.production_story_id) {
    const productionItem = createElement('div', { className: 'timeline-item production-story' });
    productionItem.innerHTML = `
      <div class="timeline-marker"></div>
      <div class="timeline-content">
        <div class="timeline-header">
          <span class="timeline-title">Production</span>
          <span class="timeline-date">${formatDate(conflict.component.production_commit_date)}</span>
        </div>
        <div class="timeline-body">
          <div class="timeline-detail">
            <span class="detail-label">Story:</span>
            <span class="detail-value">${escapeHtml(conflict.component.production_story_id)}</span>
          </div>
          <div class="timeline-detail">
            <span class="detail-label">Title:</span>
            <span class="detail-value">${escapeHtml(conflict.component.production_story_title || '')}</span>
          </div>
          <div class="timeline-detail">
            <span class="detail-label">Status:</span>
            <span class="detail-value">${escapeHtml(conflict.component.status)}</span>
          </div>
        </div>
      </div>
    `;
    timeline.append(productionItem);
  }

  // Conflict resolution message
  const conflictMessage = createElement('div', { className: 'conflict-message' });
  const otherDevelopers = [...new Set(conflict.component.conflicting_stories.map(s => s.developer))].filter(d => d !== conflict.developer);
  const contactDevelopers = otherDevelopers.length > 0 ? otherDevelopers.join(', ') : 'the other developers';
  
  conflictMessage.innerHTML = `
    <div class="message-icon">⚠️</div>
    <div class="message-content">
      <strong>Component Conflict Detected</strong>
      <p>This ${conflict.component.type} component was modified in ${conflict.component.conflicting_stories.length + 1} different stories.</p>
      <p><strong>Action Required:</strong> Coordinate with ${contactDevelopers} to resolve the conflict before deployment.</p>
    </div>
  `;

  timelineContent.append(timeline, conflictMessage);
  timelineSection.append(timelineToggle, timelineContent);
  card.append(timelineSection);

  // Toggle functionality
  timelineToggle.addEventListener('click', () => {
    timelineContent.classList.toggle('hidden');
    timelineToggle.textContent = timelineContent.classList.contains('hidden') 
      ? '🕐 Show Conflict Timeline'
      : '🕐 Hide Timeline';
  });

  return card;
}

function formatDate(dateString) {
  if (!dateString) return 'Unknown date';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
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
      .conflicts-list { display: flex; flex-direction: column; gap: 16px; }

      .conflict-card {
        background: white;
        border: 1px solid #e5e5e7;
        border-radius: 8px;
        padding: 16px;
        transition: all 0.3s ease;
      }

      .conflict-card:hover { 
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08); 
        border-color: #d2d2d7; 
      }

      .conflict-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 12px;
        margin-bottom: 12px;
        padding-bottom: 12px;
        border-bottom: 1px solid #f5f5f7;
      }

      .conflict-title-section { flex: 1; }

      .conflict-story-title {
        margin: 0 0 8px;
        font-size: 16px;
        font-weight: 600;
        color: #1d1d1f;
        line-height: 1.4;
      }

      .conflict-story-info {
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

      .story-commit {
        display: inline-block;
        font-size: 12px;
        color: #0071e3;
        text-decoration: none;
        padding: 4px 8px;
        background: #e8f0ff;
        border-radius: 4px;
        cursor: pointer;
      }

      .story-commit:hover {
        background: #d4e4ff;
        text-decoration: underline;
      }

      .component-section {
        margin-bottom: 12px;
      }

      .component-header {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 0;
      }

      .component-type {
        font-size: 11px;
        font-weight: 600;
        color: #86868b;
        background: #f5f5f7;
        padding: 4px 8px;
        border-radius: 4px;
      }

      .component-name {
        font-size: 14px;
        color: #1d1d1f;
        font-family: monospace;
      }

      .conflict-summary {
        display: flex;
        gap: 16px;
        margin-bottom: 12px;
        padding: 8px 0;
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
        font-size: 13px;
        color: #1d1d1f;
        font-weight: 600;
      }

      .timeline-section {
        margin-top: 12px;
      }

      .timeline-toggle {
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

      .timeline-toggle:hover { 
        background: #e8e8ed; 
      }

      .timeline-content {
        margin-top: 12px;
        padding: 16px;
        background: #fafafa;
        border-radius: 6px;
        border: 1px solid #e5e5e7;
      }

      .timeline-content.hidden { 
        display: none; 
      }

      .vertical-timeline {
        display: flex;
        flex-direction: column;
        gap: 0;
        position: relative;
        margin-bottom: 16px;
      }

      .vertical-timeline::before {
        content: '';
        position: absolute;
        left: 16px;
        top: 0;
        bottom: 0;
        width: 2px;
        background: #e5e5e7;
        z-index: 1;
      }

      .timeline-item {
        display: flex;
        gap: 16px;
        align-items: flex-start;
        padding: 12px 0;
        position: relative;
        z-index: 2;
      }

      .timeline-marker {
        flex-shrink: 0;
        width: 12px;
        height: 12px;
        border-radius: 50%;
        margin-top: 8px;
        position: relative;
        z-index: 3;
      }

      .conflicting-story .timeline-marker {
        background: #ff3b30;
        border: 2px solid #ff3b30;
      }

      .current-story .timeline-marker {
        background: #0071e3;
        border: 2px solid #0071e3;
      }

      .production-story .timeline-marker {
        background: #34c759;
        border: 2px solid #34c759;
      }

      .timeline-item .timeline-content {
        flex: 1;
        background: white;
        border: 1px solid #e5e5e7;
        border-radius: 6px;
        padding: 12px;
        margin: 0;
      }

      .timeline-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;
        padding-bottom: 4px;
        border-bottom: 1px solid #f5f5f7;
      }

      .timeline-title {
        font-size: 13px;
        font-weight: 600;
        color: #1d1d1f;
      }

      .timeline-date {
        font-size: 11px;
        color: #86868b;
        font-weight: 600;
      }

      .timeline-body {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .timeline-detail {
        display: flex;
        gap: 8px;
        font-size: 12px;
      }

      .detail-label {
        color: #86868b;
        font-weight: 600;
        min-width: 60px;
      }

      .detail-value {
        color: #1d1d1f;
        flex: 1;
      }

      .conflict-message {
        display: flex;
        gap: 12px;
        padding: 12px;
        background: #fff3f3;
        border: 1px solid #ffd1d1;
        border-radius: 6px;
        align-items: flex-start;
      }

      .message-icon {
        font-size: 16px;
        flex-shrink: 0;
      }

      .message-content {
        flex: 1;
      }

      .message-content strong {
        display: block;
        margin-bottom: 4px;
        color: #d70015;
      }

      .message-content p {
        margin: 4px 0;
        font-size: 13px;
        color: #1d1d1f;
        line-height: 1.4;
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
        .conflict-header {
          flex-direction: column;
          align-items: flex-start;
          gap: 8px;
        }
        
        .conflict-story-info {
          flex-direction: column;
          align-items: flex-start;
        }
        
        .conflict-summary {
          flex-direction: column;
          gap: 8px;
        }
        
        .timeline-header {
          flex-direction: column;
          align-items: flex-start;
          gap: 4px;
        }
      }
    `;

    document.head.appendChild(Object.assign(document.createElement('style'), { textContent: css }));
  };
})();