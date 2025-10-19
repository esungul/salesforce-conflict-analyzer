// ui/src/main.js
import { CONFIG, applyHeaderBadges, debugLog } from './config.js';
import { openAnalyzeCsvFlow } from './controllers/analyzeCsv.js';
import { openAnalyzeOnlineFlow } from './controllers/analyzeOnline.js';
import { renderStoriesTab }   from './ui/tabs/stories.js';
import { renderConflictsTab } from './ui/tabs/conflicts.js';
import { renderEnforcementTab } from './ui/tabs/enforcement.js';


/* ---------- tiny DOM helpers ---------- */
const $  = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
function el(tag, props={}, children=[]) {
  const node = Object.assign(document.createElement(tag), props);
  children.forEach(c => node.append(c));
  return node;
}

/* ---------- state ---------- */
const STATE = {
  role: localStorage.getItem('ui.role') || 'Developer', // 'Developer' | 'DevOps'
  source: '—', // 'CSV' | 'Live (SF)' | '—'
};
let ANALYSIS = null; // latest normalized analysis payload

/* ---------- boot ---------- */
document.addEventListener('DOMContentLoaded', () => {
  applyHeaderBadges();
  mountRoleSwitcher();
  mountThemeSwitcher();
  wireAnalyzeMenu();
  wireTabs();
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

/* ---------- analyze menu ---------- */
function wireAnalyzeMenu() {
  const trigger = $('#analyze-trigger');
  const menu = $('#analyze-menu');
  if (!trigger || !menu) return;

  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = menu.getAttribute('aria-hidden') === 'false';
    menu.setAttribute('aria-hidden', open ? 'true' : 'false');
    trigger.setAttribute('aria-expanded', open ? 'false' : 'true');
  });

  document.addEventListener('click', () => {
    menu.setAttribute('aria-hidden', 'true');
    trigger.setAttribute('aria-expanded', 'false');
  });

  menu.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;

    if (action === 'analyze-csv') {
      await openAnalyzeCsvFlow();
    } else if (action === 'analyze-online') {
      await openAnalyzeOnlineFlow();
    }
  });
}

function updateSourceBadge() {
  const sourceEl = document.getElementById('source-badge');
  if (sourceEl) sourceEl.textContent = `Source: ${STATE.source}`;
}

/* ---------- tabs ---------- */
function wireTabs() {
  const buttons = $$('.tab-button');
  const panels  = $$('.tab-panel');
  if (!buttons.length || !panels.length) return;

  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;

      // aria states
      buttons.forEach(b => b.setAttribute('aria-selected', b === btn ? 'true' : 'false'));
      panels.forEach(p => p.toggleAttribute('hidden', p.id !== `tab-${tab}`));

      // render per-tab content
      if (tab === 'overview')  renderOverviewLanding();
      if (tab === 'stories')   renderStoriesTab(ANALYSIS || {});
      if (tab === 'conflicts') renderConflictsTab(ANALYSIS || {});
      if (tab === 'enforcement') renderEnforcementTab(ANALYSIS || {});
    });
  });
}

/* ---------- listen for analysis results ---------- */
function wireAnalysisEvents() {
  window.addEventListener('analysis:loaded', (ev) => {
    const { source, data } = ev.detail || {};
    ANALYSIS = data;
    STATE.source = source || STATE.source || '—';
    updateSourceBadge();
    toast(`Analysis loaded from ${STATE.source}.`);
    selectTab('overview');
    debugLog('analysis:loaded', { source: STATE.source, data });

  });
}

function selectTab(name) {
  const btn = $(`.tab-button[data-tab="${name}"]`);
  if (!btn) return;
  btn.click();
}

function updateTabBadges(analysis){
  const sum = analysis?.summary || {};
  const stories = Number(sum.stories || (analysis?.all_stories?.length || 0));
  const conflicts = Number(sum.component_conflicts || (analysis?.conflicts?.length || analysis?.component_conflicts?.length || 0));
  // optional: enforcement & plan later
  setTabBadge('Safe Stories', stories);
  setTabBadge('Conflicts', conflicts);
}

function setTabBadge(tabName, count){
  const tab = [...document.querySelectorAll('.tabs a')].find(a => a.textContent.trim() === tabName);
  if (!tab) return;
  let badge = tab.querySelector('.tab-badge');
  if (!badge) {
    badge = document.createElement('span');
    badge.className = 'tab-badge';
    tab.appendChild(badge);
  }
  badge.textContent = String(count);
  badge.style.display = count ? 'inline-flex' : 'none';
}

