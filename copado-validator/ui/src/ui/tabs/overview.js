// ui/src/ui/tabs/overview.js
const $ = (s, r=document) => r.querySelector(s);

export function renderOverviewTab(analysis = {}) {
  const panel = $('#tab-overview');
  if (!panel) return;
  
  const summary = analysis?.summary || {};

  // Extract summary data - USE ACTUAL COUNTS FROM SUMMARY
  const totalStories = summary.total_stories || (summary.stories_safe || 0) + (summary.stories_blocked || 0) + (summary.stories_with_conflicts || 0);
  const safeStories = summary.stories_safe || 0;
  const blockedStories = summary.stories_blocked || 0;
  const conflictStories = summary.stories_with_conflicts || 0; // This should be 9 from console log
  const componentConflicts = summary.components_with_conflicts || 0; // This is 21 from console log

  // Calculate derived values - USE ACTUAL STORY COUNTS, not component counts
  const deployablePercent = totalStories > 0 ? Math.round((safeStories / totalStories) * 100) : 0;
  const conflictPercent = totalStories > 0 ? Math.round((conflictStories / totalStories) * 100) : 0;
  const blockedPercent = totalStories > 0 ? Math.round((blockedStories / totalStories) * 100) : 0;

  panel.innerHTML = '';

  // Section header
  panel.append(
    createElement('div', { className: 'section-header' }, [
      createElement('h2', {}, 'Analysis Summary'),
      createElement('p', { className: 'muted' }, 'Overview of your deployment analysis')
    ])
  );

  // Status indicators grid
  const statsGrid = createElement('div', { className: 'stats-grid' });
  
  statsGrid.append(
    createStatCard('Total Stories', totalStories, '#1d1d1f'),
    createStatCard('Safe to Deploy', safeStories, '#34C759', { subtext: `${deployablePercent}% ready` }),
    createStatCard('Conflicts', conflictStories, '#FF9500', { subtext: `${conflictPercent}% stories` }),
    createStatCard('Blocked', blockedStories, '#FF3B30', { subtext: `${blockedPercent}% blocked` })
  );

  panel.append(statsGrid);

  // Detail cards section
  const detailsSection = createElement('div', { className: 'details-section' });
  
  detailsSection.append(
    createElement('h3', { className: 'section-title' }, 'Deployment Readiness')
  );

  // Readiness breakdown - USE ACTUAL STORY COUNTS
  const breakdownCards = createElement('div', { className: 'breakdown-grid' });
  
  breakdownCards.append(
    createBreakdownCard('Ready', safeStories, '#34C759', 'ready'),
    createBreakdownCard('Conflicts', conflictStories, '#FF9500', 'conflict'),
    createBreakdownCard('Blocked', blockedStories, '#FF3B30', 'blocked')
  );

  detailsSection.append(breakdownCards);

  // Summary insights - SHOW BOTH STORY AND COMPONENT COUNTS
  const insightsCard = createElement('div', { className: 'insights-card' });
  
  const insights = [];
  
  if (safeStories === totalStories) {
    insights.push('✓ All stories are ready for deployment');
  } else {
    if (conflictStories > 0) {
      insights.push(`⚠ ${conflictStories} stories with conflicts affecting ${componentConflicts} components`);
    }
    if (blockedStories > 0) {
      insights.push(`⚠ ${blockedStories} stories blocked by production dependencies`);
    }
  }
  
  if (componentConflicts > 0) {
    insights.push(`🔧 ${componentConflicts} total component conflicts detected`);
  }
  
  if (insights.length === 0) {
    insights.push('Review conflicts and blocking issues in their respective tabs');
  }

  insightsCard.innerHTML = `
    <h4>Key Insights</h4>
    <ul class="insights-list">
      ${insights.map(i => `<li>${i}</li>`).join('')}
    </ul>
  `;

  detailsSection.append(insightsCard);
  panel.append(detailsSection);

  injectCss();
}

function createStatCard(label, value, color, options = {}) {
  const card = createElement('div', { className: 'stat-card' });
  
  const header = createElement('div', { className: 'stat-label' }, label);
  const val = createElement('div', { className: 'stat-value', style: `color: ${color}` }, String(value));
  
  card.append(header, val);
  
  if (options.subtext) {
    const sub = createElement('div', { className: 'stat-subtext' }, options.subtext);
    card.append(sub);
  }
  
  return card;
}

function createBreakdownCard(label, count, color, type) {
  const card = createElement('div', { className: 'breakdown-card' });
  
  const icon = createElement('div', { className: `breakdown-icon breakdown-${type}` });
  const info = createElement('div', { className: 'breakdown-info' }, [
    createElement('h4', {}, label),
    createElement('p', {}, `${count} ${count === 1 ? 'story' : 'stories'}`)
  ]);
  
  card.append(icon, info);
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

const injectCss = (() => {
  let done = false;
  return () => {
    if (done) return;
    done = true;
    
    const css = `
      .stats-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
        gap: 12px;
        margin-bottom: 32px;
      }
      
      .stat-card {
        background: #f5f5f7;
        padding: 16px;
        border-radius: 8px;
        text-align: center;
      }
      
      .stat-label {
        font-size: 13px;
        color: #86868b;
        margin-bottom: 8px;
        font-weight: 500;
      }
      
      .stat-value {
        font-size: 28px;
        font-weight: 600;
        margin-bottom: 4px;
      }
      
      .stat-subtext {
        font-size: 12px;
        color: #86868b;
      }
      
      .details-section {
        margin-top: 24px;
      }
      
      .section-title {
        font-size: 16px;
        font-weight: 600;
        margin-bottom: 16px;
        color: #1d1d1f;
      }
      
      .breakdown-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 12px;
        margin-bottom: 24px;
      }
      
      .breakdown-card {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px;
        background: white;
        border-radius: 8px;
        border: 1px solid #e5e5e7;
        transition: all 0.3s ease;
      }
      
      .breakdown-card:hover {
        box-shadow: 0 2px 8px rgba(0,0,0,0.08);
        border-color: #d2d2d7;
      }
      
      .breakdown-icon {
        width: 32px;
        height: 32px;
        border-radius: 6px;
        flex-shrink: 0;
      }
      
      .breakdown-icon.breakdown-ready {
        background: #d1f4e0;
      }
      
      .breakdown-icon.breakdown-conflict {
        background: #ffd4a3;
      }
      
      .breakdown-icon.breakdown-blocked {
        background: #ffcccb;
      }
      
      .breakdown-info h4 {
        margin: 0;
        font-size: 14px;
        font-weight: 600;
        color: #1d1d1f;
      }
      
      .breakdown-info p {
        margin: 2px 0 0;
        font-size: 12px;
        color: #86868b;
      }
      
      .insights-card {
        background: #f5f5f7;
        padding: 16px;
        border-radius: 8px;
      }
      
      .insights-card h4 {
        margin: 0 0 12px;
        font-size: 14px;
        font-weight: 600;
        color: #1d1d1f;
      }
      
      .insights-list {
        list-style: none;
        padding: 0;
        margin: 0;
      }
      
      .insights-list li {
        padding: 6px 0;
        font-size: 13px;
        color: #1d1d1f;
        line-height: 1.5;
      }
    `;
    
    document.head.appendChild(Object.assign(document.createElement('style'), { textContent: css }));
  };
})();