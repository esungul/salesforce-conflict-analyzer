// ui/src/main.js
import { CONFIG, applyHeaderBadges, debugLog, API_URL } from './config.js';
import { openAnalyzeOnlineFlow } from './controllers/analyzeOnline.js';

// Import enhanced tab renderers
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
  wireAnalyzeMenuEnhanced();
  wireTabsEnhanced();
  wireAnalysisEvents();
  renderOverviewLanding();
  injectEnhancedProfessionalStyles();
  injectRoleBasedStyles();
  debugLog('boot', CONFIG);
});




function renderOverviewLanding() {
  const panel = $('#tab-overview');
  if (!panel) return;

  // Show role-specific landing pages
  if (STATE.role === 'Developer') {
    renderDeveloperOverview();
  } else {
    renderDevOpsOverview();
  }
}

function renderDeveloperOverview() {
  const panel = $('#tab-overview');
  if (!panel) return;

  panel.innerHTML = `
    <div class="landing-container">
      <!-- Developer Header -->
      <div class="hero-section">
        <div class="hero-content">
          <div class="hero-badge developer-badge">👨‍💻 Developer Workspace</div>
          <h1 class="hero-title">Component & Story Tracking</h1>
          <p class="hero-subtitle">Track user stories, review component history, and validate deployments</p>
          
          <div class="hero-stats">
            <div class="stat">
              <div class="stat-value">Zero</div>
              <div class="stat-label">Deployment Conflicts</div>
            </div>
            <div class="stat">
              <div class="stat-value">100%</div>
              <div class="stat-label">Compliance</div>
            </div>
            <div class="stat">
              <div class="stat-value">24/7</div>
              <div class="stat-label">Monitoring</div>
            </div>
          </div>

          <button id="hero-analyze-btn" class="cta-button">
            <span class="button-icon">📊</span>
            Start Analysis
            <span class="button-arrow">→</span>
          </button>
        </div>
        
        <div class="hero-visual">
          <div class="visual-card">
            <div class="card-header">
              <div class="card-dots">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
            <div class="card-content">
              <div class="app-icon">⚡</div>
              <div class="card-text">Developer Ready</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Quick Actions for Developer -->
      <div class="actions-section">
        <h2 class="section-title">Developer Tools</h2>
        <div class="actions-grid">
          <div class="action-card" data-action="track-stories">
            <div class="action-icon">📝</div>
            <h3>Track Stories</h3>
            <p>Monitor user story progress and status</p>
            <div class="action-arrow">→</div>
          </div>
          <div class="action-card" data-action="component-history">
            <div class="action-icon">🕒</div>
            <h3>Component History</h3>
            <p>Review deployment history and changes</p>
            <div class="action-arrow">→</div>
          </div>
          <div class="action-card" data-action="compare-diff">
            <div class="action-icon">🔍</div>
            <h3>Compare Changes</h3>
            <p>Compare components across environments</p>
            <div class="action-arrow">→</div>
          </div>
          <div class="action-card" data-action="validate-production">
            <div class="action-icon">✅</div>
            <h3>Validate Deployment</h3>
            <p>Check production readiness and conflicts</p>
            <div class="action-arrow">→</div>
          </div>
        </div>
      </div>

      <!-- Recent Activity for Developer -->
      <div class="features-section">
        <h2 class="section-title">Recent Activity</h2>
        <div class="activity-grid">
          <div class="activity-item">
            <div class="activity-icon">🚀</div>
            <div class="activity-content">
              <h4>US-12345 deployed</h4>
              <p>2 hours ago • 12 components</p>
            </div>
            <div class="activity-status success">Success</div>
          </div>
          <div class="activity-item">
            <div class="activity-icon">⚠️</div>
            <div class="activity-content">
              <h4>Conflict detected</h4>
              <p>4 hours ago • Requires review</p>
            </div>
            <div class="activity-status warning">Attention</div>
          </div>
          <div class="activity-item">
            <div class="activity-icon">📦</div>
            <div class="activity-content">
              <h4>Component updated</h4>
              <p>6 hours ago • AccountTrigger</p>
            </div>
            <div class="activity-status info">Updated</div>
          </div>
        </div>
      </div>
    </div>
  `;

  // Wire up developer buttons
  const heroBtn = document.getElementById('hero-analyze-btn');
  if (heroBtn) {
    heroBtn.addEventListener('click', () => openAnalyzeModal());
  }

  const actionCards = panel.querySelectorAll('.action-card');
  actionCards.forEach(card => {
    card.addEventListener('click', (e) => {
      const action = e.currentTarget.dataset.action;
      handleDeveloperAction(action);
    });
  });

  updateHeroButtonState();
  injectAllLandingStyles();
}

