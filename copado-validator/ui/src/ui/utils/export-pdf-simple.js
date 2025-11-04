// export-pdf-simple.js
// Drop-in, self-contained PDF exporter that mirrors the Preview layout.
// Public API: exportToPDF(reportData, analysis = {}, reportType = 'technical')

/* ------------------------------ Utilities ------------------------------ */

function escapeHtml(s) {
  if (s === null || s === undefined) return '';
  return String(s).replace(/&/g, '&amp;')
                  .replace(/</g, '&lt;')
                  .replace(/>/g, '&gt;');
}

function emptySummary() {
  return {
    totalStories: 0,
    blockedStories: 0,
    conflictStories: 0,
    safeStories: 0,
    safeWithCommitStories: 0,
    componentsWithConflicts: 0,
    componentConflicts: 0
  };
}

// Aligns older/newer shapes: technicalSummary -> summary and ensures arrays exist
function normalizeReportForExport(reportData) {
  if (!reportData || typeof reportData !== 'object') {
    return {
      title: 'Deployment Report',
      summary: emptySummary(),
      blockedStories: [],
      conflictStories: [],
      safeStories: [],
      safeWithCommitStories: [],
      componentConflicts: []
    };
  }
  if (reportData.summary && typeof reportData.summary === 'object') {
    return {
      ...reportData,
      blockedStories: reportData.blockedStories || [],
      conflictStories: reportData.conflictStories || [],
      safeStories: reportData.safeStories || [],
      safeWithCommitStories: reportData.safeWithCommitStories || [],
      componentConflicts: reportData.componentConflicts || []
    };
  }

  const ts = reportData.technicalSummary || {};
  const n = (arr) => Array.isArray(arr) ? arr.length : 0;
  const summary = {
    totalStories: Number.isFinite(ts.totalStories)
      ? ts.totalStories
      : n(reportData.blockedStories) + n(reportData.conflictStories) + n(reportData.safeStories) + n(reportData.safeWithCommitStories),
    blockedStories: Number.isFinite(ts.blockedStories) ? ts.blockedStories : n(reportData.blockedStories),
    conflictStories: Number.isFinite(ts.conflictStories) ? ts.conflictStories : n(reportData.conflictStories),
    safeStories: Number.isFinite(ts.safeStories) ? ts.safeStories : n(reportData.safeStories),
    safeWithCommitStories: Number.isFinite(ts.safeWithCommitStories) ? ts.safeWithCommitStories : n(reportData.safeWithCommitStories),
    componentsWithConflicts: Number.isFinite(ts.conflictedComponents)
      ? ts.conflictedComponents
      : n(reportData.componentConflicts),
    componentConflicts: Number.isFinite(ts.componentConflicts)
      ? ts.componentConflicts
      : n(reportData.componentConflicts),
  };

  return {
    ...reportData,
    summary,
    blockedStories: reportData.blockedStories || [],
    conflictStories: reportData.conflictStories || [],
    safeStories: reportData.safeStories || [],
    safeWithCommitStories: reportData.safeWithCommitStories || [],
    componentConflicts: reportData.componentConflicts || []
  };
}

function getAnalysisTime(analysis) {
  const raw = analysis?.summary?.analyzed_at || analysis?.analysis_time || analysis?.generated_at || analysis?.timestamp || null;
  try {
    const d = raw ? new Date(raw) : new Date();
    return isNaN(d) ? new Date().toISOString() : d.toISOString();
  } catch {
    return new Date().toISOString();
  }
}

/**
 * Synthesize story-centric conflict list from componentConflicts when
 * reportData.conflictStories is missing or empty.
 */
