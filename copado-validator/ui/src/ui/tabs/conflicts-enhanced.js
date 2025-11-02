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
  
  // Calculate actual conflict counts - ENHANCED: Better conflict detection
  let totalComponentsWithConflicts = 0;
  let totalStoriesWithConflicts = 0;
  const conflicts = [];
  const componentConflictMap = new Map(); // Track components across stories

  rawConflicts.forEach(conflictStory => {
    let storyHasConflicts = false;
    
    if (conflictStory.components && Array.isArray(conflictStory.components)) {
      conflictStory.components.forEach(component => {
        // ENHANCED: Track component across multiple stories
        const componentKey = `${component.type}|${component.api_name}`;
        if (!componentConflictMap.has(componentKey)) {
          componentConflictMap.set(componentKey, {
            component: component,
            stories: []
          });
        }
        
        const componentData = componentConflictMap.get(componentKey);
        componentData.stories.push({
          story_id: conflictStory.story_id,
          title: conflictStory.title,
          developer: conflictStory.developer,
          jira_key: conflictStory.jira_key
        });

        // Only count components that actually have conflicting stories
        const hasRealConflicts = component.conflicting_stories && component.conflicting_stories.length > 0;
        
        if (hasRealConflicts) {
          storyHasConflicts = true;
          totalComponentsWithConflicts++;
          
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
              production_commit_date: component.production_commit_date,
              
              // ENHANCED: Add cross-story impact data
              cross_story_impact: componentData.stories.length
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
        }
      });
    }
    
    // Only count the story if it has at least one real conflict
    if (storyHasConflicts) {
      totalStoriesWithConflicts++;
    }
  });

  // Cache the results
  CONFLICTS_CACHE = {
    rawData: analysis,
    processedConflicts: {
      conflicts,
      totalComponentsWithConflicts,
      totalStoriesWithConflicts,
      componentConflictMap // ENHANCED: Include for debugging
    },
    lastAnalysis: analysis
  };

  return CONFLICTS_CACHE.processedConflicts;
}

function debugConflictsData(analysis) {
  console.group('🔍 Conflicts Data Analysis');
  const rawConflicts = Array.isArray(analysis.component_conflicts) ? analysis.component_conflicts : [];
  console.log(`Total stories in analysis: ${rawConflicts.length}`);
  
  let storiesWithRealConflicts = 0;
  let totalConflictComponents = 0;
  
  rawConflicts.forEach((story, index) => {
    const conflictComponents = story.components ? 
      story.components.filter(comp => comp.conflicting_stories && comp.conflicting_stories.length > 0) : [];
    
    if (conflictComponents.length > 0) {
      storiesWithRealConflicts++;
      totalConflictComponents += conflictComponents.length;
      console.log(`📌 Story ${story.story_id} has ${conflictComponents.length} conflicting components`);
    }
  });
  
  console.log(`📊 FINAL COUNT: ${storiesWithRealConflicts} stories with conflicts, ${totalConflictComponents} conflicting components`);
  console.groupEnd();
}

