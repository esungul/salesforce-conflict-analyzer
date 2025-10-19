// ui/src/controllers/analyzeOnline.js
import { openModal } from '../ui/components/modal.js';
import { analyzeFromSalesforce } from '../api/endpoints.js';

/**
 * Online (Salesforce) analysis flow.
 * UX:
 *  - Require at least one of: Release Names OR User Story Names.
 *  - Optional: repo and branch.
 *  - Builds filters object and POSTs to /api/analyze-sf.
 *  - On success, dispatches `analysis:loaded` and renders a summary.
 */
export async function openAnalyzeOnlineFlow() {
  const form = buildOnlineForm();

  const modal = openModal({
    title: 'Analyze Online (Salesforce)',
    content: form,
    actions: [
      { label:'Cancel', action:'cancel' },
      { label:'Analyze', action:'submit', variant:'primary' },
    ],
  });

  const result = await modal;
  if (result.action !== 'submit') return;

  // Gather values
  const repo    = form.querySelector('input[name="repo"]')?.value.trim() || '';
  const branch  = form.querySelector('input[name="branch"]')?.value.trim() || '';
  const relRaw  = form.querySelector('textarea[name="releaseNames"]')?.value || '';
  const usRaw   = form.querySelector('textarea[name="userStoryNames"]')?.value || '';

  const releaseNames   = splitList(relRaw);
  const userStoryNames = splitList(usRaw);

  if (!releaseNames.length && !userStoryNames.length) {
    showError('Please provide at least one Release Name or one User Story Name.');
    return;
  }

  const filters = {};
  if (releaseNames.length)   filters.releaseNames   = releaseNames;
  if (userStoryNames.length) filters.userStoryNames = userStoryNames;

  // Show analyzing state
  const overview = document.getElementById('tab-overview');
  if (overview) {
    overview.innerHTML = `
      <div class="card">
        <h3>Analyzing live Salesforce…</h3>
        <div class="muted">Fetching metadata and running comparison on the server.</div>
      </div>
    `;
  }

  // Call backend
  let data;
  try {
    data = await analyzeFromSalesforce({ repo: repo || undefined, branch: branch || undefined, filters });
  } catch (err) {
    renderAnalyzeError(err);
    return;
  }

  // Dev convenience + app event
  window.__analysis = data;
  window.dispatchEvent(new CustomEvent('analysis:loaded', { detail: { source: 'Live (SF)', data } }));

  // Render quick summary
  renderOverviewSummary('Live (SF)', data);
}

/* ---------------- helpers ---------------- */

function buildOnlineForm() {
  const wrap = document.createElement('form');
  wrap.className = 'md-form';

  // Repo
  wrap.append(makeRow('Repo (optional)', input('text', { name:'repo', placeholder:'owner/repo or org alias' })));
  // Branch
  wrap.append(makeRow('Branch (optional)', input('text', { name:'branch', placeholder:'e.g. uatsfdc or main' })));
  // Release Names
  wrap.append(makeRow('Release Names', textarea({ name:'releaseNames', placeholder:'Comma or newline separated (e.g. RLS-2025-10, RLS-2025-09)' })));
  // User Story Names
  wrap.append(makeRow('User Story Names', textarea({ name:'userStoryNames', placeholder:'Comma or newline separated (e.g. US-12345, US-12346)' })));

  // Hint
  const hint = document.createElement('div');
  hint.className = 'muted';
  hint.style.marginTop = '6px';
  hint.innerHTML = 'Provide <b>Release Names</b> (single value) or <b>User Story Names</b> (one or many). Repo/Branch optional.';
  wrap.append(hint);

  // Ensure modal form styles apply
  injectFormCssOnce();
  return wrap;
}

function makeRow(labelText, fieldEl) {
  const row = document.createElement('label');
  row.className = 'md-row';
  const lab = document.createElement('div');
  lab.className = 'md-lab';
  lab.textContent = labelText;
  row.append(lab, fieldEl);
  return row;
}

function input(type, attrs={}) {
  const i = document.createElement('input');
  i.type = type;
  Object.assign(i, attrs);
  i.className = 'md-input';
  return i;
}