function synthesizeConflictStoriesFromComponents(reportData) {
  const rows = Array.isArray(reportData.componentConflicts) ? reportData.componentConflicts : [];
  if (!rows.length) return [];

  const byStory = new Map();
  const storyIdRe = /US-\d{6,}/g;

  for (const comp of rows) {
    const compName = comp?.componentName || 'Unknown';
    const involved = String(comp?.involvedStories || '');
    const ids = involved.match(storyIdRe) || [];
    const latestId = (String(comp?.latestStory || '').match(storyIdRe) || [null])[0];

    ids.forEach(id => {
      if (!byStory.has(id)) {
        byStory.set(id, {
          story_id: id,
          developer: 'Unknown',
          conflict_components: [],
          conflicting_with: new Set(),
          resolution_status: 'Potential Conflict',
          has_deployment_task: false
        });
      }
      const entry = byStory.get(id);
      entry.conflict_components.push(compName);
      ids.forEach(other => { if (other !== id) entry.conflicting_with.add(other); });
      if (latestId && latestId === id) entry.resolution_status = 'Latest Commit (primary)';
    });
  }

  // try to backfill developer from other buckets
  const devIndex = new Map();
  for (const bucket of [
    reportData.safeWithCommitStories, reportData.safeStories,
    reportData.blockedStories, reportData.conflictStories
  ]) {
    (Array.isArray(bucket) ? bucket : []).forEach(s => {
      if (s.story_id && s.developer) devIndex.set(s.story_id, s.developer);
    });
  }

  const result = [];
  for (const v of byStory.values()) {
    v.developer = devIndex.get(v.story_id) || v.developer;
    v.conflicting_with = Array.from(v.conflicting_with);
    result.push(v);
  }
  result.sort((a,b) => (b.conflicting_with.length - a.conflicting_with.length) || (a.story_id.localeCompare(b.story_id)));
  return result;
}

/* ------------------------------ Section builders ------------------------------ */

function buildHeaderHTML(reportData, analysis, reportType) {
  const title = escapeHtml(reportData.title || 'Technical Analysis Report - Component Health');
  const generatedAt = escapeHtml(reportData.generatedAt || new Date().toLocaleString());
  const type = escapeHtml((reportType || reportData.type || 'Technical Analysis'));
  const analysisTime = escapeHtml(getAnalysisTime(analysis));

  return `
  <header class="titlebar">
    <h1 class="title">${title}</h1>
    <div class="meta">
      <span><strong>Generated:</strong> ${generatedAt}</span>
      <span><strong>Type:</strong> ${type}</span>
      <span><strong>Analysis Time:</strong> ${analysisTime}</span>
    </div>
    <div class="divider"></div>
    <h2 class="section-lead">Technical Analysis - All Story Types</h2>
  </header>`;
}

function buildKPIHTML(summary) {
  const s = summary || emptySummary();
  return `
  <section class="kpi">
    <div class="kpi-grid">
      <div class="kpi-card total"><div class="val">${s.totalStories}</div><div class="lab">Total Stories</div></div>
      <div class="kpi-card blocked"><div class="val">${s.blockedStories}</div><div class="lab">Blocked Stories</div></div>
      <div class="kpi-card conflict"><div class="val">${s.conflictStories}</div><div class="lab">Conflict Stories</div></div>
      <div class="kpi-card safe"><div class="val">${s.safeStories}</div><div class="lab">Safe Stories</div></div>
      <div class="kpi-card safewc"><div class="val">${s.safeWithCommitStories}</div><div class="lab">Safe with Commit</div></div>
    </div>
  </section>`;
}