export function renderConflictsTab(analysis = {}) {
  const panel = $('#tab-conflicts');
  if (!panel) return;

  debugConflictsData(analysis);

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
      `${filteredConflicts.length} Component conflicts across ${totalStoriesWithConflicts} stories`)
  ]);
  panel.append(header);

  // Create export cards section
  const exportSection = createElement('div', { className: 'export-cards-section' });
  
  const exportCardsTitle = createElement('h3', { className: 'export-cards-title' }, 'Export Reports');
  exportSection.appendChild(exportCardsTitle);
  
  const exportCardsContainer = createElement('div', { className: 'export-cards-container' });
  
  // Export card data
  const exportCardsData = [
    {
      icon: '📋',
      title: 'Story Report',
      description: 'Shows which user stories have conflicts and their affected components',
      buttonText: 'Download Story Report',
      onClick: () => createUserStoryReport(filteredConflicts, analysis),
      color: '#34c759'
    },
    {
      icon: '⚙️',
      title: 'Component Report', 
      description: 'Shows high-level component conflicts and developer involvement',
      buttonText: 'Download Component Report',
      onClick: () => createComponentReport(filteredConflicts, analysis),
      color: '#ff9500'
    },
    {
      icon: '🔍',
      title: 'Detailed Report',
      description: 'Shows component conflicts with latest commits and coordination details',
      buttonText: 'Download Detailed Report',
      onClick: () => createComponentConflictReport(filteredConflicts, analysis),
      color: '#0071e3'
    }
  ];

  // Create export cards
  exportCardsData.forEach(cardData => {
    const card = createElement('div', { className: 'export-card' });
    
    const cardHeader = createElement('div', { 
      className: 'export-card-header',
      style: `border-left: 4px solid ${cardData.color};`
    });
    
    const cardIcon = createElement('div', { className: 'export-card-icon' }, cardData.icon);
    const cardTitle = createElement('h4', { className: 'export-card-title' }, cardData.title);
    
    cardHeader.appendChild(cardIcon);
    cardHeader.appendChild(cardTitle);
    
    const cardDescription = createElement('p', { className: 'export-card-description' }, cardData.description);
    
    const cardButton = createElement('button', {
      className: 'export-card-button',
      style: `background: ${cardData.color};`,
      type: 'button'
    }, cardData.buttonText);
    
    cardButton.addEventListener('click', cardData.onClick);
    
    card.appendChild(cardHeader);
    card.appendChild(cardDescription);
    card.appendChild(cardButton);
    
    exportCardsContainer.appendChild(card);
  });
  
  exportSection.appendChild(exportCardsContainer);
  panel.appendChild(exportSection);

  // Rest of your existing code (filter bar, conflicts list, etc.)
  const handleSearchChange = debounce((query) => {
    CONFLICTS_STATE.query = query;
    localStorage.setItem('ui.conflicts.query', query);
    renderConflictsTab(analysis);
  }, 300);

  const handleSortChange = (sort) => {
    CONFLICTS_STATE.sort = sort;
    localStorage.setItem('ui.conflicts.sort', sort);
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
    const fragment = document.createDocumentFragment();
    filteredConflicts.forEach(conflict => {
      fragment.appendChild(createConflictCard(conflict));
    });
    conflictsList.appendChild(fragment);
    panel.append(conflictsList);
  }

  injectCss();
}



// Export Report Functions
function createUserStoryReport(conflicts, analysis) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `user-story-conflicts-${timestamp}.csv`;
  
  let csvContent = "User Story Conflict Report\n\n";
  csvContent += "Generated:," + new Date().toLocaleString() + "\n";
  csvContent += "Total Stories Analyzed:," + (analysis.component_conflicts?.length || 0) + "\n";
  csvContent += "Stories with Conflicts:," + conflicts.length + "\n\n";
  
  // Group conflicts by story
  const storiesMap = new Map();
  conflicts.forEach(conflict => {
    if (!storiesMap.has(conflict.story_id)) {
      storiesMap.set(conflict.story_id, {
        story_id: conflict.story_id,
        title: conflict.story_title,
        developer: conflict.developer,
        jira_key: conflict.jira_key,
        components: []
      });
    }
    storiesMap.get(conflict.story_id).components.push(conflict.component);
  });
  
  // User Story Summary
  csvContent += "USER STORY SUMMARY\n";
  csvContent += "Story ID,Title,Developer,JIRA Key,Conflicting Components,Total Conflicts,Status\n";
  
  storiesMap.forEach(story => {
    const conflictCount = story.components.reduce((sum, comp) => 
      sum + (comp.conflicting_stories?.length || 0), 0);
    
    const componentNames = story.components.map(comp => comp.name).join('; ');
    
    csvContent += `"${story.story_id}","${story.title}","${story.developer}","${story.jira_key}","${componentNames}",${conflictCount},"Needs Review"\n`;
  });
  
  downloadCSV(csvContent, filename);
}


