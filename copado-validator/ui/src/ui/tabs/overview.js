const $ = (s, r=document) => r.querySelector(s);

export function renderOverviewTab(analysis = {}) {
  const panel = $('#tab-overview');
  if (!panel) return;
  
  // ==================== DEBUG LOGS ====================
  console.log('🔍 ===== ANALYSIS DATA STRUCTURE =====');
  console.log('Full analysis object:', analysis);
  console.log('Analysis keys:', Object.keys(analysis));
  
  const summary = analysis?.summary || {};
  const enhancedSummary = analysis?.summary_enhanced || {};
  const deploymentTaskStories = analysis.deployment_task_stories || [];
  
  console.log('📊 summary:', summary);
  console.log('🚀 summary_enhanced:', enhancedSummary);
  console.log('🛠️ deployment_task_stories count:', deploymentTaskStories.length);
  console.log('🛠️ deployment_task_stories:', deploymentTaskStories);
  
  // Check if we have the new structure
  const hasEnhancedStructure = enhancedSummary && enhancedSummary.total_stories_in_scope;
  console.log('✅ Has enhanced structure:', hasEnhancedStructure);
  console.log('========================================');
  // ==================== END DEBUG LOGS ====================

  // Extract summary data - USE ENHANCED COUNTS WHEN AVAILABLE
  const totalStories = enhancedSummary.total_stories_in_scope || summary.total_stories || (summary.stories_safe || 0) + (summary.stories_blocked || 0) + (summary.stories_with_conflicts || 0);
  
  // FIX: Include deployment tasks in safe stories count
  const deploymentTasksOnly = enhancedSummary.data_source_breakdown?.deployment_tasks_only || 0;
  const safeStories = (summary.stories_safe || 0) + deploymentTasksOnly;
  
  const blockedStories = summary.stories_blocked || 0;
  const conflictStories = summary.stories_with_conflicts || 0;
  const componentConflicts = summary.components_with_conflicts || 0;

  // Calculate deployment task counts
  const deploymentTaskCount = deploymentTaskStories.length;
  const codeChangeStories = totalStories - deploymentTaskCount;

  // Log the calculated values
  console.log('📈 CALCULATED VALUES:');
  console.log('Total Stories:', totalStories);
  console.log('Code Change Stories:', codeChangeStories);
  console.log('Deployment Task Stories:', deploymentTaskCount);
  console.log('Safe Stories (including deployment tasks):', safeStories);
  console.log('Deployment Tasks Only:', deploymentTasksOnly);
  console.log('Blocked Stories:', blockedStories);
  console.log('Conflict Stories:', conflictStories);

  // Calculate derived values
  const deployablePercent = totalStories > 0 ? Math.round((safeStories / totalStories) * 100) : 0;
  const conflictPercent = totalStories > 0 ? Math.round((conflictStories / totalStories) * 100) : 0;
  const blockedPercent = totalStories > 0 ? Math.round((blockedStories / totalStories) * 100) : 0;

  panel.innerHTML = '';

  // Create a container for the header and button
  const headerContainer = createElement('div', { 
    style: 'display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px;' 
  });

  // Section header (left side)
  const headerContent = createElement('div', {}, [
    createElement('h2', { style: 'font-size: 24px; font-weight: 600; margin: 0 0 8px 0; color: white;' }, 'Deployment Overview'),
    createElement('p', { className: 'muted', style: 'font-size: 24px; color: white; margin: 0;' }, 
      enhancedSummary.total_stories_in_scope 
        ? `${totalStories} stories in scope`
        : 'Summary of deployment analysis'
    )
  ]);

  // New Analysis button (right side)
  const newAnalysisBtn = createElement('button', { 
    onclick: () => {
      console.log('New Analysis button clicked');
      if (typeof window.openAnalyzeModal === 'function') {
        window.openAnalyzeModal();
      } else {
        console.error('openAnalyzeModal not available on window');
      }
    },
    style: `
      background: linear-gradient(135deg, #0071e3, #0056b3);
      color: white;
      border: none;
      padding: 12px 24px;
      border-radius: 8px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 600;
      transition: all 0.2s ease;
      box-shadow: 0 4px 12px rgba(0, 113, 227, 0.3);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    `
  }, '🔄 New Analysis');

  // Add hover effect via JavaScript
  newAnalysisBtn.addEventListener('mouseenter', function() {
    this.style.transform = 'translateY(-2px)';
    this.style.boxShadow = '0 6px 16px rgba(0, 113, 227, 0.4)';
  });
  
  newAnalysisBtn.addEventListener('mouseleave', function() {
    this.style.transform = 'translateY(0)';
    this.style.boxShadow = '0 4px 12px rgba(0, 113, 227, 0.3)';
  });

  // Assemble header container
  headerContainer.append(headerContent, newAnalysisBtn);
  panel.append(headerContainer);

  // Clean stats grid with white text - MAKE CARDS CLICKABLE
  const statsGrid = createElement('div', { className: 'stats-grid' });
  
  // Create clickable stat cards
  const totalStoriesCard = createStatCard('Total Stories', totalStories, 'linear-gradient(135deg, #667eea, #764ba2)', {
    subtext: enhancedSummary.total_stories_in_scope 
      ? `${codeChangeStories} code + ${deploymentTaskCount} tasks`
      : 'In deployment scope'
  });
  totalStoriesCard.style.cursor = 'pointer';
  totalStoriesCard.addEventListener('click', () => {
    if (window.showStoriesTab) window.showStoriesTab();
  });

  const readyStoriesCard = createStatCard('Ready', safeStories, 'linear-gradient(135deg, #4CAF50, #2E7D32)', { 
    subtext: `${deployablePercent}% ready`,
    percentage: deployablePercent
  });
  readyStoriesCard.style.cursor = 'pointer';
  readyStoriesCard.addEventListener('click', () => {
    if (window.showStoriesTab) window.showStoriesTab();
  });

  const conflictStoriesCard = createStatCard('Conflicts', conflictStories, 'linear-gradient(135deg, #FF9800, #EF6C00)', { 
    subtext: `${conflictPercent}% need review`,
    percentage: conflictPercent
  });
  conflictStoriesCard.style.cursor = 'pointer';
  conflictStoriesCard.addEventListener('click', () => {
    if (window.showConflictsTab) window.showConflictsTab();
  });

  const blockedStoriesCard = createStatCard('Blocked', blockedStories, 'linear-gradient(135deg, #F44336, #C62828)', { 
    subtext: `${blockedPercent}% blocked`,
    percentage: blockedPercent
  });
  blockedStoriesCard.style.cursor = 'pointer';
  blockedStoriesCard.addEventListener('click', () => {
    if (window.showEnforcementTab) window.showEnforcementTab();
  });

  statsGrid.append(totalStoriesCard, readyStoriesCard, conflictStoriesCard, blockedStoriesCard);
  panel.append(statsGrid);

  // Clean breakdown section
  const detailsSection = createElement('div', { className: 'details-section' });
  
  // Simple breakdown cards - MAKE THEM CLICKABLE TOO
  const breakdownCards = createElement('div', { className: 'breakdown-grid' });
  
  const readyBreakdownCard = createBreakdownCard('Ready Stories', safeStories, '#4CAF50', 'Stories ready for deployment');
  readyBreakdownCard.style.cursor = 'pointer';
  readyBreakdownCard.addEventListener('click', () => {
    if (window.showStoriesTab) window.showStoriesTab();
  });

  const conflictBreakdownCard = createBreakdownCard('Conflict Stories', conflictStories, '#FF9800', 'Stories with conflicts');
  conflictBreakdownCard.style.cursor = 'pointer';
  conflictBreakdownCard.addEventListener('click', () => {
    if (window.showConflictsTab) window.showConflictsTab();
  });

  const blockedBreakdownCard = createBreakdownCard('Blocked Stories', blockedStories, '#F44336', 'Stories blocked by dependencies');
  blockedBreakdownCard.style.cursor = 'pointer';
  blockedBreakdownCard.addEventListener('click', () => {
    if (window.showEnforcementTab) window.showEnforcementTab();
  });

  breakdownCards.append(readyBreakdownCard, conflictBreakdownCard, blockedBreakdownCard);

  // Add deployment tasks if available
  if (deploymentTaskCount > 0) {
    const deploymentTasksCard = createBreakdownCard('Deployment Tasks', deploymentTaskCount, '#388E3C', 'Configuration tasks');
    deploymentTasksCard.style.cursor = 'pointer';
    deploymentTasksCard.addEventListener('click', () => {
      if (window.showStoriesTab) window.showStoriesTab();
    });
    breakdownCards.append(deploymentTasksCard);
  }

  detailsSection.append(breakdownCards);

  // Clean insights card with larger fonts
  const insightsCard = createElement('div', { className: 'insights-card' });
  
  const insights = [];
  
  if (safeStories === totalStories) {
    insights.push({text: 'All stories are ready for deployment', type: 'success'});
  } else {
    if (conflictStories > 0) {
      insights.push({text: `${conflictStories} stories with conflicts affecting ${componentConflicts} components`, type: 'warning'});
    }
    if (blockedStories > 0) {
      insights.push({text: `${blockedStories} stories blocked by production dependencies`, type: 'warning'});
    }
  }
  
  if (componentConflicts > 0) {
    insights.push({text: `${componentConflicts} total component conflicts detected`, type: 'info'});
  }
  
  // Add deployment task insights
  if (deploymentTaskCount > 0) {
    insights.push({text: `${deploymentTaskCount} deployment tasks in release scope`, type: 'info'});
    
    const validatedTasks = deploymentTaskStories.filter(story => 
      story.deployment_details?.validation === 'Validated'
    ).length;
    const nonValidatedTasks = deploymentTaskCount - validatedTasks;
    
    if (validatedTasks > 0) {
      insights.push({text: `${validatedTasks} deployment tasks validated`, type: 'success'});
    }
    if (nonValidatedTasks > 0) {
      insights.push({text: `${nonValidatedTasks} deployment tasks pending validation`, type: 'warning'});
    }
  }
  
  if (insights.length === 0) {
    insights.push({text: 'Review conflicts and blocking issues in their respective tabs', type: 'info'});
  }

  insightsCard.innerHTML = `
    <div class="insights-header">
      <h4>Summary</h4>
    </div>
    <ul class="insights-list">
      ${insights.map(insight => `
        <li class="insight-item insight-${insight.type}">
          <span class="insight-text">${insight.text}</span>
        </li>
      `).join('')}
    </ul>
  `;

  detailsSection.append(insightsCard);
  panel.append(detailsSection);

  // Clean action buttons - REMOVED REPORTS BUTTON
const actionsSection = createElement('div', { className: 'actions-section' });
actionsSection.innerHTML = `
  <div class="actions-grid">
    <button class="action-btn reports-primary" onclick="showReportsTab()">
      <span class="action-text">View Reports</span>
    </button>
  </div>
`;

panel.append(actionsSection);

  injectCss();
}