function buildComponentConflictsHTML(rows) {
  rows = Array.isArray(rows) ? rows : [];
  if (!rows.length) {
    return `<section class="section"><p class="nodata">No component conflicts found.</p></section>`;
  }
  return `
  <section class="section">
    <h2>Component Conflict Analysis (${rows.length} Unique Components)</h2>
    <div class="table-wrap">
      <table class="tbl">
        <colgroup>
          <col class="col-type"><col class="col-name"><col class="col-num"><col class="col-dev">
          <col class="col-story"><col class="col-dev2"><col class="col-date"><col class="col-hash"><col class="col-involved">
        </colgroup>
        <thead>
          <tr>
            <th>Component Type</th>
            <th>Component Name</th>
            <th>Unique Stories</th>
            <th>Developers</th>
            <th>Latest Story</th>
            <th>Latest Developer</th>
            <th>Latest Commit</th>
            <th>Commit Hash</th>
            <th>Involved Stories</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(r => `
            <tr>
              <td>${escapeHtml(r.componentType || 'N/A')}</td>
              <td>${escapeHtml(r.componentName || 'N/A')}</td>
              <td class="td-right">${Number.isFinite(r.uniqueStories) ? r.uniqueStories : 0}</td>
              <td>${escapeHtml(r.developers || 'N/A')}</td>
              <td>${escapeHtml(r.latestStory || 'N/A')}</td>
              <td>${escapeHtml(r.latestDeveloper || 'N/A')}</td>
              <td>${escapeHtml(r.latestCommitDate || 'N/A')}</td>
              <td class="td-mono">${escapeHtml(r.latestCommitHash || 'N/A')}</td>
              <td>${escapeHtml(r.involvedStories || 'N/A')}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>
  </section>`;
}

function buildConflictStoriesHTML(rows) {
  rows = Array.isArray(rows) ? rows : [];
  if (!rows.length) return `<section class="section"><h2>Conflict Stories (0)</h2><p class="nodata">No conflict stories found.</p></section>`;
  return `
  <section class="section">
    <h2>Conflict Stories (${rows.length})</h2>
    <div class="table-wrap">
      <table class="tbl">
        <thead>
          <tr>
            <th>Story ID</th>
            <th>Developer</th>
            <th>Conflict Components</th>
            <th>Resolution Status</th>
            <th>Conflicting With</th>
            <th>Deployment Task</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(s => `
            <tr>
              <td>${escapeHtml(s.story_id || 'N/A')}</td>
              <td>${escapeHtml(s.developer || 'Unknown')}</td>
              <td>${escapeHtml((s.conflict_components||[]).join(', ') || '—')}</td>
              <td>${escapeHtml(s.resolution_status || 'Potential Conflict')}</td>
              <td>${escapeHtml((s.conflicting_with||[]).join(', ') || '—')}</td>
              <td>${s.has_deployment_task ? 'Yes' : 'No'}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>
  </section>`;
}

function buildSafeStoriesHTML(rows) {
  rows = Array.isArray(rows) ? rows : [];
  return `
  <section class="section">
    <h2>Safe Stories (${rows.length})</h2>
    <div class="table-wrap">
      <table class="tbl">
        <thead>
          <tr>
            <th>Story ID</th>
            <th>Developer</th>
            <th>Component Count</th>
            <th>Latest Commit</th>
            <th>Deployment Task</th>
            <th>Task Type</th>
            <th>Timing</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(s => `
            <tr>
              <td>${escapeHtml(s.story_id || 'N/A')}</td>
              <td>${escapeHtml(s.developer || 'N/A')}</td>
              <td class="td-right">${Number.isFinite(s.component_count) ? s.component_count : 0}</td>
              <td>N/A</td>
              <td>${s.has_deployment_task ? 'Yes' : 'No'}</td>
              <td>${escapeHtml(s.task_type || 'N/A')}</td>
              <td>${escapeHtml(s.timing || 'N/A')}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>
  </section>`;
}

function buildSafeWithCommitHTML(rows) {
  rows = Array.isArray(rows) ? rows : [];
  return `
  <section class="section">
    <h2>Safe Stories with Commit (${rows.length})</h2>
    <div class="table-wrap">
      <table class="tbl">
        <thead>
          <tr>
            <th>Story ID</th>
            <th>Developer</th>
            <th>Component Count</th>
            <th>Latest Commit</th>
            <th>Deployment Task</th>
            <th>Task Type</th>
            <th>Timing</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(s => {
            const latest = (s.commit_date && s.commit_date !== 'N/A')
              ? `${(s.commit_hash && s.commit_hash !== 'N/A') ? (s.commit_hash.slice(0,8) + '…') : 'N/A'} · ${s.commit_date}`
              : 'N/A';
            return `
              <tr>
                <td>${escapeHtml(s.story_id || 'N/A')}</td>
                <td>${escapeHtml(s.developer || 'N/A')}</td>
                <td class="td-right">${Number.isFinite(s.component_count) ? s.component_count : 0}</td>
                <td class="td-mono">${escapeHtml(latest)}</td>
                <td>${s.has_deployment_task ? 'Yes' : 'No'}</td>
                <td>${escapeHtml(s.task_type || 'N/A')}</td>
                <td>${escapeHtml(s.timing || 'N/A')}</td>
              </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  </section>`;
}

/* ------------------------------ HTML builder ------------------------------ */

function buildPDFHtml(reportData, analysis, reportType) {
  const data = normalizeReportForExport(reportData);
  const header = buildHeaderHTML(data, analysis, reportType);
  const kpis = buildKPIHTML(data.summary);

  const synthesizedConflicts =
    (Array.isArray(data.conflictStories) && data.conflictStories.length)
      ? data.conflictStories
      : synthesizeConflictStoriesFromComponents(data);

  const comp = buildComponentConflictsHTML(data.componentConflicts);
  const conflicts = buildConflictStoriesHTML(synthesizedConflicts);
  const safe = buildSafeStoriesHTML(data.safeStories);
  const safec = buildSafeWithCommitHTML(data.safeWithCommitStories);
  const blocked = buildBlockedStoriesHTML(data.blockedStories);

  return `
<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(data.title || 'Deployment Report')}</title>
  <style>
    :root{
      --blue:#2a5da6; --blueDeep:#1f4fbf; --border:#dfe3ec; --muted:#555; --bg:#ffffff;
      --thead:#f5f7fb; --rowEven:#fbfcff;
    }
    *{ box-sizing:border-box; }
    html,body{ margin:0; padding:0; }
    body{ background:#f3f6fb; color:#111; font-family:Inter,system-ui,Segoe UI,Roboto,Arial,sans-serif; }

    .page{ max-width:1200px; margin:24px auto 36px; background:var(--bg);
           border:1px solid var(--border); border-radius:14px; padding:24px 24px 32px; }

    .titlebar{ text-align:center; }
    .title{ margin:.25rem 0; font-size:28px; font-weight:800; color:var(--blueDeep); }
    .meta{ display:flex; gap:16px; justify-content:center; flex-wrap:wrap; color:#444; margin-top:6px; }
    .divider{ height:3px; background:var(--blue); opacity:.35; margin:14px 0 10px; border-radius:2px; }
    .section-lead{ margin:0 0 12px; font-size:20px; color:#123; }

    .kpi{ margin:10px 0 18px; }
    .kpi-grid{ display:grid; grid-template-columns:repeat(5, 1fr); gap:12px; }
    .kpi-card{ border:1px solid var(--border); border-radius:14px; padding:14px; background:#fff;
               box-shadow:0 1px 2px rgba(0,0,0,.04), inset 0 2px 6px rgba(0,0,0,.03); text-align:center; }
    .kpi-card .val{ font-size:26px; font-weight:800; margin-bottom:4px; }
    .kpi-card .lab{ color:var(--muted); font-weight:600; font-size:14px; }
    .kpi-card.total{ background:linear-gradient(135deg, #1f4fbf, #1954a8); color:#fff; }
    .kpi-card.blocked{ background:#fff5f5; } .kpi-card.blocked .val{ color:#c62828; }
    .kpi-card.conflict{ background:#fff8ec; } .kpi-card.conflict .val{ color:#f57c00; }
    .kpi-card.safe{ background:#f0fbf3; } .kpi-card.safe .val{ color:#1b8a3e; }
    .kpi-card.safewc{ background:#f4f8ff; } .kpi-card.safewc .val{ color:#1f4fbf; }

    .section{ margin:20px 0; page-break-inside:avoid; }
    .section h2{ margin:0 0 10px; font-size:18px; color:#123; }
    .nodata{ color:#777; font-style:italic; }

    .table-wrap{ width:100%; overflow:auto; border:1px solid var(--border); border-radius:10px; background:#fff; }
    table.tbl{
      width:100%;
      border-collapse:collapse; /* crisp grid */
      table-layout:fixed;       /* consistent column widths */
      font-size:13px;
      min-width:1000px;
    }
    .tbl colgroup col.col-type{ width:140px }
    .tbl colgroup col.col-name{ width:320px }
    .tbl colgroup col.col-num{ width:120px }
    .tbl colgroup col.col-dev{ width:220px }
    .tbl colgroup col.col-story{ width:120px }
    .tbl colgroup col.col-dev2{ width:160px }
    .tbl colgroup col.col-date{ width:170px }
    .tbl colgroup col.col-hash{ width:140px }
    .tbl colgroup col.col-involved{ width:auto }

    .tbl thead th{
      background:var(--thead); color:#223;
      border:1px solid var(--border); padding:9px 10px; font-weight:700; text-align:left;
    }
    .tbl tbody td{
      border:1px solid var(--border);
      padding:8px 10px; vertical-align:top; color:#111;
      word-break:break-word;
    }
    .tbl tbody tr:nth-child(even){ background:var(--rowEven); }
    .td-right{ text-align:right; }
    .td-mono{ font-family:ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }

    thead{ display:table-header-group; }
    tfoot{ display:table-footer-group; }

    @page{ size:A4; margin:14mm 12mm; }
    @media print{
      body{ background:#fff; }
      .page{ border:none; margin:0; border-radius:0; }
      .table-wrap{ overflow:visible; }
      .kpi-grid{ grid-template-columns:repeat(5, 1fr); }
    }
  </style>
</head>
<body>
  <div class="page">
    ${header}
    ${kpis}
    ${comp}
    ${conflicts}
    ${safe}
    ${safec}
    ${blocked}
  </div>
  <script>
    setTimeout(() => { try { window.print(); } catch(e) {} }, 100);
  </script>
</body>
</html>`;
}

function buildBlockedStoriesHTML(rows) {
  rows = Array.isArray(rows) ? rows : [];
  if (!rows.length) return `<section class="section"><h2>Blocked Stories (0)</h2><p class="nodata">No blocked stories found.</p></section>`;
  return `
  <section class="section">
    <h2>Blocked Stories (${rows.length})</h2>
    <div class="table-wrap">
      <table class="tbl">
        <thead>
          <tr>
            <th>Story ID</th>
            <th>Developer</th>
            <th>Blocking Components</th>
            <th>Why Blocked (Reasons)</th>
            <th>Conflicting With</th>
            <th>Deployment Task</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(s => {
            const comps = (s.blocking_components || []).join(', ') || '—';
            const reasons = (s.blocking_reasons || []).join(' | ') || '—';
            const blockers = (s.production_blockers || [])
              .map(b => `${b.production_story_id || ''}${b.production_developer ? ' (' + b.production_developer + ')' : ''}`)
              .filter(Boolean)
              .join(', ') || '—';
            return `
              <tr>
                <td>${escapeHtml(s.story_id || 'N/A')}</td>
                <td>${escapeHtml(s.developer || 'N/A')}</td>
                <td>${escapeHtml(comps)}</td>
                <td>${escapeHtml(reasons)}</td>
                <td>${escapeHtml(blockers)}</td>
                <td>${s.has_deployment_task ? 'Yes' : 'No'}</td>
              </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  </section>`;
}

/* ------------------------------ Public API ------------------------------ */

// Popup-safe, non-throwing on popup block (falls back to hidden iframe)
export function exportToPDF(reportData, analysis = {}, reportType = 'technical') {
  try {
    const html = buildPDFHtml(reportData, analysis, reportType);

    // Try new window/tab first
    let win = null;
    try { win = window.open('', '_blank', 'noopener,noreferrer,width=1280,height=900'); } catch {}
    if (win && !win.closed) {
      try {
        win.document.open();
        win.document.write(html);
        win.document.close();
        return;
      } catch (e) {
        console.warn('PDF: popup write failed, falling back to iframe.', e);
      }
    }

    // Fallback: hidden iframe (no popup needed)
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.setAttribute('aria-hidden', 'true');
    document.body.appendChild(iframe);

    const idoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!idoc) throw new Error('No iframe document');
    idoc.open();
    idoc.write(html);
    idoc.close();

    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (e) {
        console.warn('PDF: iframe print failed; offering HTML download fallback.', e);
        const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = (reportData?.title || 'deployment-report') + '.html';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } finally {
        setTimeout(() => { try { document.body.removeChild(iframe); } catch {} }, 2000);
      }
    }, 200);
  } catch (err) {
    // Non-fatal: log only
    console.error('PDF export error:', err);
  }
}

export default { exportToPDF };