// when analysis arrives, re-render the active tab
document.addEventListener('analysis:loaded', (e) => {
  ANALYSIS = e.detail?.analysis || ANALYSIS;
  const activeBtn = document.querySelector('.tab-button.active');
  const activeKey = activeBtn?.dataset.tab || 'stories';
  if (activeKey === 'stories')     renderStoriesTab(ANALYSIS || {});
  if (activeKey === 'conflicts')   renderConflictsTab(ANALYSIS || {});
  if (activeKey === 'enforcement') renderEnforcementTab(ANALYSIS || {});
});



/* ---------- landing content ---------- */
function renderOverviewLanding() {
  const panel = $('#tab-overview');
  if (!panel) return;

  const role = STATE.role;
  const roleCopy = role === 'Developer'
    ? 'Compare UAT vs Prod, review diffs, resolve conflicts, and generate a deployment-ready plan.'
    : 'Validate Production Regression Guard, review blocked items, and approve a safe deployment sequence.';

  panel.innerHTML = '';
  panel.append(
    sectionHeader('Welcome', `${role} workspace`),
    grid(
      card('Get Started', `
        • Choose <b>Analyze CSV</b> to upload your export CSV (single file).<br/>
        • Or choose <b>Analyze Online</b> to fetch live metadata (Salesforce).<br/>
        • Your current source: <b>${STATE.source}</b>.
      `),
      card('Your Focus', roleCopy),
      card('Next Actions', `
        1) Run <b>Analyze</b><br/>
        2) Open <b>Conflicts</b> to resolve items<br/>
        3) Review <b>Enforcement</b> (Regression Guard)<br/>
        4) Generate <b>Plan</b> and export
      `)
    ),
  );
}

/* ---------- tiny UI helpers ---------- */
function sectionHeader(title, subtitle='') {
  const wrap = el('div', { className: 'section-header' });
  wrap.append(
    el('h2', { textContent: title }),
    subtitle ? el('div', { className: 'muted', innerHTML: subtitle }) : ''
  );
  return wrap;
}

function card(title, html) {
  const c = el('div', { className: 'card' });
  c.append(
    el('h3', { textContent: title }),
    el('div', { innerHTML: html })
  );
  return c;
}
function grid(...children) {
  const g = el('div', { className: 'grid' });
  children.forEach(ch => g.append(ch));
  return g;
}

function toast(msg) {
  const region = $('#toast-region');
  if (!region) return alert(msg);
  const t = el('div', { className: 'toast', textContent: msg });
  region.append(t);
  setTimeout(() => t.remove(), 2500);
}

function mountThemeSwitcher() {
  // Avoid duplicate
  if (document.getElementById('theme-switch')) return;
  const header = document.querySelector('#app-header .env');
  if (!header) return;

  const wrap = el('div', { id:'theme-switch', className:'role-switch', role:'group', ariaLabel:'Select theme' });
  const themes = ['Midnight','Quartz']; // Midnight = default (dark), Quartz = light
  const btns = themes.map(t => el('button', { className:'btn role-btn', type:'button', textContent: t }));

  const apply = (name) => {
    const value = (name === 'Quartz') ? 'quartz' : '';
    document.documentElement.dataset.theme = value;
    localStorage.setItem('ui.theme', value || 'midnight');
    btns.forEach(b => b.classList.toggle('btn-primary', b.textContent === name));
  };

  btns[0].addEventListener('click', () => apply('Midnight'));
  btns[1].addEventListener('click', () => apply('Quartz'));

  wrap.append(...btns);
  header.parentElement.insertBefore(wrap, header.nextSibling);

  // restore persisted theme
  const saved = localStorage.getItem('ui.theme');
  apply(saved === 'quartz' ? 'Quartz' : 'Midnight');
}


/* ---------- minimal CSS hooks ---------- */
const injectOnce = (() => {
  let done = false;
  return () => {
    if (done) return; done = true;
    const css = `
      #role-switch{display:flex; gap:6px; align-items:center}
      .role-btn{padding:.4rem .7rem}
      .section-header h2{margin:0 0 4px}
      .section-header .muted{color:var(--muted); margin-bottom:12px}
      .grid{display:grid; gap:12px; grid-template-columns:repeat(auto-fit,minmax(240px,1fr));}
      .card{padding:12px}
      .card h3{margin:0 0 6px}
    `;
    document.head.appendChild(el('style', { textContent: css }));
  };
})();
injectOnce();