function createStatCard(label, value, gradient, options = {}) {
  const card = createElement('div', { className: 'stat-card' });
  
  const header = createElement('div', { className: 'stat-label' }, label);
  const val = createElement('div', { className: 'stat-value' }, String(value));
  
  card.append(header, val);
  
  if (options.subtext) {
    const sub = createElement('div', { className: 'stat-subtext' }, options.subtext);
    card.append(sub);
  }

  if (options.percentage !== undefined) {
    const progressBar = createElement('div', { className: 'stat-progress' });
    const progressFill = createElement('div', { 
      className: 'stat-progress-fill',
      style: `width: ${options.percentage}%`
    });
    progressBar.appendChild(progressFill);
    card.append(progressBar);
  }
  
  // Apply gradient background with white text
  card.style.background = gradient;
  
  return card;
}

function createBreakdownCard(label, count, color, description) {
  const card = createElement('div', { className: 'breakdown-card' });
  
  const colorDot = createElement('div', { 
    className: 'breakdown-dot',
    style: `background-color: ${color}` 
  });
  
  const info = createElement('div', { className: 'breakdown-info' }, [
    createElement('div', { className: 'breakdown-header' }, [
      createElement('h4', {}, label),
      createElement('span', { className: 'breakdown-count' }, count)
    ]),
    createElement('p', { className: 'breakdown-description' }, description)
  ]);
  
  card.append(colorDot, info);
  return card;
}