function renderDevOpsOverview() {
  const panel = $('#tab-overview');
  if (!panel) return;

  panel.innerHTML = `
    <div class="landing-container">
      <!-- DevOps Header -->
      <div class="hero-section">
        <div class="hero-content">
          <div class="hero-badge devops-badge">🔧 DevOps Control Center</div>
          <h1 class="hero-title">Deployment Operations</h1>
          <p class="hero-subtitle">Manage releases, monitor deployments, and ensure system stability</p>
          
          <div class="hero-stats">
            <div class="stat">
              <div class="stat-value">12</div>
              <div class="stat-label">Active Releases</div>
            </div>
            <div class="stat">
              <div class="stat-value">98%</div>
              <div class="stat-label">Success Rate</div>
            </div>
            <div class="stat">
              <div class="stat-value">45m</div>
              <div class="stat-label">Avg Deployment</div>
            </div>
            <div class="stat">
              <div class="stat-value">0</div>
              <div class="stat-label">Critical Issues</div>
            </div>
          </div>

          <button id="hero-analyze-btn" class="cta-button">
            <span class="button-icon">📊</span>
            Analyze Release
            <span class="button-arrow">→</span>
          </button>
        </div>
        
        <div class="hero-visual">
          <div class="visual-card">
            <div class="card-header">
              <div class="card-dots">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
            <div class="card-content">
              <div class="app-icon">🚀</div>
              <div class="card-text">Ops Ready</div>
            </div>
          </div>
        </div>
      </div>

      <!-- DevOps Actions -->
      <div class="actions-section">
        <h2 class="section-title">Operations Center</h2>
        <div class="actions-grid">
          <div class="action-card" data-action="release-planning">
            <div class="action-icon">📋</div>
            <h3>Release Planning</h3>
            <p>Plan and schedule deployment releases</p>
            <div class="action-arrow">→</div>
          </div>
          <div class="action-card" data-action="deployment-monitor">
            <div class="action-icon">📈</div>
            <h3>Deployment Monitor</h3>
            <p>Real-time deployment status and metrics</p>
            <div class="action-arrow">→</div>
          </div>
          <div class="action-card" data-action="compliance-check">
            <div class="action-icon">🛡️</div>
            <h3>Compliance Check</h3>
            <p>Validate deployment compliance and policies</p>
            <div class="action-arrow">→</div>
          </div>
          <div class="action-card" data-action="rollback-plan">
            <div class="action-icon">↩️</div>
            <h3>Rollback Plans</h3>
            <p>Manage emergency rollback procedures</p>
            <div class="action-arrow">→</div>
          </div>
        </div>
      </div>

      <!-- Deployment Pipeline -->
      <div class="features-section">
        <h2 class="section-title">Deployment Pipeline</h2>
        <div class="pipeline-grid">
          <div class="pipeline-stage active">
            <div class="stage-number">1</div>
            <div class="stage-info">
              <h4>Development</h4>
              <p>12 stories ready</p>
            </div>
          </div>
          <div class="pipeline-stage">
            <div class="stage-number">2</div>
            <div class="stage-info">
              <h4>Testing</h4>
              <p>QA in progress</p>
            </div>
          </div>
          <div class="pipeline-stage">
            <div class="stage-number">3</div>
            <div class="stage-info">
              <h4>Staging</h4>
              <p>Next: Feb 15</p>
            </div>
          </div>
          <div class="pipeline-stage">
            <div class="stage-number">4</div>
            <div class="stage-info">
              <h4>Production</h4>
              <p>Scheduled</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  // Wire up DevOps buttons
  const heroBtn = document.getElementById('hero-analyze-btn');
  if (heroBtn) {
    heroBtn.addEventListener('click', () => openAnalyzeModal());
  }

  const actionCards = panel.querySelectorAll('.action-card');
  actionCards.forEach(card => {
    card.addEventListener('click', (e) => {
      const action = e.currentTarget.dataset.action;
      handleDevOpsAction(action);
    });
  });

  updateHeroButtonState();
  injectAllLandingStyles();
}

function handleDeveloperAction(action) {
  switch(action) {
    case 'track-stories':
      const storiesBtn = document.querySelector('[data-tab="stories"]');
      if (storiesBtn) storiesBtn.click();
      break;
    case 'component-history':
      toast('Component history feature coming soon');
      break;
    case 'compare-diff':
      toast('Comparison tool coming soon');
      break;
    case 'validate-production':
      const enforcementBtn = document.querySelector('[data-tab="enforcement"]');
      if (enforcementBtn) enforcementBtn.click();
      break;
  }
}

function handleDevOpsAction(action) {
  switch(action) {
    case 'release-planning':
      const planBtn = document.querySelector('[data-tab="plan"]');
      if (planBtn) planBtn.click();
      break;
    case 'deployment-monitor':
      toast('Deployment monitor coming soon');
      break;
    case 'compliance-check':
      const decisionsBtn = document.querySelector('[data-tab="decisions"]');
      if (decisionsBtn) decisionsBtn.click();
      break;
    case 'rollback-plan':
      toast('Rollback planning coming soon');
      break;
  }
}




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
    
    // Update tab visibility and re-render overview
    updateTabVisibility();
    renderOverviewLanding();
  }
  
  devBtn.addEventListener('click', () => { STATE.role = 'Developer'; sync(); });
  opsBtn.addEventListener('click', () => { STATE.role = 'DevOps'; sync(); });

  wrap.append(devBtn, opsBtn);
  header.parentElement.insertBefore(wrap, header.nextSibling);
  sync();
}

function updateTabVisibility() {
  const tabs = {
    'overview': true, // Always visible
    'stories': STATE.role === 'Developer',
    'conflicts': STATE.role === 'Developer', 
    'enforcement': STATE.role === 'Developer',
    'decisions': STATE.role === 'DevOps',
    'plan': STATE.role === 'DevOps',
    'reports': true // Always visible
  };

  Object.keys(tabs).forEach(tab => {
    const tabBtn = document.querySelector(`[data-tab="${tab}"]`);
    if (tabBtn) {
      tabBtn.style.display = tabs[tab] ? 'flex' : 'none';
    }
  });
}

function injectAllLandingStyles() {
  if (document.querySelector('#all-landing-styles')) return;

  const style = document.createElement('style');
  style.id = 'all-landing-styles';
  style.textContent = `
    /* Base Landing Styles */
    .landing-container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 40px 20px;
    }

    .hero-section {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 60px;
      align-items: center;
      margin-bottom: 80px;
      padding: 40px 0;
    }

    .hero-content {
      padding-right: 20px;
    }

    .hero-badge {
      display: inline-block;
      color: white;
      padding: 8px 16px;
      border-radius: 20px;
      font-size: 0.875rem;
      font-weight: 600;
      margin-bottom: 20px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .developer-badge {
      background: linear-gradient(135deg, #0071e3, #0056b3);
    }

    .devops-badge {
      background: linear-gradient(135deg, #34C759, #2daa4d);
    }

    .hero-title {
      font-size: 2.5rem;
      font-weight: 700;
      margin: 0 0 16px;
      background: linear-gradient(135deg, #1d1d1f, #0071e3);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      line-height: 1.2;
    }

    .hero-subtitle {
      font-size: 1.125rem;
      color: #86868b;
      margin: 0 0 40px;
      line-height: 1.6;
    }

    .hero-stats {
      display: flex;
      gap: 40px;
      margin: 40px 0;
    }

    .stat {
      text-align: center;
    }

    .stat-value {
      font-size: 1.5rem;
      font-weight: 700;
      color: #0071e3;
      margin-bottom: 4px;
    }

    .stat-label {
      font-size: 0.875rem;
      color: #86868b;
      font-weight: 500;
    }

    .cta-button {
      background: linear-gradient(135deg, #0071e3, #0056b3);
      color: white;
      border: none;
      padding: 16px 32px;
      font-size: 1.125rem;
      font-weight: 600;
      border-radius: 12px;
      cursor: pointer;
      transition: all 0.3s ease;
      display: inline-flex;
      align-items: center;
      gap: 12px;
      box-shadow: 0 4px 16px rgba(0, 113, 227, 0.3);
    }

    .cta-button:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 8px 24px rgba(0, 113, 227, 0.4);
    }

    .cta-button:disabled {
      cursor: not-allowed;
      opacity: 0.7;
    }

    .button-icon {
      font-size: 1.25rem;
    }

    .button-arrow {
      font-size: 1.125rem;
      transition: transform 0.3s ease;
    }

    .cta-button:hover .button-arrow {
      transform: translateX(4px);
    }

    .hero-visual {
      display: flex;
      justify-content: center;
      align-items: center;
    }

    .visual-card {
      background: white;
      border-radius: 16px;
      padding: 24px;
      box-shadow: 
        0 8px 32px rgba(0, 0, 0, 0.1),
        0 2px 8px rgba(0, 0, 0, 0.08);
      border: 1px solid #e5e5e7;
      max-width: 280px;
      width: 100%;
    }

    .card-header {
      display: flex;
      justify-content: flex-start;
      margin-bottom: 20px;
    }

    .card-dots {
      display: flex;
      gap: 6px;
    }

    .card-dots span {
      width: 8px;
      height: 8px;
      border-radius: 50%;
    }

    .card-dots span:nth-child(1) { background: #ff3b30; }
    .card-dots span:nth-child(2) { background: #ff9500; }
    .card-dots span:nth-child(3) { background: #34c759; }

    .card-content {
      text-align: center;
      padding: 20px 0;
    }

    .app-icon {
      font-size: 3rem;
      margin-bottom: 16px;
      filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.1));
    }

    .card-text {
      font-size: 1rem;
      color: #1d1d1f;
      font-weight: 600;
    }

    .features-section {
      margin-bottom: 60px;
    }

    .section-title {
      font-size: 2rem;
      font-weight: 700;
      text-align: center;
      margin: 0 0 40px;
      color: #1d1d1f;
    }

    .actions-section {
      margin-bottom: 60px;
    }

    .actions-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 24px;
    }

    .action-card {
      background: white;
      border: 1px solid #e5e5e7;
      border-radius: 16px;
      padding: 30px;
      cursor: pointer;
      transition: all 0.3s ease;
      position: relative;
    }

    .action-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 12px 32px rgba(0, 0, 0, 0.1);
      border-color: #0071e3;
    }

    .action-icon {
      font-size: 2.5rem;
      margin-bottom: 16px;
    }

    .action-card h3 {
      font-size: 1.25rem;
      font-weight: 600;
      margin: 0 0 12px;
      color: #1d1d1f;
    }

    .action-card p {
      font-size: 0.875rem;
      color: #86868b;
      line-height: 1.6;
      margin: 0 0 20px;
    }

    .action-arrow {
      color: #0071e3;
      font-size: 1.25rem;
      font-weight: 600;
      transition: transform 0.3s ease;
    }

    .action-card:hover .action-arrow {
      transform: translateX(4px);
    }

    /* Developer Specific Styles */
    .activity-grid {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .activity-item {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 20px;
      background: white;
      border: 1px solid #e5e5e7;
      border-radius: 12px;
      transition: all 0.3s ease;
    }

    .activity-item:hover {
      border-color: #0071e3;
      transform: translateY(-2px);
    }

    .activity-icon {
      font-size: 1.5rem;
    }

    .activity-content {
      flex: 1;
    }

    .activity-content h4 {
      margin: 0 0 4px;
      font-size: 1rem;
      font-weight: 600;
      color: #1d1d1f;
    }

    .activity-content p {
      margin: 0;
      font-size: 0.875rem;
      color: #86868b;
    }

    .activity-status {
      padding: 6px 12px;
      border-radius: 20px;
      font-size: 0.75rem;
      font-weight: 600;
    }

    .activity-status.success {
      background: #d1f4e0;
      color: #2daa4d;
    }

    .activity-status.warning {
      background: #ffd4a3;
      color: #e68500;
    }

    .activity-status.info {
      background: #c7e2ff;
      color: #0071e3;
    }

    /* DevOps Specific Styles */
    .pipeline-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
    }

    .pipeline-stage {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 20px;
      background: white;
      border: 1px solid #e5e5e7;
      border-radius: 12px;
      transition: all 0.3s ease;
    }

    .pipeline-stage.active {
      background: #e8f0ff;
      border-color: #0071e3;
    }

    .pipeline-stage:hover {
      transform: translateY(-2px);
    }

    .stage-number {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: #0071e3;
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
      font-size: 0.875rem;
    }

    .pipeline-stage.active .stage-number {
      background: #0056b3;
    }

    .stage-info h4 {
      margin: 0 0 4px;
      font-size: 1rem;
      font-weight: 600;
      color: #1d1d1f;
    }

    .stage-info p {
      margin: 0;
      font-size: 0.875rem;
      color: #86868b;
    }

    /* Dark theme support */
    [data-theme="midnight"] .hero-title {
      background: linear-gradient(135deg, #ffffff, #90cdf4);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    [data-theme="midnight"] .visual-card,
    [data-theme="midnight"] .action-card,
    [data-theme="midnight"] .activity-item,
    [data-theme="midnight"] .pipeline-stage {
      background: #2d2d2f;
      border-color: #424245;
    }

    [data-theme="midnight"] .card-text,
    [data-theme="midnight"] .action-card h3,
    [data-theme="midnight"] .activity-content h4,
    [data-theme="midnight"] .stage-info h4,
    [data-theme="midnight"] .section-title {
      color: white;
    }

    [data-theme="midnight"] .pipeline-stage.active {
      background: #1e3a5f;
      border-color: #0071e3;
    }

    /* Responsive design */
    @media (max-width: 768px) {
      .landing-container {
        padding: 20px 16px;
      }

      .hero-section {
        grid-template-columns: 1fr;
        gap: 40px;
        margin-bottom: 60px;
        padding: 20px 0;
      }

      .hero-content {
        padding-right: 0;
        text-align: center;
      }

      .hero-title {
        font-size: 2rem;
      }

      .hero-stats {
        justify-content: center;
        gap: 30px;
      }

      .actions-grid,
      .pipeline-grid {
        grid-template-columns: 1fr;
      }

      .section-title {
        font-size: 1.75rem;
        margin-bottom: 30px;
      }
    }

    @media (max-width: 480px) {
      .hero-stats {
        gap: 20px;
      }

      .stat-value {
        font-size: 1.25rem;
      }

      .cta-button {
        width: 100%;
        justify-content: center;
      }
    }
  `;
  document.head.appendChild(style);
}


/* ---------- Role-Based Styles ---------- */
function injectRoleBasedStyles() {
  if (document.querySelector('#role-based-styles')) return;

  const style = document.createElement('style');
  style.id = 'role-based-styles';
  style.textContent = `
    /* Role-specific badges */
    .developer-badge {
      background: linear-gradient(135deg, #0071e3, #0056b3);
    }

    .devops-badge {
      background: linear-gradient(135deg, #34C759, #2daa4d);
    }

    /* Activity Grid for Developer */
    .activity-grid {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .activity-item {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 20px;
      background: white;
      border: 1px solid #e5e5e7;
      border-radius: 12px;
      transition: all 0.3s ease;
    }

    .activity-item:hover {
      border-color: #0071e3;
      transform: translateY(-2px);
    }

    .activity-icon {
      font-size: 1.5rem;
    }

    .activity-content {
      flex: 1;
    }

    .activity-content h4 {
      margin: 0 0 4px;
      font-size: 1rem;
      font-weight: 600;
      color: #1d1d1f;
    }

    .activity-content p {
      margin: 0;
      font-size: 0.875rem;
      color: #86868b;
    }

    .activity-status {
      padding: 6px 12px;
      border-radius: 20px;
      font-size: 0.75rem;
      font-weight: 600;
    }

    .activity-status.success {
      background: #d1f4e0;
      color: #2daa4d;
    }

    .activity-status.warning {
      background: #ffd4a3;
      color: #e68500;
    }

    .activity-status.info {
      background: #c7e2ff;
      color: #0071e3;
    }

    /* Pipeline Grid for DevOps */
    .pipeline-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
    }

    .pipeline-stage {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 20px;
      background: white;
      border: 1px solid #e5e5e7;
      border-radius: 12px;
      transition: all 0.3s ease;
    }

    .pipeline-stage.active {
      background: #e8f0ff;
      border-color: #0071e3;
    }

    .pipeline-stage:hover {
      transform: translateY(-2px);
    }

    .stage-number {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: #0071e3;
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
      font-size: 0.875rem;
    }

    .pipeline-stage.active .stage-number {
      background: #0056b3;
    }

    .stage-info h4 {
      margin: 0 0 4px;
      font-size: 1rem;
      font-weight: 600;
      color: #1d1d1f;
    }

    .stage-info p {
      margin: 0;
      font-size: 0.875rem;
      color: #86868b;
    }

    /* Dark theme support */
    [data-theme="midnight"] .activity-item,
    [data-theme="midnight"] .pipeline-stage {
      background: #2d2d2f;
      border-color: #424245;
    }

    [data-theme="midnight"] .activity-content h4,
    [data-theme="midnight"] .stage-info h4 {
      color: white;
    }

    [data-theme="midnight"] .pipeline-stage.active {
      background: #1e3a5f;
      border-color: #0071e3;
    }

    /* Responsive design */
    @media (max-width: 768px) {
      .pipeline-grid {
        grid-template-columns: 1fr;
      }
      
      .activity-item {
        padding: 16px;
      }
    }
  `;
  document.head.appendChild(style);
}
/* ---------- FIXED: theme switcher ---------- */
function mountThemeSwitcher() {
  const header = $('#app-header .env');
  if (!header || $('#theme-switch')) return;

  const wrap = el('div', { id: 'theme-switch', className: 'theme-switch', role: 'group', ariaLabel: 'Select theme' });
  const btns = [
    el('button', { className: 'btn role-btn', type: 'button', textContent: 'Midnight' }),
    el('button', { className: 'btn role-btn', type: 'button', textContent: 'Quartz' })
  ];

  const applyTheme = (themeName) => {
    const isQuartz = themeName === 'Quartz';
    document.documentElement.setAttribute('data-theme', isQuartz ? 'quartz' : 'midnight');
    localStorage.setItem('ui.theme', isQuartz ? 'quartz' : 'midnight');
    
    // Update button states
    btns.forEach(btn => {
      btn.classList.toggle('btn-primary', btn.textContent === themeName);
    });
  };

  btns[0].addEventListener('click', () => applyTheme('Midnight'));
  btns[1].addEventListener('click', () => applyTheme('Quartz'));

  wrap.append(...btns);
  header.parentElement.insertBefore(wrap, header.nextSibling);

  // Initialize theme from localStorage or default to Midnight
  const savedTheme = localStorage.getItem('ui.theme');
  applyTheme(savedTheme === 'quartz' ? 'Quartz' : 'Midnight');
}

/* ---------- FIXED: analyze menu with proper modal ---------- */
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
    const isOpen = menu.getAttribute('aria-hidden') === 'false';
    menu.setAttribute('aria-hidden', isOpen ? 'true' : 'false');
    trigger.setAttribute('aria-expanded', isOpen ? 'false' : 'true');
  });

  document.addEventListener('click', () => {
    menu.setAttribute('aria-hidden', 'true');
    trigger.setAttribute('aria-expanded', 'false');
  });

  // CSV Analysis (keep disabled for now)
  const csvBtn = menu.querySelector('[data-action="analyze-csv"]');
  if (csvBtn) {
    csvBtn.addEventListener('click', () => {
      menu.setAttribute('aria-hidden', 'true');
      toast('CSV analysis is not available yet');
    });
  }

  // FIXED: Online Analysis with proper modal
  const onlineBtn = menu.querySelector('[data-action="analyze-online"]');
  if (onlineBtn) {
    onlineBtn.addEventListener('click', (e) => {
      menu.setAttribute('aria-hidden', 'true');
      openAnalyzeModal();
    });
  }
}

/* ---------- NEW: Centralized function to open analyze modal ---------- */
// In main.js - update the openAnalyzeModal function

// In main.js - ensure this function is clean

/* ---------- Update the analysis completion flow ---------- */
function openAnalyzeModal() {
  console.log('Opening analyze modal...');
  
  createAnalyzeModal({
    onSubmit: async (data) => {
      console.log('Starting analysis with:', data);
      
      try {
        STATE.isLocked = true;
        updateAnalyzeButton();
        
        // Show initial loading spinner
        showLoadingSpinner(true, 'Starting analysis...');
        await new Promise(resolve => setTimeout(resolve, 500));
        
        showLoadingSpinner(true, 'Connecting to Salesforce...');
        await new Promise(resolve => setTimeout(resolve, 800));
        
        showLoadingSpinner(true, 'Analyzing user stories...');
        
        const result = await openAnalyzeOnlineFlow({
          userStoryNames: data.userStoryNames,
          releaseNames: data.releaseNames
        });
        
        // Show completion state
        showLoadingSpinner(true, 'Analysis complete! Generating report...');
        await new Promise(resolve => setTimeout(resolve, 800));
        
        // Process the results
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
        
        console.log('Analysis complete:', ANALYSIS);
        
        // Show success state briefly then auto-close
        showLoadingSpinner(true, 'Analysis Complete!');
        
        // Add success styling
        const spinner = document.getElementById('global-loading-spinner');
        if (spinner) {
          const container = spinner.querySelector('.spinner-container');
          const spinnerEl = spinner.querySelector('.spinner');
          const progress = spinner.querySelector('.spinner-progress');
          
          if (container) container.classList.add('spinner-success');
          if (spinnerEl) {
            spinnerEl.style.border = '4px solid #34C759';
            spinnerEl.style.animation = 'none';
          }
          if (progress) {
            progress.style.background = '#34C759';
            progress.style.animation = 'none';
          }
        }
        
        // Auto-close after success message
        await new Promise(resolve => setTimeout(resolve, 1500));
        showLoadingSpinner(false);
        
        // Switch to overview tab to show results
        const overviewBtn = document.querySelector('[data-tab="overview"]');
        if (overviewBtn) overviewBtn.click();
        
        // Show a brief success toast
        toast('Analysis completed successfully!', 2000);
        
      } catch (err) {
        console.error('Analysis error:', err);
        
        // Show error state
        const spinner = document.getElementById('global-loading-spinner');
        if (spinner) {
          const container = spinner.querySelector('.spinner-container');
          const spinnerEl = spinner.querySelector('.spinner');
          const progress = spinner.querySelector('.spinner-progress');
          
          if (container) container.classList.add('spinner-error');
          if (spinnerEl) {
            spinnerEl.style.border = '4px solid #FF3B30';
            spinnerEl.style.animation = 'none';
          }
          if (progress) {
            progress.style.background = '#FF3B30';
            progress.style.animation = 'none';
          }
        }
        
        showLoadingSpinner(true, `Error: ${err.message}`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        showLoadingSpinner(false);
        
        toast(`Analysis failed: ${err.message}`);
        
      } finally {
        STATE.isLocked = false;
        updateAnalyzeButton();
      }
    },
    onCancel: () => {
      console.log('User cancelled analysis');
    }
  });
}


async function startAnalysis(data) {
  try {
    STATE.isLocked = true;
    updateAnalyzeButton();
    showLoadingSpinner(true);
    toast('Analyzing stories...');
    
    const result = await openAnalyzeOnlineFlow({
      userStoryNames: data.userStoryNames,
      releaseNames: data.releaseNames
    });
    
    // Process results...
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
    
    console.log('Analysis complete:', ANALYSIS);
    toast('Analysis complete!');
    
    const overviewBtn = document.querySelector('[data-tab="overview"]');
    if (overviewBtn) overviewBtn.click();
    
  } catch (err) {
    console.error('Error:', err);
    toast(`Error: ${err.message}`);
  } finally {
    STATE.isLocked = false;
    updateAnalyzeButton();
    showLoadingSpinner(false);
  }
}

function showLoadingSpinner(show, message = 'Analyzing deployment data...') {
  let spinner = document.getElementById('global-loading-spinner');
  
  if (show && !spinner) {
    spinner = document.createElement('div');
    spinner.id = 'global-loading-spinner';
    spinner.innerHTML = `
      <div class="spinner-overlay">
        <div class="spinner-container">
          <div class="spinner"></div>
          <p class="spinner-message">${message}</p>
          <div class="spinner-progress"></div>
        </div>
      </div>
    `;
    document.body.appendChild(spinner);
    
    // Ensure spinner styles are injected
    if (!document.querySelector('#spinner-styles')) {
      injectSpinnerStyles();
    }
  } else if (show && spinner) {
    // Update existing spinner message and reset to loading state
    const messageEl = spinner.querySelector('.spinner-message');
    const container = spinner.querySelector('.spinner-container');
    const spinnerEl = spinner.querySelector('.spinner');
    const progress = spinner.querySelector('.spinner-progress');
    
    if (messageEl) messageEl.textContent = message;
    if (container) {
      container.classList.remove('spinner-success', 'spinner-error');
    }
    if (spinnerEl) {
      spinnerEl.style.border = '4px solid #f3f3f3';
      spinnerEl.style.borderTop = '4px solid #0071e3';
      spinnerEl.style.animation = 'spin 1s linear infinite';
    }
    if (progress) {
      progress.style.background = '#f3f3f3';
      progress.style.animation = 'progress 2s infinite ease-in-out';
    }
  } else if (!show && spinner) {
    // Fade out animation before removing
    spinner.style.opacity = '0';
    spinner.style.transition = 'opacity 0.3s ease';
    setTimeout(() => {
      if (spinner && spinner.parentNode) {
        spinner.parentNode.removeChild(spinner);
      }
    }, 300);
  }
}

function injectSpinnerStyles() {
  const style = document.createElement('style');
  style.id = 'spinner-styles';
  style.textContent = `
    .spinner-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.8);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      backdrop-filter: blur(8px);
    }
    
    .spinner-container {
      background: white;
      padding: 40px;
      border-radius: 16px;
      text-align: center;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      min-width: 300px;
      animation: scaleIn 0.3s ease;
    }

    @keyframes scaleIn {
      from { transform: scale(0.9); opacity: 0; }
      to { transform: scale(1); opacity: 1; }
    }
    
    .spinner {
      width: 50px;
      height: 50px;
      border: 4px solid #f3f3f3;
      border-top: 4px solid #0071e3;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto 20px;
    }
    
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    
    .spinner-message {
      margin: 0 0 15px;
      color: #1d1d1f;
      font-size: 16px;
      font-weight: 600;
      line-height: 1.4;
    }
    
    .spinner-progress {
      height: 4px;
      background: #f3f3f3;
      border-radius: 2px;
      overflow: hidden;
      position: relative;
    }
    
    .spinner-progress::after {
      content: '';
      position: absolute;
      top: 0;
      left: -100%;
      width: 100%;
      height: 100%;
      background: #0071e3;
      animation: progress 2s infinite ease-in-out;
    }
    
    @keyframes progress {
      0% { left: -100%; }
      100% { left: 100%; }
    }

    /* Success state */
    .spinner-success .spinner {
      border: 4px solid #34C759;
      border-top: 4px solid #34C759;
      animation: none;
      position: relative;
    }
    
    .spinner-success .spinner::before {
      content: '✓';
      display: block;
      color: #34C759;
      font-size: 24px;
      line-height: 42px;
      text-align: center;
    }
    
    .spinner-success .spinner-progress {
      background: #34C759;
    }
    
    .spinner-success .spinner-progress::after {
      display: none;
    }

    /* Error state */
    .spinner-error .spinner {
      border: 4px solid #FF3B30;
      border-top: 4px solid #FF3B30;
      animation: none;
      position: relative;
    }
    
    .spinner-error .spinner::before {
      content: '✕';
      display: block;
      color: #FF3B30;
      font-size: 24px;
      line-height: 42px;
      text-align: center;
    }
    
    .spinner-error .spinner-progress {
      background: #FF3B30;
    }
    
    .spinner-error .spinner-progress::after {
      display: none;
    }

    /* Dark theme support */
    [data-theme="midnight"] .spinner-container {
      background: #2d2d2f;
    }
    
    [data-theme="midnight"] .spinner-message {
      color: white;
    }

    /* Fade out animation */
    .spinner-overlay.fade-out {
      opacity: 0;
      transition: opacity 0.3s ease;
    }
  `;
  document.head.appendChild(style);
}
/* ---------- wire tabs ---------- */
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


export function toast(message, duration = 3000) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toastEl = document.createElement('div');
  toastEl.className = 'toast';
  toastEl.textContent = message;
  toastEl.style.cssText = `
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: #1d1d1f;
    color: white;
    padding: 12px 24px;
    border-radius: 8px;
    font-size: 14px;
    z-index: 999;
    animation: slideInUp 0.3s ease;
    max-width: 400px;
    text-align: center;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
  `;

  document.body.appendChild(toastEl);

  setTimeout(() => {
    toastEl.style.animation = 'slideInDown 0.3s ease';
    setTimeout(() => toastEl.remove(), 300);
  }, duration);
}

/* ---------- Helper - Update Analyze Button State ---------- */
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

/* ---------- IMPROVED: Overview landing with direct modal integration ---------- */

function renderOverviewLandingtest() {
  const panel = $('#tab-overview');
  if (!panel) return;

  panel.innerHTML = `
    <div class="landing-container">
      <!-- Hero Section -->
      <div class="hero-section">
        <div class="hero-content">
          <div class="hero-badge">Salesforce DevOps</div>
          <h1 class="hero-title">Deployment Planner</h1>
          <p class="hero-subtitle">Intelligent analysis for conflict-free Salesforce deployments</p>
          
          <div class="hero-stats">
            <div class="stat">
              <div class="stat-value">Zero</div>
              <div class="stat-label">Deployment Conflicts</div>
            </div>
            <div class="stat">
              <div class="stat-value">100%</div>
              <div class="stat-label">Compliance</div>
            </div>
            <div class="stat">
              <div class="stat-value">24/7</div>
              <div class="stat-label">Monitoring</div>
            </div>
          </div>

          <button id="hero-analyze-btn" class="cta-button">
            <span class="button-icon">📊</span>
            Start Analysis
            <span class="button-arrow">→</span>
          </button>
        </div>
        
        <div class="hero-visual">
          <div class="visual-card">
            <div class="card-header">
              <div class="card-dots">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
            <div class="card-content">
              <div class="app-icon">⚡</div>
              <div class="card-text">Ready to Analyze</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Features Grid -->
      <div class="features-section">
        <h2 class="section-title">Why Choose Deployment Planner?</h2>
        <div class="features-grid">
          <div class="feature">
            <div class="feature-icon">🔍</div>
            <h3>Conflict Detection</h3>
            <p>Identify component conflicts before they impact your deployment</p>
          </div>
          <div class="feature">
            <div class="feature-icon">🛡️</div>
            <h3>Safety First</h3>
            <p>Comprehensive checks ensure deployment safety and compliance</p>
          </div>
          <div class="feature">
            <div class="feature-icon">🚀</div>
            <h3>Fast Analysis</h3>
            <p>Quick analysis of user stories and releases in seconds</p>
          </div>
          <div class="feature">
            <div class="feature-icon">📈</div>
            <h3>Smart Reporting</h3>
            <p>Detailed reports for stakeholders and deployment teams</p>
          </div>
        </div>
      </div>

      <!-- Quick Actions -->
      <div class="actions-section">
        <h2 class="section-title">Get Started</h2>
        <div class="actions-grid">
          <div class="action-card" data-action="analyze-stories">
            <div class="action-icon">📝</div>
            <h3>Analyze Stories</h3>
            <p>Check user stories for deployment readiness</p>
            <div class="action-arrow">→</div>
          </div>
          <div class="action-card" data-action="analyze-release">
            <div class="action-icon">🏷️</div>
            <h3>Analyze Release</h3>
            <p>Batch analysis by release name</p>
            <div class="action-arrow">→</div>
          </div>
          <div class="action-card" data-action="view-reports">
            <div class="action-icon">📊</div>
            <h3>View Reports</h3>
            <p>Access deployment analytics</p>
            <div class="action-arrow">→</div>
          </div>
        </div>
      </div>
    </div>
  `;

  // Wire up buttons
  const heroBtn = document.getElementById('hero-analyze-btn');
  if (heroBtn) {
    heroBtn.addEventListener('click', () => openAnalyzeModal());
  }

  const actionCards = panel.querySelectorAll('.action-card');
  actionCards.forEach(card => {
    card.addEventListener('click', (e) => {
      const action = e.currentTarget.dataset.action;
      switch(action) {
        case 'analyze-stories':
        case 'analyze-release':
          openAnalyzeModal();
          break;
        case 'view-reports':
          const reportsBtn = document.querySelector('[data-tab="reports"]');
          if (reportsBtn) reportsBtn.click();
          break;
      }
    });
  });

  updateHeroButtonState();
  injectCompactLandingStyles();
}

function injectCompactLandingStyles() {
  if (document.querySelector('#compact-landing-styles')) return;

  const style = document.createElement('style');
  style.id = 'compact-landing-styles';
  style.textContent = `
    .landing-container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 40px 20px;
    }

    /* Hero Section */
    .hero-section {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 60px;
      align-items: center;
      margin-bottom: 80px;
      padding: 40px 0;
    }

    .hero-content {
      padding-right: 20px;
    }

    .hero-badge {
      display: inline-block;
      background: linear-gradient(135deg, #0071e3, #0056b3);
      color: white;
      padding: 8px 16px;
      border-radius: 20px;
      font-size: 0.875rem;
      font-weight: 600;
      margin-bottom: 20px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .hero-title {
      font-size: 2.5rem;
      font-weight: 700;
      margin: 0 0 16px;
      background: linear-gradient(135deg, #1d1d1f, #0071e3);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      line-height: 1.2;
    }

    .hero-subtitle {
      font-size: 1.125rem;
      color: #86868b;
      margin: 0 0 40px;
      line-height: 1.6;
    }

    .hero-stats {
      display: flex;
      gap: 40px;
      margin: 40px 0;
    }

    .stat {
      text-align: center;
    }

    .stat-value {
      font-size: 1.5rem;
      font-weight: 700;
      color: #0071e3;
      margin-bottom: 4px;
    }

    .stat-label {
      font-size: 0.875rem;
      color: #86868b;
      font-weight: 500;
    }

    .cta-button {
      background: linear-gradient(135deg, #0071e3, #0056b3);
      color: white;
      border: none;
      padding: 16px 32px;
      font-size: 1.125rem;
      font-weight: 600;
      border-radius: 12px;
      cursor: pointer;
      transition: all 0.3s ease;
      display: inline-flex;
      align-items: center;
      gap: 12px;
      box-shadow: 0 4px 16px rgba(0, 113, 227, 0.3);
    }

    .cta-button:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 8px 24px rgba(0, 113, 227, 0.4);
    }

    .cta-button:disabled {
      cursor: not-allowed;
      opacity: 0.7;
    }

    .button-icon {
      font-size: 1.25rem;
    }

    .button-arrow {
      font-size: 1.125rem;
      transition: transform 0.3s ease;
    }

    .cta-button:hover .button-arrow {
      transform: translateX(4px);
    }

    /* Hero Visual */
    .hero-visual {
      display: flex;
      justify-content: center;
      align-items: center;
    }

    .visual-card {
      background: white;
      border-radius: 16px;
      padding: 24px;
      box-shadow: 
        0 8px 32px rgba(0, 0, 0, 0.1),
        0 2px 8px rgba(0, 0, 0, 0.08);
      border: 1px solid #e5e5e7;
      max-width: 280px;
      width: 100%;
    }

    .card-header {
      display: flex;
      justify-content: flex-start;
      margin-bottom: 20px;
    }

    .card-dots {
      display: flex;
      gap: 6px;
    }

    .card-dots span {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #d2d2d7;
    }

    .card-dots span:nth-child(1) { background: #ff3b30; }
    .card-dots span:nth-child(2) { background: #ff9500; }
    .card-dots span:nth-child(3) { background: #34c759; }

    .card-content {
      text-align: center;
      padding: 20px 0;
    }

    .app-icon {
      font-size: 3rem;
      margin-bottom: 16px;
      filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.1));
    }

    .card-text {
      font-size: 1rem;
      color: #1d1d1f;
      font-weight: 600;
    }

    /* Features Section */
    .features-section {
      margin-bottom: 80px;
    }

    .section-title {
      font-size: 2rem;
      font-weight: 700;
      text-align: center;
      margin: 0 0 50px;
      color: #1d1d1f;
    }

    .features-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 30px;
    }

    .feature {
      text-align: center;
      padding: 30px 20px;
      background: white;
      border-radius: 16px;
      border: 1px solid #e5e5e7;
      transition: all 0.3s ease;
    }

    .feature:hover {
      transform: translateY(-4px);
      box-shadow: 0 12px 32px rgba(0, 0, 0, 0.1);
      border-color: #0071e3;
    }

    .feature-icon {
      font-size: 2.5rem;
      margin-bottom: 20px;
    }

    .feature h3 {
      font-size: 1.25rem;
      font-weight: 600;
      margin: 0 0 12px;
      color: #1d1d1f;
    }

    .feature p {
      font-size: 0.875rem;
      color: #86868b;
      line-height: 1.6;
      margin: 0;
    }

    /* Actions Section */
    .actions-section {
      margin-bottom: 40px;
    }

    .actions-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 24px;
    }

    .action-card {
      background: white;
      border: 1px solid #e5e5e7;
      border-radius: 16px;
      padding: 30px;
      cursor: pointer;
      transition: all 0.3s ease;
      position: relative;
    }

    .action-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 12px 32px rgba(0, 0, 0, 0.1);
      border-color: #0071e3;
    }

    .action-icon {
      font-size: 2rem;
      margin-bottom: 16px;
    }

    .action-card h3 {
      font-size: 1.25rem;
      font-weight: 600;
      margin: 0 0 8px;
      color: #1d1d1f;
    }

    .action-card p {
      font-size: 0.875rem;
      color: #86868b;
      line-height: 1.6;
      margin: 0 0 20px;
    }

    .action-arrow {
      color: #0071e3;
      font-size: 1.25rem;
      font-weight: 600;
      transition: transform 0.3s ease;
    }

    .action-card:hover .action-arrow {
      transform: translateX(4px);
    }

    /* Dark Theme Support */
    [data-theme="midnight"] .hero-title {
      background: linear-gradient(135deg, #ffffff, #90cdf4);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    [data-theme="midnight"] .hero-subtitle,
    [data-theme="midnight"] .stat-label,
    [data-theme="midnight"] .feature p,
    [data-theme="midnight"] .action-card p {
      color: #a1a1a6;
    }

    [data-theme="midnight"] .visual-card,
    [data-theme="midnight"] .feature,
    [data-theme="midnight"] .action-card {
      background: #2d2d2f;
      border-color: #424245;
    }

    [data-theme="midnight"] .feature h3,
    [data-theme="midnight"] .action-card h3,
    [data-theme="midnight"] .section-title,
    [data-theme="midnight"] .card-text {
      color: white;
    }

    [data-theme="midnight"] .card-dots span {
      background: #515154;
    }

    /* Responsive Design */
    @media (max-width: 768px) {
      .landing-container {
        padding: 20px 16px;
      }

      .hero-section {
        grid-template-columns: 1fr;
        gap: 40px;
        margin-bottom: 60px;
        padding: 20px 0;
      }

      .hero-content {
        padding-right: 0;
        text-align: center;
      }

      .hero-title {
        font-size: 2rem;
      }

      .hero-stats {
        justify-content: center;
        gap: 30px;
      }

      .features-grid,
      .actions-grid {
        grid-template-columns: 1fr;
      }

      .section-title {
        font-size: 1.75rem;
        margin-bottom: 40px;
      }
    }

    @media (max-width: 480px) {
      .hero-stats {
        gap: 20px;
      }

      .stat-value {
        font-size: 1.25rem;
      }

      .cta-button {
        width: 100%;
        justify-content: center;
      }
    }
  `;
  document.head.appendChild(style);
}

function updateHeroButtonState() {
  const heroBtn = document.getElementById('hero-analyze-btn');
  if (!heroBtn) return;

  if (STATE.isLocked) {
    heroBtn.disabled = true;
    heroBtn.innerHTML = '<span class="cta-icon">⏳</span> Analysis in Progress...';
    heroBtn.style.opacity = '0.7';
  } else {
    heroBtn.disabled = false;
    heroBtn.innerHTML = '<span class="cta-icon">📊</span> Start New Analysis';
    heroBtn.style.opacity = '1';
  }
}


function injectOverviewLandingStyles() {
  if (document.querySelector('#overview-landing-styles')) return;
  
  const style = document.createElement('style');
  style.id = 'overview-landing-styles';
  style.textContent = `
    .overview-hero {
      text-align: center;
      padding: 60px 20px;
      max-width: 800px;
      margin: 0 auto;
    }
    
    .hero-icon {
      font-size: 64px;
      margin-bottom: 20px;
    }
    
    .overview-hero h1 {
      font-size: 32px;
      font-weight: 700;
      margin: 0 0 12px;
      background: linear-gradient(135deg, #1d1d1f, #0071e3);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    
    .hero-subtitle {
      font-size: 18px;
      color: #86868b;
      margin: 0 0 40px;
      line-height: 1.5;
    }
    
    .hero-features {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 20px;
      margin: 40px 0;
    }
    
    .feature-card {
      background: #f5f5f7;
      padding: 24px;
      border-radius: 12px;
      transition: all 0.3s ease;
    }
    
    .feature-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
    }
    
    .feature-icon {
      font-size: 32px;
      margin-bottom: 12px;
    }
    
    .feature-card h3 {
      margin: 0 0 8px;
      font-size: 16px;
      font-weight: 600;
      color: #1d1d1f;
    }
    
    .feature-card p {
      margin: 0;
      font-size: 13px;
      color: #86868b;
      line-height: 1.4;
    }
    
    .hero-actions {
      margin-top: 40px;
    }
    
    .btn-large {
      padding: 14px 28px;
      font-size: 16px;
      border-radius: 12px;
    }
    
    .hero-hint {
      margin: 12px 0 0;
      font-size: 13px;
      color: #86868b;
    }
    
    [data-theme="midnight"] .feature-card {
      background: rgba(255, 255, 255, 0.05);
    }
    
    [data-theme="midnight"] .overview-hero h1 {
      background: linear-gradient(135deg, #ffffff, #0071e3);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
  `;
  document.head.appendChild(style);
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

function injectEnhancedProfessionalStyles() {
  const style = document.createElement('style');
  style.textContent = `
    /* Enhanced professional styles with theme support */
    [data-theme="midnight"] {
      --bg-primary: #1d1d1f;
      --bg-secondary: #2d2d2f;
      --text-primary: #ffffff;
      --text-secondary: #a1a1a6;
      --border-color: #424245;
    }
    
    [data-theme="quartz"] {
      --bg-primary: #ffffff;
      --bg-secondary: #f5f5f7;
      --text-primary: #1d1d1f;
      --text-secondary: #86868b;
      --border-color: #d2d2d7;
    }

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
      background: var(--bg-primary);
      color: var(--text-primary);
      border: 1px solid var(--border-color);
    }
    
    .story-card:hover,
    .conflict-card:hover,
    .enforcement-card:hover {
      transform: translateY(-3px);
      box-shadow: 0 12px 32px rgba(0, 0, 0, 0.12);
      border-color: #0071e3;
    }
    
    /* Enhanced status badges */
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
    
    /* Enhanced buttons */
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
      color: white;
    }
    
    .btn-primary:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 8px 24px rgba(0, 113, 227, 0.4);
    }
    
    /* Enhanced topbar */
    .topbar {
      backdrop-filter: blur(20px);
      background: rgba(255, 255, 255, 0.92);
      border-bottom: 1px solid rgba(0, 0, 0, 0.1);
    }
    
    [data-theme="midnight"] .topbar {
      background: rgba(29, 29, 31, 0.92);
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }
    
    .brand {
      font-weight: 700;
      background: linear-gradient(135deg, #1d1d1f, #0071e3);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    
    [data-theme="midnight"] .brand {
      background: linear-gradient(135deg, #ffffff, #0071e3);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
  `;
  
  const existingStyle = document.getElementById('enhanced-professional-styles');
  if (existingStyle) existingStyle.remove();
  
  style.id = 'enhanced-professional-styles';
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