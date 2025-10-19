// ui/src/controllers/analyzeCsv.js
import { openModal, buildForm } from '../ui/components/modal.js';
import { analyzeFromCsv } from '../api/endpoints.js';

/**
 * Opens an "Analyze CSV" form, calls the backend, and emits:
 *   window.dispatchEvent(new CustomEvent('analysis:loaded', { detail: { source:'CSV', data } }));
 *
 * UX notes:
 * - Minimal validation: Deployment CSV is required; Production CSV optional.
 * - Shows a temporary "Analyzing..." state in the Overview panel.
 * - On error, renders a friendly message with details.
 */
export async function openAnalyzeCsvFlow() {
  // 1) Build the form UI
  const form = buildForm([
    { type:'file', name:'file', label:'CSV Export', accept:'.csv', required:true },
  ]);
  

  // 2) Open the modal and wait for a user action
  const modal = openModal({
    title: 'Analyze CSV',
    content: form,
    actions: [
      { label:'Cancel',  action:'cancel' },
      { label:'Analyze', action:'submit', variant:'primary' },
    ],
  });

  const result = await modal; // { action: 'cancel' | 'submit' }

  if (result.action !== 'submit') return; // user cancelled

  // 3) Read files from the form (we still have the form reference)
  const fileInput = form.querySelector('input[name="file"]');
  const csvFile = fileInput?.files?.[0] || null;

  if (!csvFile) {
    showError('Please select a Deployment CSV to continue.');
    return;
  }

  // 4) Show a lightweight "Analyzing..." state in the Overview panel
  const overview = document.getElementById('tab-overview');
  if (overview) {
    overview.innerHTML = `
      <div class="card">
        <h3>Analyzing…</h3>
        <div class="muted">Uploading CSV and running comparison on the server.</div>
      </div>
    `;
  }

  // 5) Call the backend (new API, normalized output)
  let data;
  try {
    data = await analyzeFromCsv({ file: csvFile });
  } catch (err) {
    // Friendly error surface
    renderAnalyzeError(err);
    return;
  }

  // 6) Stash for dev convenience and notify the app
  window.__analysis = data; // dev-only convenience
  window.dispatchEvent(new CustomEvent('analysis:loaded', { detail: { source: 'CSV', data } }));

  // 7) Render a tiny summary immediately (so users see success even before other tabs)
  renderOverviewSummary(data);
}

/* ---------- helpers ---------- */

function showError(msg) {
  // Minimal toast fallback (keeps this controller self-contained)
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
        <h3>Analysis failed</h3>
        <div class="muted">We couldn’t complete the CSV analysis. Please check your files and try again.</div>
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
  showError(err?.message || 'Analysis failed');
}

function renderOverviewSummary(data) {
  const panel = document.getElementById('tab-overview');
  if (!panel) return;

  const s = data?.summary || {};
  const n = (v) => (typeof v === 'number' ? v : 0);

  panel.innerHTML = `
    <div class="section-header">
      <h2>Results</h2>
      <div class="muted">Source: <b>CSV</b></div>
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