function createElement(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  Object.assign(node, props);
  const childArray = Array.isArray(children) ? children : [children];
  childArray.forEach(child => {
    if (typeof child === 'string') {
      node.appendChild(document.createTextNode(child));
    } else if (child instanceof Node) {
      node.appendChild(child);
    }
  });
  return node;
}

// Global functions for navigation
window.showConflictsTab = function() {
  const conflictTab = document.querySelector('[data-tab="conflicts"]');
  if (conflictTab) conflictTab.click();
};

window.showStoriesTab = function() {
  const storiesTab = document.querySelector('[data-tab="stories"]');
  if (storiesTab) storiesTab.click();
};

window.showReportsTab = function() {
  const reportsTab = document.querySelector('[data-tab="reports"]');
  if (reportsTab) reportsTab.click();
};


const injectCssbacku = (() => {
  let done = false;
  return () => {
    if (done) return;
    done = true;
    
    const css = `
      .stats-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 16px;
        margin-bottom: 32px;
      }
      
      .stat-card {
        background: linear-gradient(135deg, #667eea, #764ba2);
        padding: 20px;
        border-radius: 12px;
        text-align: center;
        color: white;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        transition: all 0.2s ease;
      }
      
      .stat-card:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      }
      
      .stat-label {
        font-size: 14px;
        margin-bottom: 8px;
        font-weight: 500;
        color: white;
        opacity: 0.95;
      }
      
      .stat-value {
        font-size: 32px;
        font-weight: 700;
        margin-bottom: 6px;
        color: white;
      }
      
      .stat-subtext {
        font-size: 13px;
        color: white;
        opacity: 0.9;
      }
      
      .stat-progress {
        width: 100%;
        height: 3px;
        background: rgba(255, 255, 255, 0.3);
        border-radius: 2px;
        overflow: hidden;
        margin-top: 8px;
      }
      
      .stat-progress-fill {
        height: 100%;
        background: rgba(255, 255, 255, 0.9);
        border-radius: 2px;
        transition: width 0.5s ease;
      }
      
      .details-section {
        margin-top: 24px;
      }
      
      .breakdown-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
        gap: 16px;
        margin-bottom: 24px;
      }
      
      .breakdown-card {
        display: flex;
        align-items: flex-start;
        gap: 12px;
        padding: 16px;
        background: white;
        border-radius: 8px;
        border: 1px solid #e5e5e7;
        transition: all 0.2s ease;
      }
      
      .breakdown-card:hover {
        border-color: #d2d2d7;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
      }
      
      .breakdown-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        margin-top: 8px;
        flex-shrink: 0;
      }
      
      .breakdown-info {
        flex: 1;
      }
      
      .breakdown-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 4px;
      }
      
      .breakdown-header h4 {
        margin: 0;
        font-size: 14px;
        font-weight: 600;
        color: #1d1d1f;
      }
      
      .breakdown-count {
        font-size: 16px;
        font-weight: 700;
        color: #1d1d1f;
      }
      
      .breakdown-description {
        margin: 0;
        font-size: 12px;
        color: #666666;
        line-height: 1.4;
      }
      
      .insights-card {
        background: white;
        border: 1px solid #e5e5e7;
        border-radius: 8px;
        padding: 0;
        overflow: hidden;
      }
      
      .insights-header {
        padding: 16px 20px;
        background: #f8f9fa;
        border-bottom: 1px solid #e5e5e7;
      }
      
      .insights-header h4 {
        margin: 0;
        font-size: 16px;
        font-weight: 600;
        color: #1d1d1f;
      }
      
      .insights-list {
        list-style: none;
        padding: 0;
        margin: 0;
      }
      
      .insight-item {
        padding: 14px 20px;
        border-bottom: 1px solid #f5f5f7;
        font-size: 14px;
        line-height: 1.5;
      }
      
      .insight-item:last-child {
        border-bottom: none;
      }
      
      .insight-text {
        color: #1d1d1f;
        font-weight: 500;
      }
      
      .insight-success .insight-text {
        color: #2e7d32;
      }
      
      .insight-warning .insight-text {
        color: #ef6c00;
      }
      
      .insight-info .insight-text {
        color: #1976d2;
      }
      
      .actions-section {
        margin-top: 24px;
      }
      
      .actions-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
        gap: 12px;
      }
      
      .action-btn {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 16px;
        border: 1px solid #e5e5e7;
        border-radius: 8px;
        background: white;
        cursor: pointer;
        transition: all 0.2s ease;
        font-size: 13px;
      }
      
      .action-btn:hover {
        border-color: #d2d2d7;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
      }
      
      .action-btn.primary {
        background: #0071e3;
        color: white;
        border-color: #0071e3;
      }
      
      .action-btn.secondary {
        background: white;
        color: #1d1d1f;
      }
      
      .action-text {
        font-weight: 600;
      }
      
      .action-badge {
        background: rgba(0, 0, 0, 0.1);
        padding: 2px 6px;
        border-radius: 8px;
        font-size: 11px;
        font-weight: 600;
      }
      
      .action-btn.primary .action-badge {
        background: rgba(255, 255, 255, 0.2);
      }
      
      .muted {
        color: white;
        font-size: 24px;
        font-weight: bold;
        font-family: 'Open Sans', 'Segoe UI', Tahoma, sans-serif;
      }
      

      /* Updated header styling */
      #app-header {
        background: rgba(255, 255, 255, 0.95);
        backdrop-filter: blur(20px);
        border-bottom: 1px solid #e5e5e7;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
      }

      #app-header .brand {
        color: #0071e3;
        font-size: 20px;
        font-weight: 700;
        letter-spacing: -0.5px;
      }

      #app-header .brand::before {
        content: "🚀 ";
      }
      
      /* Responsive design */
      @media (max-width: 768px) {
        .stats-grid {
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
        }
        
        .stat-card {
          padding: 16px;
        }
        
        .stat-value {
          font-size: 24px;
        }
        
        .breakdown-grid {
          grid-template-columns: 1fr;
        }
        
        .actions-grid {
          grid-template-columns: 1fr;
        }
        
        .insight-item {
          font-size: 13px;
          padding: 12px 16px;
        }
        
        .insights-header h4 {
          font-size: 15px;
        }
      }
      
      @media (max-width: 480px) {
        .stats-grid {
          grid-template-columns: 1fr;
        }
        
        .insight-item {
          font-size: 13px;
          padding: 10px 14px;
        }
      }
    `;
    
    document.head.appendChild(Object.assign(document.createElement('style'), { textContent: css }));
  };
})();

