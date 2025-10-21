// ui/src/main.js
import { CONFIG, applyHeaderBadges, debugLog, API_URL } from './config.js';
import { openAnalyzeOnlineFlow } from './controllers/analyzeOnline.js';

// NEW: Import enhanced tab renderers
import { renderOverviewTab } from './ui/tabs/overview.js';
import { renderStoriesTab } from './ui/tabs/stories-enhanced.js';
import { renderConflictsTab } from './ui/tabs/conflicts-enhanced.js';
import { renderEnforcementTab } from './ui/tabs/enforcement-enhanced.js';
import { createAnalyzeModal } from './ui/components/analyzeModal.js';
import { renderDeploymentPlanTab } from './ui/tabs/deployment-plan.js';
import { renderReportsTab } from './ui/tabs/reports-enhanced.js';


/* ---------- tiny DOM helpers ---------- */
const $ = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
function el(tag, props={}, children=[]) {
  const node = Object.assign(document.createElement(tag), props);
  children.forEach(c => node.append(c));
  return node;
}

/* ---------- state ---------- */
const STATE = {
  role: localStorage.getItem('ui.role') || 'Developer',
  source: '—',
  analysisId: null,
  isLocked: false,
  batchProgress: {}
};

let ANALYSIS = null;
let STORIES_DATA = null;
let CONFLICTS_DATA = null;
let ENFORCEMENT_RESULTS = null;

/* ---------- boot ---------- */
document.addEventListener('DOMContentLoaded', () => {
  applyHeaderBadges();
  mountRoleSwitcher();
  mountThemeSwitcher();
  wireAnalyzeMenuEnhanced();  // UPDATED
  wireTabsEnhanced();         // UPDATED
  wireAnalysisEvents();
  renderOverviewLanding();
  debugLog('boot', CONFIG);
});

/* ---------- role switcher ---------- */
function mountRoleSwitcher() {
  const header = $('#app-header .env');
  if (!header || $('#role-switch')) return;

  const wrap = el('div', { id: 'role-switch', className: 'role-switch', role: 'group', ariaLabel: 'Select role' });
  const devBtn = el('button', { className: 'btn role-btn', type: 'button', textContent: 'Developer' });
  const opsBtn = el('button', { className: 'btn role-btn', type: 'button', textContent: 'DevOps' });

  function sync() {
    devBtn.classList.toggle('btn-primary', STATE.role === 'Developer');
    opsBtn.classList.toggle('btn-primary', STATE.role === 'DevOps');
    localStorage.setItem('ui.role', STATE.role);
    renderOverviewLanding();
  }
  devBtn.addEventListener('click', () => { STATE.role = 'Developer'; sync(); });
  opsBtn.addEventListener('click', () => { STATE.role = 'DevOps'; sync(); });

  wrap.append(devBtn, opsBtn);
  header.parentElement.insertBefore(wrap, header.nextSibling);
  sync();
}

/* ---------- theme switcher ---------- */
function mountThemeSwitcher() {
  const header = $('#app-header .env');
  if (!header || $('#theme-switch')) return;

  const wrap = el('div', { id: 'theme-switch', className: 'theme-switch', role: 'group', ariaLabel: 'Select theme' });
  const btns = [
    el('button', { className: 'btn role-btn', type: 'button', textContent: 'Midnight' }),
    el('button', { className: 'btn role-btn', type: 'button', textContent: 'Quartz' })
  ];

  const apply = (name) => {
    const value = name === 'Quartz' ? 'quartz' : '';
    document.documentElement.dataset.theme = value;
    localStorage.setItem('ui.theme', value || 'midnight');
    btns.forEach(b => b.classList.toggle('btn-primary', b.textContent === name));
  };

  btns[0].addEventListener('click', () => apply('Midnight'));
  btns[1].addEventListener('click', () => apply('Quartz'));

  wrap.append(...btns);
  header.parentElement.insertBefore(wrap, header.nextSibling);

  const saved = localStorage.getItem('ui.theme');
  apply(saved === 'quartz' ? 'Quartz' : 'Midnight');
}