function createComponentReport(conflicts, analysis) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `component-conflicts-${timestamp}.csv`;
  
  let csvContent = "Component Conflict Report\n\n";
  csvContent += "Generated:," + new Date().toLocaleString() + "\n";
  csvContent += "Total Components with Conflicts:," + conflicts.length + "\n\n";
  
  // Group by component - FIXED: Use Set to avoid duplicate stories
  const componentsMap = new Map();
  conflicts.forEach(conflict => {
    const componentKey = `${conflict.component.type}|${conflict.component.name}`;
    if (!componentsMap.has(componentKey)) {
      componentsMap.set(componentKey, {
        type: conflict.component.type,
        name: conflict.component.name,
        stories: new Set(), // Use Set to avoid duplicate story_ids
        developers: new Set(),
        totalConflicts: 0
      });
    }
    
    const componentData = componentsMap.get(componentKey);
    
    // Add current story
    componentData.stories.add(conflict.story_id);
    componentData.developers.add(conflict.developer);
    componentData.totalConflicts += conflict.component.conflicting_stories?.length || 0;
    
    // Add conflicting stories
    if (conflict.component.conflicting_stories) {
      conflict.component.conflicting_stories.forEach(conflictingStory => {
        componentData.stories.add(conflictingStory.story_id);
        componentData.developers.add(conflictingStory.developer);
      });
    }
  });
  
  // Component Summary
  csvContent += "COMPONENT CONFLICT SUMMARY\n";
  csvContent += "Component Type,Component Name,Unique Stories,Unique Developers,Total Conflicts,Primary Developer\n";
  
  componentsMap.forEach(component => {
    const uniqueStoryCount = component.stories.size;
    const uniqueDeveloperCount = component.developers.size;
    const developers = Array.from(component.developers).join('; ');
    const primaryDeveloper = Array.from(component.developers)[0] || 'Unknown';
    
    csvContent += `"${component.type}","${component.name}",${uniqueStoryCount},${uniqueDeveloperCount},${component.totalConflicts},"${primaryDeveloper}"\n`;
  });
  
  downloadCSV(csvContent, filename);
}

function createComponentConflictReport(conflicts, analysis) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `component-conflict-details-${timestamp}.csv`;
  
  let csvContent = "Component Conflict Details Report\n\n";
  csvContent += "Generated:," + new Date().toLocaleString() + "\n";
  csvContent += "Total Components with Conflicts:," + conflicts.length + "\n\n";
  
  // Group by component and find latest commit - FIXED: No double counting
  const componentsMap = new Map();
  
  conflicts.forEach(conflict => {
    const componentKey = `${conflict.component.type}|${conflict.component.name}`;
    
    if (!componentsMap.has(componentKey)) {
      componentsMap.set(componentKey, {
        type: conflict.component.type,
        name: conflict.component.name,
        allStories: new Map(), // Use Map to avoid duplicates by story_id
        latestCommit: null
      });
    }
    
    const componentData = componentsMap.get(componentKey);
    
    // Add current story - only if not already added
    if (!componentData.allStories.has(conflict.story_id)) {
      const currentStory = {
        story_id: conflict.story_id,
        jira_key: conflict.jira_key,
        developer: conflict.developer,
        commit_date: conflict.component.commit_date,
        commit_hash: conflict.component.commit_hash,
        is_current: true
      };
      componentData.allStories.set(conflict.story_id, currentStory);
      
      // Update latest commit if this is newer
      if (currentStory.commit_date && (!componentData.latestCommit || 
          new Date(currentStory.commit_date) > new Date(componentData.latestCommit.commit_date))) {
        componentData.latestCommit = currentStory;
      }
    }
    
    // Add conflicting stories - only if not already added
    if (conflict.component.conflicting_stories) {
      conflict.component.conflicting_stories.forEach(conflictingStory => {
        if (!componentData.allStories.has(conflictingStory.story_id)) {
          const story = {
            story_id: conflictingStory.story_id,
            jira_key: conflictingStory.jira_key,
            developer: conflictingStory.developer,
            commit_date: conflictingStory.commit_date,
            commit_hash: conflictingStory.commit_hash,
            is_current: false
          };
          componentData.allStories.set(conflictingStory.story_id, story);
          
          // Update latest commit if this is newer
          if (story.commit_date && (!componentData.latestCommit || 
              new Date(story.commit_date) > new Date(componentData.latestCommit.commit_date))) {
            componentData.latestCommit = story;
          }
        }
      });
    }
  });
  
  // Component Conflict Details
  csvContent += "COMPONENT CONFLICT DETAILS\n";
  csvContent += "Component Type,Component Name,Unique Stories,Developers,Latest Story,Latest Developer,Latest Commit Date,Latest Commit Hash,Involved Stories\n";
  
  componentsMap.forEach(component => {
    // Convert Map to array for easier processing
    const uniqueStories = Array.from(component.allStories.values());
    
    // Get unique developers
    const developers = [...new Set(uniqueStories.map(s => s.developer))].join('; ');
    
    // Get all involved stories (no filtering - show all unique stories)
    const involvedStories = uniqueStories
      .map(s => `${s.story_id} (${s.jira_key} - ${s.developer})`)
      .join('; ');
    
    const latestCommit = component.latestCommit;
    
    csvContent += `"${component.type}","${component.name}",${uniqueStories.length},"${developers}","${latestCommit?.story_id || 'N/A'}","${latestCommit?.developer || 'N/A'}","${formatDateForCSV(latestCommit?.commit_date)}","${latestCommit?.commit_hash?.substring(0, 7) || 'N/A'}","${involvedStories}"\n`;
  });
  
  downloadCSV(csvContent, filename);
}

