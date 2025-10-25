// src/ui/tabs/my-work.js
import { 
  getStoryStatus, 
  getStatusText, 
  getUniqueComponents, 
  renderEmptyState,
  escapeHtml 
} from './developer-utils.js';

/**
 * Render My Work Tab
 * Apple-inspired professional design
 */
export function renderMyWorkTab(analysis) {
  // If no analysis, show professional landing
  if (!analysis) {
    return renderMyWorkLanding();
  }

  // If analysis exists but has no stories
  if (!analysis.all_stories || analysis.all_stories.length === 0) {
    return renderEmptyState('my-work', 'No active stories in your analysis');
  }

  const stories = analysis.all_stories || [];
  const components = getUniqueComponents(analysis);
  
  const statusCounts = stories.reduce((acc, story) => {
    const status = getStoryStatus(story, analysis);
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, { safe: 0, conflict: 0, blocked: 0 });

  return `
    <div class="workspace-container">
      <div class="workspace-header">
        <div class="developer-badge">👨‍💻 My Work Dashboard</div>
        <h1>Active Development Work</h1>
        <div class="quick-stats">
          <div class="stat-card">
            <div class="stat-value">${stories.length}</div>
            <div class="stat-label">Total Stories</div>
          </div>
          <div class="stat-card safe">
            <div class="stat-value">${statusCounts.safe}</div>
            <div class="stat-label">Ready to Deploy</div>
          </div>
          <div class="stat-card warning">
            <div class="stat-value">${statusCounts.conflict}</div>
            <div class="stat-label">Needs Review</div>
          </div>
          <div class="stat-card critical">
            <div class="stat-value">${statusCounts.blocked}</div>
            <div class="stat-label">Blocked</div>
          </div>
        </div>
      </div>

      <!-- Developer Tools Section -->
      <div class="section">
        <h2 class="section-title">🔧 Developer Tools</h2>
        <div class="dev-tools-grid">
          <div class="tool-card" onclick="window.openPrecheckTool && window.openPrecheckTool()">
            <div class="tool-icon">🛡️</div>
            <h3>Pre-Check Tool</h3>
            <p>Validate component readiness for deployment</p>
          </div>
          <div class="tool-card" onclick="window.openHistoryTool && window.openHistoryTool()">
            <div class="tool-icon">📜</div>
            <h3>History Tool</h3>
            <p>View component commit history</p>
          </div>
          <div class="tool-card" onclick="window.openComparisonTool && window.openComparisonTool()">
            <div class="tool-icon">⇄</div>
            <h3>Comparison Tool</h3>
            <p>Compare branches and environments</p>
          </div>
        </div>
      </div>

      <div class="section">
        <h2 class="section-title">🚀 Quick Actions</h2>
        <div class="actions-grid">
          <div class="action-card" onclick="runSafetyCheckAll()">
            <div class="action-icon">🛡️</div>
            <h3>Safety Check All</h3>
            <p>Validate all stories for deployment readiness</p>
          </div>
          <div class="action-card" onclick="scanComponentConflicts()">
            <div class="action-icon">🔍</div>
            <h3>Scan Conflicts</h3>
            <p>Check for component conflicts across stories</p>
          </div>
          <div class="action-card" onclick="viewDeploymentSchedule()">
            <div class="action-icon">📅</div>
            <h3>Deployment Schedule</h3>
            <p>See team deployment timeline</p>
          </div>
        </div>
      </div>

      <div class="section">
        <h2 class="section-title">📖 Active Stories (${stories.length})</h2>
        ${stories.length > 0 ? `
          <div class="filter-bar">
            <div class="filter-group">
              <label>Filter by Status:</label>
              <select id="statusFilter" onchange="filterStories()">
                <option value="all">All Stories</option>
                <option value="safe">Ready to Deploy</option>
                <option value="conflict">Needs Review</option>
                <option value="blocked">Blocked</option>
              </select>
            </div>
            <div class="filter-group">
              <label>Search:</label>
              <input type="text" id="storySearch" placeholder="Search stories or components..." onkeyup="searchStories()">
            </div>
          </div>
          
          <div class="stories-grid">
            ${stories.map(story => renderStoryCard(story, analysis)).join('')}
          </div>
        ` : `
          <div class="empty-state">
            <div class="empty-icon">📝</div>
            <h3>No Active Stories</h3>
            <p>Run an analysis to see your development work</p>
          </div>
        `}
      </div>

      <div class="section">
        <h2 class="section-title">📦 Component Watchlist</h2>
        <div class="watchlist-grid">
          ${components.length > 0 ? components.map(comp => renderWatchlistCard(comp, analysis)).join('') : `
            <div class="empty-state">
              <div class="empty-icon">👀</div>
              <h3>No Components to Watch</h3>
              <p>Components from your stories will appear here</p>
            </div>
          `}
        </div>
      </div>
    </div>
  `;
}

/**
 * My Work Landing Page - Apple-inspired Design
 * Clean, professional, minimal
 */
function renderMyWorkLanding() {
  return `
    <div class="apple-landing-container">
      <!-- Header Section -->
      <div class="apple-header">
        <h1>My Work</h1>
        <p>Manage your development work and use developer tools</p>
      </div>

      <!-- Developer Tools Section - Primary Focus -->
      <div class="apple-section">
        <h2>Developer Tools</h2>
        <p class="section-description">Professional tools for component validation and analysis</p>
        
        <div class="apple-tools-grid">
          <!-- Pre-Check Tool -->
          <div class="apple-tool-card" onclick="window.openPrecheckTool && window.openPrecheckTool()">
            <div class="tool-header">
              <div class="tool-icon-large">🛡️</div>
              <h3>Pre-Check Tool</h3>
            </div>
            <p class="tool-description">Validate component readiness for deployment</p>
            <div class="tool-features">
              <div class="feature">✓ Deployment validation</div>
              <div class="feature">✓ Component status check</div>
              <div class="feature">✓ Coverage analysis</div>
            </div>
            <div class="tool-footer">
              <span class="learn-more">Learn more →</span>
            </div>
          </div>

          <!-- History Tool -->
          <div class="apple-tool-card" onclick="window.openHistoryTool && window.openHistoryTool()">
            <div class="tool-header">
              <div class="tool-icon-large">📜</div>
              <h3>History Tool</h3>
            </div>
            <p class="tool-description">View component commit history and changes</p>
            <div class="tool-features">
              <div class="feature">✓ Commit history</div>
              <div class="feature">✓ Author tracking</div>
              <div class="feature">✓ Timeline view</div>
            </div>
            <div class="tool-footer">
              <span class="learn-more">Learn more →</span>
            </div>
          </div>

          <!-- Comparison Tool -->
          <div class="apple-tool-card" onclick="window.openComparisonTool && window.openComparisonTool()">
            <div class="tool-header">
              <div class="tool-icon-large">⇄</div>
              <h3>Comparison Tool</h3>
            </div>
            <p class="tool-description">Compare branches and environments</p>
            <div class="tool-features">
              <div class="feature">✓ Branch comparison</div>
              <div class="feature">✓ Diff analysis</div>
              <div class="feature">✓ Environment sync</div>
            </div>
            <div class="tool-footer">
              <span class="learn-more">Learn more →</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Getting Started Section -->
      <div class="apple-section">
        <h2>Getting Started</h2>
        <p class="section-description">To see your active stories and component conflicts</p>
        
        <div class="apple-cta-container">
          <button class="apple-button apple-button-primary" onclick="openAnalyzeModal && openAnalyzeModal()">
            <span class="button-icon">▶</span>
            <span class="button-text">Run Analysis</span>
          </button>
          <p class="button-description">Start an analysis to detect your active stories and components</p>
        </div>
      </div>

      <!-- Information Section -->
      <div class="apple-section apple-section-light">
        <h2>Why Run Analysis?</h2>
        <div class="info-grid">
          <div class="info-item">
            <div class="info-icon">📊</div>
            <h4>Real-time Insights</h4>
            <p>Get instant feedback on your development work and component status</p>
          </div>
          <div class="info-item">
            <div class="info-icon">🔍</div>
            <h4>Conflict Detection</h4>
            <p>Automatically identify component conflicts before deployment</p>
          </div>
          <div class="info-item">
            <div class="info-icon">✓</div>
            <h4>Deployment Ready</h4>
            <p>Ensure your changes are fully validated and deployment-ready</p>
          </div>
          <div class="info-item">
            <div class="info-icon">📈</div>
            <h4>Performance Metrics</h4>
            <p>Track deployment readiness and component coverage metrics</p>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderStoryCard(story, analysis) {
  if (!story || !story.id) {
    return '';
  }

  const status = getStoryStatus(story, analysis);
  const components = story.components || [];
  const safeName = escapeHtml(story.name || 'Unnamed Story');
  const safeDescription = escapeHtml(story.description || 'No description available');
  
  return `
    <div class="story-card ${status}" data-story-id="${story.id}" data-status="${status}">
      <div class="story-header">
        <h3 class="story-title">${safeName}</h3>
        <span class="status-badge ${status}">
          ${getStatusText(status)}
        </span>
      </div>
      
      <p class="story-description">${safeDescription}</p>
      
      <div class="story-meta">
        <div class="meta-item">
          <strong>ID:</strong> <span class="story-id">${story.id}</span>
        </div>
        ${story.release ? `
          <div class="meta-item">
            <strong>Release:</strong> ${escapeHtml(story.release)}
          </div>
        ` : ''}
        ${story.environment ? `
          <div class="meta-item">
            <strong>Environment:</strong> ${escapeHtml(story.environment)}
          </div>
        ` : ''}
      </div>

      <div class="story-components">
        <strong>Components (${components.length}):</strong>
        <div class="component-tags">
          ${components.slice(0, 5).map(comp => `
            <span class="component-tag" onclick="viewComponentDetails('${escapeHtml(comp)}')">
              ${escapeHtml(comp)}
            </span>
          `).join('')}
          ${components.length > 5 ? `
            <span class="component-tag-more">+${components.length - 5} more</span>
          ` : ''}
        </div>
      </div>

      <div class="story-actions">
        <button class="btn btn-outline" onclick="viewStoryDetails('${story.id}')">
          View Details
        </button>
        <button class="btn btn-primary" onclick="runSafetyCheck('${story.id}')">
          Safety Check
        </button>
        ${status === 'conflict' ? `
          <button class="btn btn-warning" onclick="viewStoryConflicts('${story.id}')">
            Resolve Conflicts
          </button>
        ` : ''}
      </div>
    </div>
  `;
}

function renderWatchlistCard(component, analysis) {
  if (!component || typeof component !== 'string') {
    return '';
  }

  const conflicts = analysis?.component_conflicts?.filter(c => c.componentName === component) || [];
  const hasConflicts = conflicts.length > 0;
  const safeComponent = escapeHtml(component);
  
  return `
    <div class="watchlist-card ${hasConflicts ? 'has-conflicts' : 'safe'}" data-component="${safeComponent}">
      <div class="watchlist-header">
        <h4 class="component-name">${safeComponent}</h4>
        <button class="btn-icon" onclick="unwatchComponent('${safeComponent}')" title="Remove from watchlist">
          <span class="icon-remove">×</span>
        </button>
      </div>
      
      <div class="watchlist-status">
        <span class="status-indicator ${hasConflicts ? 'conflict' : 'safe'}"></span>
        ${hasConflicts ? 
          `${conflicts.length} conflict${conflicts.length > 1 ? 's' : ''} detected` : 
          'No conflicts'
        }
      </div>
      
      <div class="watchlist-actions">
        <button class="btn btn-sm" onclick="viewComponentHistory('${safeComponent}')">
          View History
        </button>
        <button class="btn btn-sm" onclick="compareWithProduction('${safeComponent}')">
          Compare with Prod
        </button>
      </div>
    </div>
  `;
}