/* ---------- ENHANCED: analyze menu ---------- */
function wireAnalyzeMenuEnhanced() {
  const trigger = $('#analyze-trigger');
  const menu = $('#analyze-menu');
  if (!trigger || !menu) return;

  trigger.addEventListener('click', (e) => {
    if (STATE.isLocked) {
      e.stopPropagation();
      toast('Analysis in progress. Please wait.');
      return;
    }
    
    e.stopPropagation();
    const open = menu.getAttribute('aria-hidden') === 'false';
    menu.setAttribute('aria-hidden', open ? 'true' : 'false');
    trigger.setAttribute('aria-expanded', open ? 'false' : 'true');
  });

  document.addEventListener('click', () => {
    menu.setAttribute('aria-hidden', 'true');
    trigger.setAttribute('aria-expanded', 'false');
  });

  // CSV Analysis
  const csvBtn = menu.querySelector('[data-action="analyze-csv"]');
  if (csvBtn) {
    csvBtn.addEventListener('click', async () => {
      menu.setAttribute('aria-hidden', 'true');
      try {
        await openAnalyzeCsvFlow();
      } catch (err) {
        console.error('CSV analysis error:', err);
        toast(`Error: ${err.message}`);
      }
    });
  }

  // Online Analysis - NEW: Show Modal
const onlineBtn = menu.querySelector('[data-action="analyze-online"]');
if (onlineBtn) {
  onlineBtn.addEventListener('click', async (e) => {
    menu.setAttribute('aria-hidden', 'true');
    
    const input = prompt('Enter story names (comma-separated):\nExample: US-0033635, US-0033636');
    if (!input) return;
    
    try {
      STATE.isLocked = true;
      updateAnalyzeButton();
      toast('Analyzing...');
      
      const stories = input.split(',').map(s => s.trim()).filter(Boolean);
      
      const result = await openAnalyzeOnlineFlow({
        userStoryNames: stories,
        releaseNames: undefined
      });
      
      // MAP API response to expected structure
      ANALYSIS = {
        summary: result.ANALYSIS.summary,
        all_stories: result.ANALYSIS.safe || [],
        component_conflicts: result.ANALYSIS.conflicts || [],
        blocked_stories: result.ANALYSIS.blocked || []
      };

      STORIES_DATA = result.STORIES_DATA;
      CONFLICTS_DATA = result.ANALYSIS.conflicts || [];
      STATE.source = 'Online';
      updateSourceBadge();
      
      console.log('Mapped ANALYSIS:', ANALYSIS);
      toast('Analysis complete!');
      
      const overviewBtn = document.querySelector('[data-tab="overview"]');
      if (overviewBtn) overviewBtn.click();
      
    } catch (err) {
      console.error('Error:', err);
      toast(`Error: ${err.message}`);
    } finally {
      STATE.isLocked = false;
      updateAnalyzeButton();
    }
  });
}

}

/* ---------- ENHANCED: wire tabs ---------- */
// In your wireTabsEnhanced() function, add the reports tab:

function wireTabsEnhanced() {
  const buttons = $$('.tab-button');
  const panels = $$('.tab-panel');
  if (!buttons.length || !panels.length) return;

  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;

      buttons.forEach(b => b.setAttribute('aria-selected', b === btn ? 'true' : 'false'));
      panels.forEach(p => p.toggleAttribute('hidden', p.id !== `tab-${tab}`));

      try {
        if (tab === 'overview') {
          if (ANALYSIS) {
            console.log('ANALYSIS for overview:', ANALYSIS);
            renderOverviewTab(ANALYSIS);
          } else {
            renderOverviewLanding();
          }
        }
        if (tab === 'stories') {
          if (ANALYSIS) renderStoriesTab(ANALYSIS);
          else renderOverviewLanding();
        }
        if (tab === 'conflicts') {
          if (ANALYSIS) {
            console.log('ANALYSIS for conflicts:', ANALYSIS);
            console.log('component_conflicts:', ANALYSIS.component_conflicts);
            console.log('conflicts:', ANALYSIS.conflicts);
            renderConflictsTab(ANALYSIS);
          } else {
            renderOverviewLanding();
          }
        }
        if (tab === 'enforcement') {
          if (ANALYSIS) {
            console.log('ANALYSIS for enforcement:', ANALYSIS);
            console.log('blocked_stories:', ANALYSIS.blocked_stories);
            renderEnforcementTab(ANALYSIS);
          } else {
            renderOverviewLanding();
          }
        }
        if (tab === 'plan') {
          if (ANALYSIS) renderDeploymentPlanTab(STORIES_DATA || {}, ENFORCEMENT_RESULTS || [], CONFLICTS_DATA || {});
          else renderOverviewLanding();
        }
        // 🆕 ADD THIS SECTION FOR REPORTS TAB
        if (tab === 'reports') {
          if (ANALYSIS) {
            console.log('ANALYSIS for reports:', ANALYSIS);
            renderReportsTab(ANALYSIS);
          } else {
            renderOverviewLanding();
          }
        }
      } catch (err) {
        console.error('Tab render error:', err);
        toast('Error loading tab');
      }
    });
  });
}