// Helper function for CSV date format
function formatDateForCSV(dateString) {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US') + ' ' + date.toLocaleTimeString('en-US');
}

// Generic CSV download function
function downloadCSV(csvContent, filename) {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Add this CSS to your existing injectCss function
const enhancedCss = `
  .export-section {
    margin-bottom: 16px;
    display: flex;
    gap: 12px;
    justify-content: flex-end;
  }

  .export-btn {
    background: #0071e3;
    color: white;
    border: none;
    padding: 10px 16px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 13px;
    font-weight: 600;
    transition: all 0.3s ease;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .export-btn:hover {
    background: #0056b3;
    transform: translateY(-1px);
  }

  .story-report-btn {
    background: #34c759;
  }

  .story-report-btn:hover {
    background: #2aa44f;
  }

  .component-report-btn {
    background: #ff9500;
  }

  .component-report-btn:hover {
    background: #e08500;
  }

  .detailed-report-btn {
    background: #af52de;
  }

  .detailed-report-btn:hover {
    background: #8e43b3;
  }

.export-section {
  margin-bottom: 24px;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 16px;
  padding: 16px;
  background: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #e9ecef;
}

.export-button-container {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.export-btn {
  background: white;
  color: #1d1d1f;
  border: 2px solid #e5e5e7;
  padding: 12px 16px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  gap: 8px;
  text-align: left;
  position: relative;
}

.export-btn:hover {
  background: #0071e3;
  color: white;
  border-color: #0071e3;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 113, 227, 0.3);
}

.export-btn.primary {
  border-color: #0071e3;
  background: #0071e3;
  color: white;
}

.export-btn.primary:hover {
  background: #0056b3;
  border-color: #0056b3;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 113, 227, 0.4);
}

.export-description {
  font-size: 12px;
  color: #86868b;
  line-height: 1.4;
  padding: 0 4px;
}

/* Tooltip style enhancement */
.export-btn::after {
  content: attr(title);
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  background: #1d1d1f;
  color: white;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: normal;
  white-space: nowrap;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.3s ease;
  z-index: 1000;
}

.export-btn:hover::after {
  opacity: 1;
}

/* Responsive design */
@media (max-width: 768px) {
  .export-section {
    grid-template-columns: 1fr;
    gap: 12px;
  }
  
  .export-btn {
    padding: 10px 12px;
    font-size: 13px;
  }
}

`;

// Update your injectCss function to include the export button styles
// Replace your existing injectCss function with this:


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

  // ENHANCED: Component info with impact indicator
  const componentSection = createElement('div', { className: 'component-section' });
  const componentHeader = createElement('div', { className: 'component-header' });
  
  // Add impact indicator if component appears in multiple stories
  const impactIndicator = conflict.component.cross_story_impact > 1 ? 
    `<span class="impact-badge">Affects ${conflict.component.cross_story_impact} stories</span>` : '';
  
  componentHeader.innerHTML = `
    <span class="component-type">${escapeHtml(conflict.component.type)}</span>
    <strong class="component-name">${escapeHtml(conflict.component.name)}</strong>
    ${impactIndicator}
  `;
  componentSection.append(componentHeader);
  card.append(componentSection);

  // ENHANCED: Conflict summary with better impact details
  const conflictSummary = createElement('div', { className: 'conflict-summary' });
  const conflictingStoriesCount = conflict.component.conflicting_stories.length;
  
  // Calculate unique developers involved
  const uniqueDevelopers = new Set();
  uniqueDevelopers.add(conflict.developer);
  conflict.component.conflicting_stories.forEach(story => {
    if (story.developer) uniqueDevelopers.add(story.developer);
  });
  
  conflictSummary.innerHTML = `
    <div class="summary-item">
      <span class="summary-label">Conflicting Stories:</span>
      <span class="summary-value">${conflictingStoriesCount}</span>
    </div>
    <div class="summary-item">
      <span class="summary-label">Developers Involved:</span>
      <span class="summary-value">${uniqueDevelopers.size}</span>
    </div>
    ${conflict.component.production_story_id ? `
      <div class="summary-item">
        <span class="summary-label">In Production:</span>
        <span class="summary-value">${escapeHtml(conflict.component.production_story_id)}</span>
      </div>
    ` : ''}
  `;
  card.append(conflictSummary);

  // Timeline view (collapsible) - ENHANCED with better organization
  const timelineSection = createElement('div', { className: 'timeline-section' });
  
  const timelineToggle = createElement('button', { 
    className: 'timeline-toggle',
    type: 'button'
  }, `🕐 Show Conflict Details (${conflictingStoriesCount + 1} stories)`);

  const timelineContent = createElement('div', { className: 'timeline-content hidden' });
  
  // Build vertical timeline
  const timeline = createElement('div', { className: 'vertical-timeline' });
  
  // Add conflicting stories to timeline with better grouping
  if (conflict.component.conflicting_stories.length > 0) {
    const conflictGroup = createElement('div', { className: 'timeline-group' });
    conflictGroup.innerHTML = `<div class="timeline-group-title">Conflicting Stories (${conflict.component.conflicting_stories.length})</div>`;
    
    conflict.component.conflicting_stories.forEach((conflictingStory, index) => {
      const timelineItem = createElement('div', { className: 'timeline-item conflicting-story' });
      timelineItem.innerHTML = `
        <div class="timeline-marker"></div>
        <div class="timeline-content">
          <div class="timeline-header">
            <span class="timeline-title">${escapeHtml(conflictingStory.jira_key)}</span>
            <span class="timeline-date">${formatDate(conflictingStory.commit_date)}</span>
          </div>
          <div class="timeline-body">
            <div class="timeline-detail">
              <span class="detail-label">Story:</span>
              <span class="detail-value">${escapeHtml(conflictingStory.story_id)}</span>
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
      conflictGroup.appendChild(timelineItem);
    });
    timeline.append(conflictGroup);
  }

  // Add current story to timeline
  const currentStoryItem = createElement('div', { className: 'timeline-item current-story' });
  currentStoryItem.innerHTML = `
    <div class="timeline-marker current-marker"></div>
    <div class="timeline-content">
      <div class="timeline-header">
        <span class="timeline-title current-title">Your Story - ${escapeHtml(conflict.jira_key)}</span>
        <span class="timeline-date">${formatDate(conflict.component.commit_date)}</span>
      </div>
      <div class="timeline-body">
        <div class="timeline-detail">
          <span class="detail-label">Story:</span>
          <span class="detail-value">${escapeHtml(conflict.story_id)}</span>
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
      <div class="timeline-marker production-marker"></div>
      <div class="timeline-content">
        <div class="timeline-header">
          <span class="timeline-title">Production Version</span>
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
        </div>
      </div>
    `;
    timeline.append(productionItem);
  }

  // ENHANCED: Better conflict resolution message
  const conflictMessage = createElement('div', { className: 'conflict-message' });
  const otherDevelopers = Array.from(uniqueDevelopers).filter(d => d !== conflict.developer);
  const contactDevelopers = otherDevelopers.length > 0 ? otherDevelopers.join(', ') : 'the other developers';
  
  let resolutionTime = 'soon';
  if (conflictingStoriesCount >= 5) resolutionTime = 'immediately';
  else if (conflictingStoriesCount >= 3) resolutionTime = 'as soon as possible';
  
  conflictMessage.innerHTML = `
    <div class="message-icon">⚠️</div>
    <div class="message-content">
      <strong>Component Conflict Detected</strong>
      <p>This ${conflict.component.type} component has been modified in <strong>${conflictingStoriesCount + 1}</strong> different stories involving <strong>${uniqueDevelopers.size}</strong> developers.</p>
      <p><strong>Action Required:</strong> Coordinate with ${contactDevelopers} to resolve the conflict ${resolutionTime}.</p>
    </div>
  `;

  timelineContent.append(timeline, conflictMessage);
  timelineSection.append(timelineToggle, timelineContent);
  card.append(timelineSection);

  // Toggle functionality
  timelineToggle.addEventListener('click', () => {
    timelineContent.classList.toggle('hidden');
    timelineToggle.textContent = timelineContent.classList.contains('hidden') 
      ? `🕐 Show Conflict Details (${conflictingStoriesCount + 1} stories)`
      : `🕐 Hide Details`;
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

// Update the injectCss function in conflicts-enhanced.js with these styles:

const injectCss = (() => {
  let done = false;
  return () => {
    if (done) return;
    done = true;

    const css = `
      /* Updated section header to match overview.js */
      .section-header h2 {
        font-size: 24px;
        font-weight: 600;
        margin: 0 0 8px 0;
        color: white;
      }

      .section-header .muted {
        font-size: 24px;
        color: white;
        margin: 0;
      }

      /* Export cards section - matching overview.js card styles */
      .export-cards-section {
        margin-bottom: 32px;
      }

      .export-cards-title {
        font-size: 18px;
        font-weight: 600;
        color: #1d1d1f;
        margin: 0 0 16px 0;
      }

      .export-cards-container {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
        gap: 16px;
      }

      .export-card {
        background: white;
        border: 1px solid #e5e5e7;
        border-radius: 12px;
        padding: 20px;
        transition: all 0.2s ease;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
      }

      .export-card:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        border-color: #d2d2d7;
      }

      .export-card-header {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 12px;
        padding-left: 12px;
      }

      .export-card-icon {
        font-size: 20px;
      }

      .export-card-title {
        font-size: 16px;
        font-weight: 600;
        color: #1d1d1f;
        margin: 0;
      }

      .export-card-description {
        font-size: 14px;
        color: #666666;
        line-height: 1.4;
        margin: 0 0 16px 0;
      }

      .export-card-button {
        background: #0071e3;
        color: white;
        border: none;
        padding: 10px 16px;
        border-radius: 8px;
        cursor: pointer;
        font-size: 13px;
        font-weight: 600;
        transition: all 0.2s ease;
        width: 100%;
      }

      .export-card-button:hover {
        background: #0056b3;
        transform: translateY(-1px);
      }

      /* Updated filter bar to match overview.js style */
      .filter-bar {
        display: flex;
        gap: 12px;
        margin-bottom: 24px;
        padding: 16px;
        background: white;
        border: 1px solid #e5e5e7;
        border-radius: 8px;
        align-items: center;
      }

      .search-input {
        flex: 1;
        padding: 10px 12px;
        border: 1px solid #e5e5e7;
        border-radius: 8px;
        font-size: 13px;
        transition: all 0.2s ease;
      }

      .search-input:focus {
        outline: none;
        border-color: #0071e3;
        box-shadow: 0 0 0 3px rgba(0, 113, 227, 0.1);
      }

      .sort-select {
        padding: 10px 12px;
        border: 1px solid #e5e5e7;
        border-radius: 8px;
        font-size: 13px;
        background: white;
        cursor: pointer;
        transition: all 0.2s ease;
      }

      .sort-select:focus {
        outline: none;
        border-color: #0071e3;
      }

      /* Updated conflicts list and cards */
      .conflicts-list {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      .conflict-card {
        background: white;
        border: 1px solid #e5e5e7;
        border-radius: 12px;
        padding: 20px;
        transition: all 0.2s ease;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
      }

      .conflict-card:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        border-color: #d2d2d7;
      }

      .conflict-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 12px;
        margin-bottom: 16px;
        padding-bottom: 16px;
        border-bottom: 1px solid #f5f5f7;
      }

      .conflict-title-section {
        flex: 1;
      }

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
        border-radius: 6px;
        font-weight: 500;
      }

      .story-commit {
        display: inline-block;
        font-size: 12px;
        color: #0071e3;
        text-decoration: none;
        padding: 4px 8px;
        background: #e8f0ff;
        border-radius: 6px;
        cursor: pointer;
        font-weight: 500;
      }

      .story-commit:hover {
        background: #d4e4ff;
        text-decoration: underline;
      }

      /* Status badges matching overview.js style */
      .status-badge {
        padding: 6px 12px;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .status-high { background: #ff3b30; color: white; }
      .status-medium { background: #ff9500; color: white; }
      .status-low { background: #34c759; color: white; }
      .status-info { background: #0071e3; color: white; }

      /* Component section */
      .component-section {
        margin-bottom: 16px;
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
        border-radius: 6px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .component-name {
        font-size: 14px;
        color: #1d1d1f;
        font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', 'Source Code Pro', monospace;
        font-weight: 600;
      }

      .impact-badge {
        font-size: 11px;
        color: #ff9500;
        background: #fff4e6;
        padding: 4px 8px;
        border-radius: 6px;
        font-weight: 600;
      }

      /* Conflict summary */
      .conflict-summary {
        display: flex;
        gap: 24px;
        margin-bottom: 16px;
        padding: 12px;
        background: #f8f9fa;
        border-radius: 8px;
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
        font-size: 14px;
        color: #1d1d1f;
        font-weight: 700;
      }

      /* Timeline section */
      .timeline-section {
        margin-top: 16px;
      }

      .timeline-toggle {
        background: #f8f9fa;
        border: 1px solid #e5e5e7;
        padding: 12px 16px;
        border-radius: 8px;
        cursor: pointer;
        font-size: 13px;
        font-weight: 600;
        color: #1d1d1f;
        width: 100%;
        text-align: left;
        transition: all 0.2s ease;
      }

      .timeline-toggle:hover {
        background: #e8e8ed;
        border-color: #d2d2d7;
      }

      .timeline-content {
        margin-top: 12px;
        padding: 20px;
        background: #fafafa;
        border-radius: 8px;
        border: 1px solid #e5e5e7;
      }

      .timeline-content.hidden {
        display: none;
      }

      /* Vertical timeline */
      .vertical-timeline {
        display: flex;
        flex-direction: column;
        gap: 0;
        position: relative;
        margin-bottom: 20px;
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
        padding: 16px 0;
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
        border: 2px solid white;
      }

      .conflicting-story .timeline-marker {
        background: #ff3b30;
      }

      .current-story .timeline-marker {
        background: #0071e3;
      }

      .production-story .timeline-marker {
        background: #34c759;
      }

      .timeline-item .timeline-content {
        flex: 1;
        background: white;
        border: 1px solid #e5e5e7;
        border-radius: 8px;
        padding: 16px;
        margin: 0;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.04);
      }

      .timeline-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;
        padding-bottom: 8px;
        border-bottom: 1px solid #f5f5f7;
      }

      .timeline-title {
        font-size: 13px;
        font-weight: 600;
        color: #1d1d1f;
      }

      .current-title {
        color: #0071e3;
      }

      .timeline-date {
        font-size: 11px;
        color: #86868b;
        font-weight: 600;
      }

      .timeline-body {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      .timeline-detail {
        display: flex;
        gap: 8px;
        font-size: 12px;
      }

      .detail-label {
        color: #86868b;
        font-weight: 600;
        min-width: 70px;
      }

      .detail-value {
        color: #1d1d1f;
        flex: 1;
      }

      /* Conflict message */
      .conflict-message {
        display: flex;
        gap: 12px;
        padding: 16px;
        background: #fff3f3;
        border: 1px solid #ffd1d1;
        border-radius: 8px;
        align-items: flex-start;
      }

      .message-icon {
        font-size: 16px;
        flex-shrink: 0;
        margin-top: 2px;
      }

      .message-content {
        flex: 1;
      }

      .message-content strong {
        display: block;
        margin-bottom: 6px;
        color: #d70015;
        font-size: 13px;
      }

      .message-content p {
        margin: 4px 0;
        font-size: 13px;
        color: #1d1d1f;
        line-height: 1.4;
      }

      /* Empty state */
      .empty-card {
        text-align: center;
        padding: 60px 20px;
        color: #86868b;
        background: white;
        border: 1px solid #e5e5e7;
        border-radius: 12px;
      }

      .empty-icon {
        font-size: 48px;
        margin-bottom: 16px;
        opacity: 0.5;
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

      /* Responsive design */
      @media (max-width: 768px) {
        .export-cards-container {
          grid-template-columns: 1fr;
        }

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
          gap: 12px;
        }

        .timeline-header {
          flex-direction: column;
          align-items: flex-start;
          gap: 4px;
        }

        .filter-bar {
          flex-direction: column;
          align-items: stretch;
        }

        .search-input, .sort-select {
          width: 100%;
        }
      }

      @media (max-width: 480px) {
        .conflict-card {
          padding: 16px;
        }

        .timeline-content {
          padding: 16px;
        }

        .export-card {
          padding: 16px;
        }
      }
    `;

    document.head.appendChild(Object.assign(document.createElement('style'), { textContent: css }));
  };
})();