const injectCss = (() => {
  let done = false;
  return () => {
    if (done) return;
    done = true;
    
    const css = `
      .stats-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 16px;
        margin-bottom: 32px;
      }
      
      .stat-card {
        background: linear-gradient(135deg, #667eea, #764ba2);
        padding: 20px;
        border-radius: 12px;
        text-align: center;
        color: white;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        transition: all 0.2s ease;
      }
      
      .stat-card:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      }
      
      .stat-label {
        font-size: 14px;
        margin-bottom: 8px;
        font-weight: 500;
        color: white;
        opacity: 0.95;
      }
      
      .stat-value {
        font-size: 32px;
        font-weight: 700;
        margin-bottom: 6px;
        color: white;
      }
      
      .stat-subtext {
        font-size: 13px;
        color: white;
        opacity: 0.9;
      }
      
      .stat-progress {
        width: 100%;
        height: 3px;
        background: rgba(255, 255, 255, 0.3);
        border-radius: 2px;
        overflow: hidden;
        margin-top: 8px;
      }
      
      .stat-progress-fill {
        height: 100%;
        background: rgba(255, 255, 255, 0.9);
        border-radius: 2px;
        transition: width 0.5s ease;
      }
      
      .details-section {
        margin-top: 24px;
      }
      
      .breakdown-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
        gap: 16px;
        margin-bottom: 24px;
      }
      
      .breakdown-card {
        display: flex;
        align-items: flex-start;
        gap: 12px;
        padding: 16px;
        background: white;
        border-radius: 8px;
        border: 1px solid #e5e5e7;
        transition: all 0.2s ease;
      }
      
      .breakdown-card:hover {
        border-color: #d2d2d7;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
      }
      
      .breakdown-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        margin-top: 8px;
        flex-shrink: 0;
      }
      
      .breakdown-info {
        flex: 1;
      }
      
      .breakdown-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 4px;
      }
      
      .breakdown-header h4 {
        margin: 0;
        font-size: 14px;
        font-weight: 600;
        color: #1d1d1f;
      }
      
      .breakdown-count {
        font-size: 16px;
        font-weight: 700;
        color: #1d1d1f;
      }
      
      .breakdown-description {
        margin: 0;
        font-size: 12px;
        color: #666666;
        line-height: 1.4;
      }
      
      .insights-card {
        background: white;
        border: 1px solid #e5e5e7;
        border-radius: 8px;
        padding: 0;
        overflow: hidden;
      }
      
      .insights-header {
        padding: 16px 20px;
        background: #f8f9fa;
        border-bottom: 1px solid #e5e5e7;
      }
      
      .insights-header h4 {
        margin: 0;
        font-size: 16px;
        font-weight: 600;
        color: #1d1d1f;
      }
      
      .insights-list {
        list-style: none;
        padding: 0;
        margin: 0;
      }
      
      .insight-item {
        padding: 14px 20px;
        border-bottom: 1px solid #f5f5f7;
        font-size: 14px;
        line-height: 1.5;
      }
      
      .insight-item:last-child {
        border-bottom: none;
      }
      
      .insight-text {
        color: #1d1d1f;
        font-weight: 500;
      }
      
      .insight-success .insight-text {
        color: #2e7d32;
      }
      
      .insight-warning .insight-text {
        color: #ef6c00;
      }
      
      .insight-info .insight-text {
        color: #1976d2;
      }
      
      .actions-section {
        margin-top: 24px;
      }
      
      .actions-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
        gap: 12px;
      }
      
      .action-btn {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 16px;
        border: 1px solid #e5e5e7;
        border-radius: 8px;
        background: white;
        cursor: pointer;
        transition: all 0.2s ease;
        font-size: 13px;
      }
      
      .action-btn:hover {
        border-color: #d2d2d7;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
      }
      
      .action-btn.primary {
        background: #0071e3;
        color: white;
        border-color: #0071e3;
      }
      
      .action-btn.secondary {
        background: white;
        color: #1d1d1f;
      }
      
      .action-text {
        font-weight: 600;
      }
      
      .action-badge {
        background: rgba(0, 0, 0, 0.1);
        padding: 2px 6px;
        border-radius: 8px;
        font-size: 11px;
        font-weight: 600;
      }
      
      .action-btn.primary .action-badge {
        background: rgba(255, 255, 255, 0.2);
      }
      
      .muted {
        color: white;
        font-size: 24px;
        font-weight: bold;
        font-family: 'Open Sans', 'Segoe UI', Tahoma, sans-serif;
      }
      

      /* Updated header styling */
      #app-header {
        background: rgba(255, 255, 255, 0.95);
        backdrop-filter: blur(20px);
        border-bottom: 1px solid #e5e5e7;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
      }

      #app-header .brand {
        color: #0071e3;
        font-size: 20px;
        font-weight: 700;
        letter-spacing: -0.5px;
      }

      #app-header .brand::before {
        content: "🚀 ";
      }
      
      /* Responsive design */
      @media (max-width: 768px) {
        .stats-grid {
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
        }
        
        .stat-card {
          padding: 16px;
        }
        
        .stat-value {
          font-size: 24px;
        }
        
        .breakdown-grid {
          grid-template-columns: 1fr;
        }
        
        .actions-grid {
          grid-template-columns: 1fr;
        }
        
        .insight-item {
          font-size: 13px;
          padding: 12px 16px;
        }
        
        .insights-header h4 {
          font-size: 15px;
        }
      }
.actions-section {
  margin-top: 24px;
  text-align: center;
}

.actions-grid {
  display: flex;
  justify-content: center;
  gap: 12px;
}

.action-btn.reports-primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
  font-weight: 700;
  font-size: 15px;
  letter-spacing: 0.5px;
  padding: 14px 32px;
  border-radius: 10px;
  transition: all 0.3s ease;
  min-width: 180px;
  text-transform: uppercase;
}

.action-btn.reports-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
  background: linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%);
}

.action-btn.reports-primary .action-text {
  color: white;
  font-weight: 700;
  font-size: 15px;
}
      
      @media (max-width: 480px) {
        .stats-grid {
          grid-template-columns: 1fr;
        }
        
        .insight-item {
          font-size: 13px;
          padding: 10px 14px;
        }
      }
    `;
    
    document.head.appendChild(Object.assign(document.createElement('style'), { textContent: css }));
  };
})();