/* ---------- NEW: Helper - Toast Notification ---------- */
export function toast(message, duration = 3000) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toastEl = document.createElement('div');
  toastEl.className = 'toast';
  toastEl.textContent = message;
  toastEl.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: #1d1d1f;
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    font-size: 13px;
    z-index: 999;
    animation: slideInUp 0.3s ease;
  `;

  document.body.appendChild(toastEl);

  setTimeout(() => {
    toastEl.style.animation = 'slideInDown 0.3s ease';
    setTimeout(() => toastEl.remove(), 300);
  }, duration);
}

/* ---------- NEW: Helper - Update Analyze Button State ---------- */
export function updateAnalyzeButton() {
  const btn = $('#analyze-trigger');
  if (!btn) return;
  
  if (STATE.isLocked) {
    btn.disabled = true;
    btn.style.opacity = '0.5';
    btn.textContent = 'Analyzing...';
  } else {
    btn.disabled = false;
    btn.style.opacity = '1';
    btn.textContent = 'Analyze';
  }
}

function updateSourceBadge() {
  const sourceEl = document.getElementById('source-badge');
  if (sourceEl) sourceEl.textContent = `Source: ${STATE.source}`;
}

/* ---------- batch processing ---------- */
function startBatchProcessing(analysis, source) {
  STATE.isLocked = true;
  STATE.batchProgress = {};
  updateAnalyzeButton();
  toast('Starting analysis batches...');
  
  debugLog('batch:start', { source });

  renderEnforcementTab(analysis);
}

function onEnforcementComplete(enforcementResults) {
  debugLog('api:analysis-structure', {
    hasAllStories: !!ANALYSIS?.all_stories,
    allStoriesCount: ANALYSIS?.all_stories?.length || 0,
    summary: ANALYSIS?.summary || {},
    allTopLevelKeys: ANALYSIS ? Object.keys(ANALYSIS) : []
  });

  const statusCounts = {};
  (enforcementResults || []).forEach(r => {
    statusCounts[r.status] = (statusCounts[r.status] || 0) + 1;
  });
  
  debugLog('batch:enforcement:status-breakdown', statusCounts);
  
  const behindProdByStory = new Map();
  (enforcementResults || []).forEach(result => {
    if (result.status === 'BEHIND_PROD' && result.primaryStoryId) {
      if (!behindProdByStory.has(result.primaryStoryId)) {
        behindProdByStory.set(result.primaryStoryId, result);
      }
    }
  });
  
  ENFORCEMENT_RESULTS = Array.from(behindProdByStory.values());
  
  STATE.batchProgress['enforcement'] = true;
  
  debugLog('batch:enforcement:complete', { 
    totalComponentsInResults: enforcementResults.length,
    uniqueBehindProdStories: ENFORCEMENT_RESULTS.length,
    dedupDetails: {
      storiesRemoved: enforcementResults.length - ENFORCEMENT_RESULTS.length,
      behindProdStoryIds: ENFORCEMENT_RESULTS.map(r => r.primaryStoryId)
    }
  });

  processBatchFilterStories(ANALYSIS, ENFORCEMENT_RESULTS);
  processBatchConflicts(STORIES_DATA);
}

function processBatchFilterStories(analysis, enforcementResults) {
  const behindProdStoryIds = new Set(
    enforcementResults
      .filter(r => r.status === 'BEHIND_PROD')
      .map(r => r.primaryStoryId)
      .filter(Boolean)
  );

  debugLog('batch:stories:filtering', {
    totalEnforcementResults: enforcementResults.length,
    uniqueBehindProdStories: behindProdStoryIds.size,
    behindStories: Array.from(behindProdStoryIds)
  });

  const rawStories = analysis?.all_stories || [];
  const deduped = new Map();
  rawStories.forEach(s => {
    const storyId = s?.id || s?.name || s?.key;
    if (storyId && !deduped.has(storyId)) {
      deduped.set(storyId, s);
    }
  });
  
  STATE.batchProgress['stories'] = true;
  debugLog('batch:stories:complete', {
    inputCount: rawStories.length,
    uniqueCount: deduped.size
  });
}

function processBatchConflicts(storiesData) {
  const rawConflicts = storiesData?.all_stories || [];
  const deduped = new Map();
  rawConflicts.forEach(c => {
    const conflictId = c?.id || c?.component_id;
    if (conflictId && !deduped.has(conflictId)) {
      deduped.set(conflictId, c);
    }
  });

  STATE.batchProgress['conflicts'] = true;
  debugLog('batch:conflicts:complete', {
    inputCount: rawConflicts.length,
    uniqueCount: deduped.size
  });

  STATE.isLocked = false;
  updateAnalyzeButton();
  toast('Analysis complete!');
}

function wireAnalysisEvents() {
  if (typeof window.__analyzeStories !== 'function') return;

  window.addEventListener('analysis-result', (e) => {
    const { analysis, source } = e.detail || {};
    
    if (!analysis) {
      console.error('No analysis data in event');
      return;
    }

    ANALYSIS = analysis;
    STATE.source = source || 'Online';
    updateSourceBadge();

    startBatchProcessing(analysis, source);
    
    setTimeout(() => {
      onEnforcementComplete(ENFORCEMENT_RESULTS || []);
      renderOverviewLanding();
      
      const overviewBtn = document.querySelector('[data-tab="overview"]');
      if (overviewBtn) {
        overviewBtn.click();
      }
    }, 500);
  });
}

function renderOverviewLanding() {
  const panel = $('#tab-overview');
  if (!panel) return;

  // Remove this check - always show landing
  panel.innerHTML = `
    <div style="text-align: center; padding: 60px 20px; color: #86868b;">
      <div style="font-size: 48px; margin-bottom: 20px;">📊</div>
      <h2 style="margin: 0 0 10px; font-size: 20px; font-weight: 600; color: #1d1d1f;">Welcome to Deployment Planner</h2>
      <p style="margin: 0; font-size: 14px;">Click "Analyze" to get started with your deployment analysis</p>
    </div>
  `;
}

function injectSafeEnhancements() {
  const style = document.createElement('style');
  style.textContent = `
    /* Safe hover effects only */
    .story-card:hover,
    .conflict-card:hover,
    .enforcement-card:hover,
    .report-type-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
      transition: all 0.3s ease;
    }
    
    .btn-primary:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow: 0 6px 20px rgba(0, 113, 227, 0.4);
    }
    
    .stat-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
    }
    
    /* Enhanced status badges */
    .status-safe {
      background: linear-gradient(135deg, #34C759, #2daa4d);
      color: white;
    }
    
    .status-conflict {
      background: linear-gradient(135deg, #FF9500, #e68500);
      color: white;
    }
    
    .status-blocked {
      background: linear-gradient(135deg, #FF3B30, #e63329);
      color: white;
    }
    
    /* Subtle topbar enhancement */
    .topbar {
      backdrop-filter: blur(10px);
      background: rgba(255, 255, 255, 0.95);
    }
  `;
  document.head.appendChild(style);
}

// Call it after your existing injectOnce() function
document.addEventListener('DOMContentLoaded', () => {
  injectSafeEnhancements();
});

// Enhanced professional styles - add to your existing injection in main.js
function injectEnhancedProfessionalStyles() {
  const style = document.createElement('style');
  style.textContent = `
    /* ===== ENHANCED CARD STYLES ===== */
    .story-card,
    .conflict-card,
    .enforcement-card,
    .report-type-section,
    .report-options-section,
    .report-actions-section,
    .report-preview-section {
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      position: relative;
      border-radius: 12px;
    }
    
    .story-card:hover,
    .conflict-card:hover,
    .enforcement-card:hover {
      transform: translateY(-3px);
      box-shadow: 0 12px 32px rgba(0, 0, 0, 0.12);
      border-color: #d2d2d7;
    }
    
    /* ===== ENHANCED STATUS BADGES ===== */
    .status-badge {
      position: relative;
      overflow: hidden;
      transition: all 0.3s ease;
      font-weight: 600;
      border: 1px solid;
    }
    
    .status-badge:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }
    
    .status-safe {
      background: linear-gradient(135deg, #34C759, #2daa4d);
      border-color: #2daa4d;
      color: white;
    }
    
    .status-conflict {
      background: linear-gradient(135deg, #FF9500, #e68500);
      border-color: #e68500;
      color: white;
    }
    
    .status-blocked {
      background: linear-gradient(135deg, #FF3B30, #e63329);
      border-color: #e63329;
      color: white;
    }
    
    /* ===== ENHANCED BUTTONS ===== */
    .btn {
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      border-radius: 10px;
      font-weight: 600;
      position: relative;
      overflow: hidden;
    }
    
    .btn-primary {
      background: linear-gradient(135deg, #0071e3, #0056b3);
      box-shadow: 0 4px 12px rgba(0, 113, 227, 0.3);
    }
    
    .btn-primary:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 8px 24px rgba(0, 113, 227, 0.4);
    }
    
    .btn-secondary:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
    }
    
    /* ===== ENHANCED STATS & METRICS ===== */
    .stat-card {
      transition: all 0.3s ease;
      border-radius: 12px;
    }
    
    .stat-card:hover {
      transform: translateY(-3px);
      box-shadow: 0 12px 32px rgba(0, 0, 0, 0.1);
    }
    
    .stat-value {
      font-weight: 700;
      background: linear-gradient(135deg, #1d1d1f, #434346);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    
    /* ===== ENHANCED FILTER BAR ===== */
    .filter-bar {
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
      border-radius: 12px;
      border: 1px solid rgba(255, 255, 255, 0.8);
    }
    
    /* ===== ENHANCED TOPBAR ===== */
    .topbar {
      backdrop-filter: blur(20px);
      background: rgba(255, 255, 255, 0.92);
      border-bottom: 1px solid rgba(255, 255, 255, 0.8);
    }
    
    .brand {
      font-weight: 700;
      background: linear-gradient(135deg, #1d1d1f, #434346);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    
    /* ===== ENHANCED REPORT CARDS ===== */
    .report-type-card {
      transition: all 0.3s ease;
      cursor: pointer;
      border-radius: 12px;
    }
    
    .report-type-card:hover {
      transform: translateY(-3px);
      box-shadow: 0 12px 32px rgba(0, 0, 0, 0.1);
      border-color: #0071e3;
      background: #f8f9fa;
    }
    
    .report-type-card.selected {
      border-color: #0071e3;
      background: #e8f0ff;
      box-shadow: 0 8px 24px rgba(0, 113, 227, 0.15);
    }
    
    /* ===== ENHANCED COMPONENT ITEMS ===== */
    .component-item {
      transition: all 0.3s ease;
      border-radius: 10px;
    }
    
    .component-item:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
    }
    
    .component-item.has-old-commit {
      border-left: 4px solid #FF3B30;
      background: #fff3f3;
    }
    
    /* ===== ENHANCED TIMELINE ===== */
    .timeline-marker {
      box-shadow: 0 0 0 3px rgba(0, 0, 0, 0.08);
    }
    
    .conflicting-story .timeline-marker {
      box-shadow: 0 0 0 3px rgba(255, 59, 48, 0.2);
    }
    
    .current-story .timeline-marker {
      box-shadow: 0 0 0 3px rgba(0, 113, 227, 0.2);
    }
    
    .production-story .timeline-marker {
      box-shadow: 0 0 0 3px rgba(52, 199, 89, 0.2);
    }
    
    /* ===== ENHANCED TYPOGRAPHY ===== */
    .section-header h2 {
      background: linear-gradient(135deg, #1d1d1f, #434346);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      font-weight: 700;
    }
    
    .story-title,
    .conflict-story-title,
    .enforcement-title {
      font-weight: 600;
      letter-spacing: -0.1px;
    }
    
    /* ===== ENHANCED EMPTY STATES ===== */
    .empty-card {
      border-radius: 16px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.06);
    }
    
    .empty-icon {
      opacity: 0.9;
      filter: grayscale(0.1);
    }
    
    /* ===== SUBTLE LOADING EFFECTS ===== */
    .loading-state {
      background: linear-gradient(90deg, #f5f5f7 25%, #e8e8ed 50%, #f5f5f7 75%);
      background-size: 200% 100%;
      animation: shimmer 2s infinite;
      border-radius: 8px;
    }
    
    @keyframes shimmer {
      0% { background-position: -200% 0; }
      100% { background-position: 200% 0; }
    }
    
    /* ===== ENHANCED TAB NAVIGATION ===== */
    .tab-button {
      transition: all 0.3s ease;
      position: relative;
    }
    
    .tab-button:hover {
      background: rgba(0, 113, 227, 0.04);
    }
    
    .tab-button[aria-selected="true"] {
      font-weight: 600;
    }
    
    /* ===== RESPONSIVE ENHANCEMENTS ===== */
    @media (max-width: 768px) {
      .story-card:hover,
      .conflict-card:hover,
      .enforcement-card:hover {
        transform: translateY(-1px);
      }
      
      .btn-primary:hover:not(:disabled) {
        transform: translateY(-1px);
      }
    }
  `;
  
  // Remove any previous enhanced styles to avoid duplicates
  const existingStyle = document.getElementById('enhanced-professional-styles');
  if (existingStyle) {
    existingStyle.remove();
  }
  
  style.id = 'enhanced-professional-styles';
  document.head.appendChild(style);
}

// Call this function in your DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
  injectEnhancedProfessionalStyles();
});

// Micro-interactions for premium feel
function injectMicroInteractions() {
  const style = document.createElement('style');
  style.textContent = `
    /* Subtle pulse animation for important elements */
    @keyframes subtle-pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.8; }
    }
    
    .status-badge {
      animation: subtle-pulse 3s ease-in-out infinite;
    }
    
    /* Ripple effect for buttons */
    .btn-primary {
      position: relative;
      overflow: hidden;
    }
    
    .btn-primary:active::after {
      content: '';
      position: absolute;
      top: 50%;
      left: 50%;
      width: 0;
      height: 0;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.5);
      transform: translate(-50%, -50%);
      animation: ripple 0.6s ease-out;
    }
    
    @keyframes ripple {
      to {
        width: 200px;
        height: 200px;
        opacity: 0;
      }
    }
  `;
  document.head.appendChild(style);
}

/* ---------- minimal CSS hooks ---------- */
const injectOnce = (() => {
  let done = false;
  return () => {
    if (done) return; done = true;
    const css = `
      #role-switch{display:flex; gap:6px; align-items:center}
      #theme-switch{display:flex; gap:6px; align-items:center}
      .role-btn{padding:.4rem .7rem}
      .section-header h2{margin:0 0 4px}
      .section-header .muted{color:var(--muted); margin-bottom:12px}
      .grid{display:grid; gap:12px; grid-template-columns:repeat(auto-fit,minmax(240px,1fr));}
      .card{padding:12px}
      .card h3{margin:0 0 6px}
      .loading-message{padding: 40px; text-align: center; color: #86868b; font-size: 15px;}
      @keyframes slideInUp {
        from { transform: translateY(10px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }
      @keyframes slideInDown {
        from { transform: translateY(-10px); opacity: 1; }
        to { transform: translateY(0); opacity: 0; }
      }
    `;
    document.head.appendChild(el('style', { textContent: css }));
  };
})();
injectOnce();

// Expose globally for debugging
window.STATE = STATE;
window.ANALYSIS = ANALYSIS;
window.STORIES_DATA = STORIES_DATA;
window.CONFLICTS_DATA = CONFLICTS_DATA;
window.ENFORCEMENT_RESULTS = ENFORCEMENT_RESULTS;
window.toast = toast;
window.updateAnalyzeButton = updateAnalyzeButton;