function textarea(attrs={}) {
  const t = document.createElement('textarea');
  t.rows = 4;
  Object.assign(t, attrs);
  t.className = 'md-textarea';
  return t;
}

function splitList(raw) {
  return (raw || '')
    .split(/[\n,;]+/g)
    .map(s => s.trim())
    .filter(Boolean);
}

function showError(msg) {
  const region = document.getElementById('toast-region');
  if (!region) return alert(msg);
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  region.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

function renderAnalyzeError(err) {
  const overview = document.getElementById('tab-overview');
  const safe = (x) => {
    try { return typeof x === 'string' ? x : JSON.stringify(x, null, 2); }
    catch { return String(x); }
  };
  if (overview) {
    overview.innerHTML = `
      <div class="card">
        <h3>Online analysis failed</h3>
        <div class="muted">We couldn’t complete the live analysis. Please adjust inputs and try again.</div>
        <details style="margin-top:8px">
          <summary>Error details</summary>
          <pre style="white-space:pre-wrap; background:#0f1530; padding:8px; border-radius:8px; border:1px solid rgba(255,255,255,.1)">
${safe(err?.message || err)}
${err?.status ? `\nStatus: ${err.status}` : ''}
${err?.url    ? `\nURL: ${err.url}`       : ''}
${err?.body   ? `\nBody: ${safe(err.body)}`: ''}
          </pre>
        </details>
      </div>
    `;
  }
  showError(err?.message || 'Online analysis failed');
}

function renderOverviewSummary(sourceLabel, data) {
  const panel = document.getElementById('tab-overview');
  if (!panel) return;

  const s = data?.summary || {};
  const n = (v) => (typeof v === 'number' ? v : 0);

  panel.innerHTML = `
    <div class="section-header">
      <h2>Results</h2>
      <div class="muted">Source: <b>${sourceLabel}</b></div>
    </div>

    <div class="grid">
      <div class="card">
        <h3>Total Stories</h3>
        <div style="font-size:24px; font-weight:700">${n(s.totalStories)}</div>
      </div>
      <div class="card">
        <h3>Conflicts</h3>
        <div class="badge badge-danger">${n(s.conflicts)} issues</div>
      </div>
      <div class="card">
        <h3>Regressions</h3>
        <div class="badge badge-warn">${n(s.regressions)} affected</div>
      </div>
      <div class="card">
        <h3>Blocked</h3>
        <div class="badge badge-warn">${n(s.blocked)} items</div>
      </div>
    </div>

    <div class="card" style="margin-top:12px">
      <h3>Next steps</h3>
      <ol>
        <li>Open <b>Conflicts</b> to resolve items.</li>
        <li>Review <b>Enforcement</b> for Regression Guard details.</li>
        <li>Go to <b>Plan</b> once conflicts are resolved.</li>
      </ol>
    </div>
  `;
}

/* Reuse modal form styles even though we built a custom form here */
let formCssInjected = false;
function injectFormCssOnce(){
  if (formCssInjected) return; formCssInjected = true;
  const css = `
  .md-form{ display:grid; gap:10px; }
  .md-row{ display:grid; grid-template-columns: 160px 1fr; align-items:center; gap:10px; }
  .md-lab{ color:var(--muted) }

  .md-row input,
  .md-row select,
  .md-row textarea{
    background: var(--elev);
    color: var(--text);
    border: 1px solid rgba(0,0,0,.25);
    border-color: rgba(255,255,255,.12);
    border-radius: 8px;
    padding: .55rem .6rem;
  }
  .md-row textarea{ min-height: 84px; resize: vertical; }
  .md-row input::placeholder,
  .md-row textarea::placeholder{ color: var(--muted); opacity:.9; }

  .md-row input:focus,
  .md-row select:focus,
  .md-row textarea:focus{
    outline: 2px solid transparent;
    box-shadow: 0 0 0 2px var(--brand);
    border-color: transparent;
  }

  :root[data-theme="quartz"] .md-row input,
  :root[data-theme="quartz"] .md-row select,
  :root[data-theme="quartz"] .md-row textarea{
    background:#fff;
    border-color: rgba(0,0,0,.12);
  }
  `;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
}

