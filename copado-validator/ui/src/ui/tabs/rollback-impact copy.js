// ui/src/ui/tabs/rollback-impact.js
// Complete, drop-in file — rollback decision + timelines + predictive search

export function renderRollbackImpactTab(analysis = {}) {
  var panel = document.querySelector('#tab-rollback-impact');
  if (!panel) {
    console.warn('Rollback panel not found: #tab-rollback-impact');
    return;
  }

  panel.innerHTML = '';
  console.log('[rollback-impact] Rendering rollback impact tab');
  console.log('[rollback-impact] Analysis input keys:', Object.keys(analysis || {}));

  // 🔁 Build indexes (id <-> story, component -> usages)
  buildLookupIndexes(analysis);

  var allStories = analysis.all_stories || [];
  var buckets = { 'Safe': [], 'Safe with commit': [], 'Blocked': [], 'Conflict': [] };
  for (var i = 0; i < allStories.length; i++) {
    var st = allStories[i];
    var classification = st.classification || st.classification_tag || st.copado_status || 'Unknown';
    if (buckets[classification]) buckets[classification].push(st);
  }

  var header = document.createElement('h2');
  header.textContent = 'Rollback Impact Analysis';
  panel.appendChild(header);

  // Summary chips
  var summary = document.createElement('div');
  summary.className = 'rollback-summary';
  summary.innerHTML = '' +
    '<span class="chip chip-safe">Safe: ' + buckets['Safe'].length + '</span>' +
    '<span class="chip chip-safewc">Safe w/ Commit: ' + buckets['Safe with commit'].length + '</span>' +
    '<span class="chip chip-conflict">Conflict: ' + buckets['Conflict'].length + '</span>' +
    '<span class="chip chip-blocked">Blocked: ' + buckets['Blocked'].length + '</span>';
  panel.appendChild(summary);

  // Predictive search support via <datalist>
  var datalistId = 'rb-suggest-list';
  var datalist = document.getElementById(datalistId);
  if (!datalist) {
    datalist = document.createElement('datalist');
    datalist.id = datalistId;
    document.body.appendChild(datalist);
  }
  refillSuggestions(datalist, analysis);

  // Search controls
  var controls = document.createElement('div');
  controls.className = 'rb-controls';
  controls.innerHTML =
    '<div class="rb-searchbar">' +
      '<label class="rb-label">Search by</label>' +
      '<select class="rb-mode" aria-label="Search mode">' +
        '<option value="story">User Story</option>' +
        '<option value="component">Component (Type:Name)</option>' +
      '</select>' +
      '<input list="' + datalistId + '" class="rb-query" type="text" placeholder="e.g. US-0033922 or IntegrationProcedure:PR_MultiLineGroupInfoIP" />' +
      '<button class="rb-go">Go</button>' +
      '<span class="rb-hint muted">Tip: start typing to see suggestions</span>' +
    '</div>';
  panel.appendChild(controls);

  var modeEl = controls.querySelector('.rb-mode');
  var qEl = controls.querySelector('.rb-query');
  var goEl = controls.querySelector('.rb-go');
  if (goEl) goEl.addEventListener('click', function () { handleSearch(analysis, modeEl.value, qEl.value); });
  if (qEl) qEl.addEventListener('keydown', function (e) { if (e.key === 'Enter') handleSearch(analysis, modeEl.value, qEl.value); });

  // Decision summary button (opens aggregated table)
  var decisionBtn = document.createElement('button');
  decisionBtn.className = 'rb-go';
  decisionBtn.textContent = 'Open Decision Summary';
  decisionBtn.addEventListener('click', function(){ openDecisionSummaryModal(analysis); });
  panel.appendChild(decisionBtn);

  // Render grouped stories with component breakdown and action buttons
  renderStoryBuckets(panel, buckets, analysis);

  if (allStories.length === 0) {
    var emptyMsg = document.createElement('p');
    emptyMsg.textContent = 'No stories found in analysis.';
    emptyMsg.style.color = 'gray';
    panel.appendChild(emptyMsg);
  }

  injectRollbackStyles();
}

// ---------------------- Rendering ----------------------
function renderStoryBuckets(panel, buckets, analysis) {
  var entries = Object.keys(buckets);
  for (var e = 0; e < entries.length; e++) {
    var status = entries[e];
    var stories = buckets[status];
    if (!stories || stories.length === 0) continue;

    var section = document.createElement('div');
    section.className = 'rollback-section';

    var title = document.createElement('h3');
    title.textContent = status + ' Stories (' + stories.length + ')';
    section.appendChild(title);

    var list = document.createElement('ul');
    list.className = 'rollback-list';

    for (var i = 0; i < stories.length; i++) {
      var story = stories[i];
      var sId = story.story_id || story.id || 'UnknownID';
      var sName = story.title || story.name || sId;

      var li = document.createElement('li');
      li.className = 'rb-story-item';

      var hdr = document.createElement('div');
      hdr.className = 'rb-story-header';
      hdr.innerHTML = '' +
        '<button class="rb-toggle" aria-expanded="false" title="Expand">▶</button>' +
        '<span class="rb-story-title">' + escapeHtml(sName) + ' <span class="muted">(' + escapeHtml(sId) + ')</span></span>' +
        '<span class="rb-badges"><span class="tag tag-' + cssStatus(status) + '">' + status + '</span></span>' +
        '<button class="rb-plan btn-light" data-story="' + escapeHtml(sId) + '">Rollback plan</button>';

      var details = document.createElement('div');
      details.className = 'rb-story-details hidden';

      var comps = story.components || story.Components || [];
      if (!comps.length) {
        details.innerHTML = '<div class="muted">No components listed for this story.</div>';
      } else {
        var compList = document.createElement('div');
        compList.className = 'rb-components';
        for (var c = 0; c < comps.length; c++) {
          var comp = comps[c];
          var cinfo = normalizeComponent(comp);
          if (!cinfo) continue;
          var key = cinfo.type + ':' + cinfo.name;
          var usage = (analysis.by_component_key && analysis.by_component_key[key]) || [];
          var risk = computeComponentRisk(cinfo, usage, sId);

          var row = document.createElement('div');
          row.className = 'rb-comp-row risk-' + risk.level + (risk.flags && risk.flags.prodAhead ? ' rb-prod-ahead' : '');
          row.innerHTML = '' +
            '<div class="rb-comp-id">' +
              '<span class="rb-comp-type">' + escapeHtml(cinfo.type) + '</span>: ' +
              '<span class="rb-comp-name">' + escapeHtml(cinfo.name) + '</span>' +
            '</div>' +
            '<div class="rb-comp-meta">' +
              (cinfo.commit_date ? '<span class="meta">Last: ' + fmtDate(cinfo.commit_date) + '</span>' : '') +
              (cinfo.production_commit_date ? '<span class="meta">Prod: ' + fmtDate(cinfo.production_commit_date) + '</span>' : '') +
              (cinfo.production_story_id ? '<span class="meta">via ' + escapeHtml(cinfo.production_story_id) + '</span>' : '') +
            '</div>' +
            '<div class="rb-comp-risk">' +
              '<span class="risk-badge level-' + risk.level + '">' + escapeHtml(risk.label) + '</span>' +
              (risk.flags && risk.flags.prodAhead ? '<span class="badge-prod-ahead">Prod &gt; Change</span>' : '') +
              '<button class="rb-timeline btn-link" data-compkey="' + escapeHtml(key) + '">Timeline</button>' +
            '</div>';
          compList.appendChild(row);
        }
        details.appendChild(compList);
      }

      var tbtn = hdr.querySelector('.rb-toggle');
      if (tbtn) tbtn.addEventListener('click', function (e) {
        var btn = e.currentTarget;
        var top = btn.parentElement;
        var det = top && top.nextElementSibling;
        var expanded = btn.getAttribute('aria-expanded') === 'true';
        btn.setAttribute('aria-expanded', String(!expanded));
        btn.textContent = expanded ? '▶' : '▼';
        if (det) det.classList.toggle('hidden');
      });

      // Story rollback plan button
      var planBtn = hdr.querySelector('.rb-plan');
      if (planBtn) planBtn.addEventListener('click', function (e) {
        var sid = e.currentTarget.getAttribute('data-story');
        openStoryPlanModal(sid, analysis);
      });

      // Delegate component timeline buttons after append
      li.appendChild(hdr);
      li.appendChild(details);
      list.appendChild(li);

      // After row is in DOM, bind timeline buttons
      var lastTimelineBtns = li.querySelectorAll('.rb-timeline');
      for (var t = 0; t < lastTimelineBtns.length; t++) {
        lastTimelineBtns[t].addEventListener('click', function (ev) {
          var key = ev.currentTarget.getAttribute('data-compkey');
          openComponentTimelineModal(key, analysis);
        });
      }
    }

    section.appendChild(list);
    panel.appendChild(section);
  }
}

// ---------------------- Search ----------------------
function handleSearch(analysis, mode, rawQuery) {
  var query = (rawQuery || '').trim();
  if (!query) return;

  if (mode === 'story') {
    var story = analysis.by_story_id && analysis.by_story_id[query];
    if (!story) { alert('User Story not found: ' + query); return; }
    // Expand and scroll
    var items = Array.from(document.querySelectorAll('.rb-story-header .rb-story-title'));
    var match = null;
    for (var i = 0; i < items.length; i++) {
      if (items[i].textContent && items[i].textContent.indexOf('(' + query + ')') !== -1) { match = items[i]; break; }
    }
    if (match) {
      var header = closest(match, 'rb-story-header');
      var btn = header ? header.querySelector('.rb-toggle') : null;
      var details = header ? header.nextElementSibling : null;
      if (btn && details && details.classList.contains('hidden')) { btn.click(); }
      if (header && header.scrollIntoView) header.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Also open a plan modal to guide rollback immediately
      openStoryPlanModal(query, analysis);
    } else {
      alert('Rendered item not found for story ' + query + '.');
    }
  } else {
    var usage = analysis.by_component_key && analysis.by_component_key[query];
    if (!usage || usage.length === 0) { alert('Component not found: ' + query); return; }
    openComponentTimelineModal(query, analysis);
  }
}

function refillSuggestions(datalist, analysis) {
  while (datalist.firstChild) datalist.removeChild(datalist.firstChild);
  var maxItems = 200; // cap suggestions
  var count = 0;
  // story ids
  var sids = Object.keys(analysis.by_story_id || {});
  for (var i = 0; i < sids.length && count < maxItems; i++) {
    var opt = document.createElement('option');
    opt.value = sids[i];
    datalist.appendChild(opt);
    count++;
  }
  // component keys
  var ckeys = Object.keys(analysis.by_component_key || {});
  for (var j = 0; j < ckeys.length && count < maxItems; j++) {
    var opt2 = document.createElement('option');
    opt2.value = ckeys[j];
    datalist.appendChild(opt2);
    count++;
  }
}

// ---------------------- Modals ----------------------
function ensureModalRoot() {
  var root = document.getElementById('rb-modal-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'rb-modal-root';
    document.body.appendChild(root);
  }
  return root;
}

function openModal(html) {
  var root = ensureModalRoot();
  root.style.display = 'block';
  root.innerHTML = '' +
    '<div class="rb-modal-overlay"></div>' +
    '<div class="rb-modal">' +
      '<button class="rb-modal-close" aria-label="Close">×</button>' +
      '<div class="rb-modal-body">' + html + '</div>' +
    '</div>';
  var overlay = root.querySelector('.rb-modal-overlay');
  var closeBtn = root.querySelector('.rb-modal-close');
  var close = function(){
    root.innerHTML = '';
    root.style.display = 'none';
  };
  if (overlay) overlay.addEventListener('click', close);
  if (closeBtn) closeBtn.addEventListener('click', close);

  // Prevent body scroll when modal is open
  document.body.style.overflow = 'hidden';

  // Restore scroll when closed
  var originalClose = close;
  close = function() {
    document.body.style.overflow = '';
    originalClose();
  };
  if (overlay) overlay.addEventListener('click', close);
  if (closeBtn) closeBtn.addEventListener('click', close);
}

// Component timeline modal
function openComponentTimelineModal(compKey, analysis) {
  var model = buildComponentTimeline(compKey, analysis);
  if (!model) { alert('No timeline available for ' + compKey); return; }
  var html = renderComponentTimelineHTML(model);
  openModal(html);
}

// Story rollback plan modal
function openStoryPlanModal(storyId, analysis) {
  var story = analysis.by_story_id && analysis.by_story_id[storyId];
  if (!story) { alert('Story not found: ' + storyId); return; }
  var plan = buildRollbackPlanForStory(story, analysis);
  var html = renderStoryPlanHTML(plan, analysis);
  openModal(html);
}

function openDecisionSummaryModal(analysis) {
  var rows = [];
  var sids = Object.keys(analysis.by_story_id || {});
  for (var i = 0; i < sids.length; i++) {
    var st = analysis.by_story_id[sids[i]];
    var plan = buildRollbackPlanForStory(st, analysis);
    rows.push(plan);
  }
  var html = renderDecisionSummaryHTML(rows, analysis);
  openModal(html);
}

// ---------------------- Builders ----------------------
function buildComponentTimeline(compKey, analysis) {
  var usage = analysis.by_component_key && analysis.by_component_key[compKey];
  if (!usage || usage.length === 0) return null;

  // Determine production baseline from any entry that carries prod lineage
  var prod = { have: false };
  for (var i = 0; i < usage.length; i++) {
    var u = usage[i];
    if (u.production_commit_date) {
      prod = {
        have: true,
        production_commit_date: u.production_commit_date,
        production_story_id: u.production_story_id || 'production',
        production_story_title: u.production_story_title || 'Production baseline'
      };
      break; // prefer first occurrence
    }
  }

  // sort by commit_date desc (latest first)
  var sorted = usage.slice().sort(function(a,b){
    var da = new Date(a.commit_date || 0).getTime();
    var db = new Date(b.commit_date || 0).getTime();
    return db - da;
  });

  return {
    key: compKey,
    production: prod,
    timeline: sorted // array of {story_id, story_name, classification, commit_date}
  };
}

function buildRollbackPlanForStory(story, analysis) {
  var sId = story.story_id || story.id;
  var comps = story.components || story.Components || [];
  var plan = [];
  var riskyCount = 0;

  for (var i = 0; i < comps.length; i++) {
    var comp = comps[i];
    var c = normalizeComponent(comp);
    if (!c) continue;
    var key = c.type + ':' + c.name;
    var usage = analysis.by_component_key && analysis.by_component_key[key] || [];
    var risk = computeComponentRisk(c, usage, sId);

    if (risk.level === 'low') continue; // no rollback needed

    riskyCount++;
    var rollback_to = null;
    var post_state_owner = null;

    if (c.production_commit_date) {
      rollback_to = { mode: 'prod', production_story_id: c.production_story_id, production_commit_date: c.production_commit_date };
      post_state_owner = c.production_story_id ? c.production_story_id : 'production';
    } else {
      var sorted = usage.slice().sort(function(a,b){
        var da = new Date(a.commit_date || 0).getTime();
        var db = new Date(b.commit_date || 0).getTime();
        return db - da;
      });
      var nextOwner = null;
      for (var j = 0; j < sorted.length; j++) { if (sorted[j].story_id !== sId) { nextOwner = sorted[j]; break; } }
      if (nextOwner) {
        rollback_to = { mode: 'previous_story', story_id: nextOwner.story_id, commit_date: nextOwner.commit_date };
        post_state_owner = nextOwner.story_id;
      }
    }

    plan.push({
      key: key,
      reason: risk.label,
      risk_level: risk.level,
      rollback_to: rollback_to,
      post_state_owner: post_state_owner
    });
  }

  var recommendation = plan.length === 0 ? 'none' : (plan.length >= Math.ceil((comps.length || 1) / 2) ? 'full' : 'selective');

  return {
    story_id: sId,
    story_name: story.title || story.name || sId,
    classification: story.classification || story.classification_tag || story.copado_status || 'Unknown',
    summary: {
      total_components: comps.length,
      risky_components: plan.length
    },
    recommendation: recommendation, // none | selective | full
    plan: plan
  };
}

// ---------------------- Renderers (HTML strings) ----------------------
function renderComponentTimelineHTML(model) {
  var html = '';
  html += '<h3>Component Timeline</h3>';
  html += '<div class="muted" style="font-size:14px; margin-bottom:16px; font-family:monospace;">' + escapeHtml(model.key) + '</div>';

  if (model.production && model.production.have) {
    html += '<div class="rb-block">' +
      '<div style="font-weight:600; font-size:14px; color:#101828; margin-bottom:10px;">Production Baseline</div>' +
      '<div style="display:grid; gap:6px;">' +
        '<div><span style="color:#667085;">Story:</span> <strong>' + escapeHtml(model.production.production_story_id) + '</strong> — ' + escapeHtml(model.production.production_story_title) + '</div>' +
        '<div><span style="color:#667085;">Date:</span> <strong>' + fmtDate(model.production.production_commit_date) + '</strong></div>' +
      '</div>' +
    '</div>';
  } else {
    html += '<div class="rb-block" style="background:#fff7e6; border-color:#fec84b;"><div style="color:#824100;">⚠️ No production baseline recorded for this component.</div></div>';
  }

  html += '<div class="rb-block">' +
    '<div style="font-weight:600; font-size:14px; color:#101828; margin-bottom:10px;">Stories in this release (latest first)</div>';

  if (model.timeline && model.timeline.length > 0) {
    html += '<div class="rb-timeline-list">';
    for (var i = 0; i < model.timeline.length; i++) {
      var u = model.timeline[i];
      html += '<div class="rb-timeline-row">' +
        '<div class="mono" style="font-size:12px; color:#667085;">' + fmtDate(u.commit_date) + '</div>' +
        '<div><span class="tag tag-' + cssStatus(u.classification) + '">' + (u.classification || 'Unknown') + '</span></div>' +
        '<div style="font-size:13px;"><strong>' + escapeHtml(u.story_id) + '</strong> <span style="color:#667085;">—</span> ' + escapeHtml(u.story_name || '') + '</div>' +
      '</div>';
    }
    html += '</div>';
  } else {
    html += '<div class="muted">No stories found in this release.</div>';
  }

  html += '</div>';
  return html;
}

function renderStoryPlanHTML(plan, analysis) {
  var html = '';
  html += '<h3>Rollback Plan</h3>';
  html += '<div class="muted" style="font-size:14px; margin-bottom:16px;"><strong>' + escapeHtml(plan.story_id) + '</strong> — ' + escapeHtml(plan.story_name) + '</div>';
  html += '<div class="rb-grid">' +
    '<div><div style="color:#667085; font-size:12px;">Classification</div><div style="margin-top:6px;"><span class="tag tag-' + cssStatus(plan.classification) + '">' + escapeHtml(plan.classification) + '</span></div></div>' +
    '<div><div style="color:#667085; font-size:12px;">Total Components</div><div style="margin-top:6px; font-size:20px; font-weight:600; color:#101828;">' + String(plan.summary.total_components) + '</div></div>' +
    '<div><div style="color:#667085; font-size:12px;">Risky Components</div><div style="margin-top:6px; font-size:20px; font-weight:600; color:#b42318;">' + String(plan.summary.risky_components) + '</div></div>' +
    '<div><div style="color:#667085; font-size:12px;">Recommendation</div><div style="margin-top:6px;"><span class="tag tag-' + recTag(plan.recommendation) + '" style="text-transform:uppercase; font-size:11px; letter-spacing:0.5px;">' + escapeHtml(plan.recommendation) + '</span></div></div>' +
  '</div>';

  if (!plan.plan || plan.plan.length === 0) {
    html += '<div class="rb-block" style="background:#e6f7ed; border-color:#abefc6;"><div style="color:#087443;">✓ All components are low risk. No rollback needed.</div></div>';
    return html;
  }

  html += '<div class="rb-block">' +
    '<div style="font-weight:600; font-size:14px; color:#101828; margin-bottom:12px;">Per-component actions</div>' +
    '<table class="rb-actions-table">' +
      '<thead class="rb-actions-head">' +
        '<tr><th style="width:28%;">Component</th><th style="width:24%;">Reason</th><th style="width:24%;">Rollback to</th><th style="width:24%;">Post-state owner</th></tr>' +
      '</thead>' +
      '<tbody>';

  for (var i = 0; i < plan.plan.length; i++) {
    var p = plan.plan[i];
    var target = '<span style="color:#98a2b3;">—</span>';
    if (p.rollback_to) {
      if (p.rollback_to.mode === 'prod') {
        target = '<span style="color:#087443; font-weight:600;">Production</span>' +
                 (p.rollback_to.production_commit_date ? '<br><span style="color:#667085; font-size:11px;">' + fmtDate(p.rollback_to.production_commit_date) + '</span>' : '');
      } else if (p.rollback_to.story_id) {
        target = '<strong>' + escapeHtml(p.rollback_to.story_id) + '</strong>' +
                 (p.rollback_to.commit_date ? '<br><span style="color:#667085; font-size:11px;">' + fmtDate(p.rollback_to.commit_date) + '</span>' : '');
      }
    }

    html += '<tr class="rb-actions-row">' +
      '<td style="font-family:monospace; font-size:12px; word-break:break-all;">' + escapeHtml(p.key) + '</td>' +
      '<td><span class="risk-badge level-' + escapeHtml(p.risk_level) + '">' + escapeHtml(p.reason) + '</span></td>' +
      '<td>' + target + '</td>' +
      '<td style="font-weight:500;">' + escapeHtml(p.post_state_owner || '—') + '</td>' +
    '</tr>';
  }

  html += '</tbody></table></div>';
  return html;
}

function renderDecisionSummaryHTML(rows, analysis) {
  var html = '';
  html += '<h3>Decision Summary (Rollback-oriented)</h3>';

  if (!rows || rows.length === 0) {
    html += '<div class="rb-block muted">No stories to display.</div>';
    return html;
  }

  // Add summary statistics
  var totalStories = rows.length;
  var needFullRollback = rows.filter(function(r){ return r.recommendation === 'full'; }).length;
  var needSelectiveRollback = rows.filter(function(r){ return r.recommendation === 'selective'; }).length;
  var noRollbackNeeded = rows.filter(function(r){ return r.recommendation === 'none'; }).length;

  html += '<div class="rb-grid" style="margin-bottom:20px;">' +
    '<div><div style="color:#667085; font-size:12px;">Total Stories</div><div style="margin-top:6px; font-size:20px; font-weight:600; color:#101828;">' + totalStories + '</div></div>' +
    '<div><div style="color:#667085; font-size:12px;">Full Rollback</div><div style="margin-top:6px; font-size:20px; font-weight:600; color:#b42318;">' + needFullRollback + '</div></div>' +
    '<div><div style="color:#667085; font-size:12px;">Selective Rollback</div><div style="margin-top:6px; font-size:20px; font-weight:600; color:#824100;">' + needSelectiveRollback + '</div></div>' +
    '<div><div style="color:#667085; font-size:12px;">No Rollback</div><div style="margin-top:6px; font-size:20px; font-weight:600; color:#087443;">' + noRollbackNeeded + '</div></div>' +
  '</div>';

  html += '<table class="rb-actions-table">' +
    '<thead class="rb-actions-head">' +
      '<tr><th style="width:30%;">Story ID</th><th style="width:15%;">Classification</th><th style="width:15%;">Total Comps</th><th style="width:15%;">Risky Comps</th><th style="width:25%;">Recommendation</th></tr>' +
    '</thead>' +
    '<tbody>';

  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    var riskPercent = r.summary.total_components > 0 ? Math.round((r.summary.risky_components / r.summary.total_components) * 100) : 0;

    html += '<tr class="rb-actions-row">' +
      '<td><strong>' + escapeHtml(r.story_id) + '</strong><br><span style="color:#667085; font-size:11px;">' + escapeHtml(r.story_name) + '</span></td>' +
      '<td><span class="tag tag-' + cssStatus(r.classification) + '">' + escapeHtml(r.classification) + '</span></td>' +
      '<td style="text-align:center; font-size:16px; font-weight:600;">' + String(r.summary.total_components) + '</td>' +
      '<td style="text-align:center;"><span style="font-size:16px; font-weight:600; color:' + (r.summary.risky_components > 0 ? '#b42318' : '#087443') + ';">' + String(r.summary.risky_components) + '</span><br><span style="color:#667085; font-size:11px;">(' + riskPercent + '%)</span></td>' +
      '<td><span class="tag tag-' + recTag(r.recommendation) + '" style="text-transform:uppercase; font-size:11px; letter-spacing:0.5px;">' + escapeHtml(r.recommendation) + '</span></td>' +
    '</tr>';
  }

  html += '</tbody></table>';
  return html;
}

function recTag(rec) {
  if (rec === 'none') return 'safe';
  if (rec === 'selective') return 'safewc';
  if (rec === 'full') return 'conflict';
  return 'other';
}

// ---------------------- Utilities ----------------------
function closest(el, cls) {
  while (el && el !== document.body) {
    if (el.classList && el.classList.contains(cls)) return el;
    el = el.parentElement;
  }
  return null;
}

function buildLookupIndexes(analysis) {
  analysis.by_story_id = {};
  analysis.by_component_key = {};
  var stories = analysis.all_stories || [];
  for (var i = 0; i < stories.length; i++) {
    var story = stories[i];
    var storyId = story.story_id || story.id || story.us_id || story.StoryId || story.name || story.title;
    var storyName = story.title || story.name || storyId || 'Unknown Story';
    if (!storyId) continue;
    analysis.by_story_id[storyId] = Object.assign({}, story, { _norm_id: storyId, _norm_name: storyName });

    var comps = story.components || story.Components || [];
    for (var c = 0; c < comps.length; c++) {
      var comp = comps[c];
      var ci = normalizeComponent(comp);
      if (!ci) continue;
      var key = ci.type + ':' + ci.name;
      if (!analysis.by_component_key[key]) analysis.by_component_key[key] = [];
      analysis.by_component_key[key].push({
        story_id: storyId,
        story_name: storyName,
        classification: story.classification || story.classification_tag || story.copado_status || 'Unknown',
        commit_date: ci.commit_date,
        commit_by: ci.commit_by,
        latest_commit_sha: ci.latest_commit_sha,
        production_commit_date: ci.production_commit_date,
        production_story_id: ci.production_story_id,
        production_story_title: ci.production_story_title,
        _raw: comp
      });
    }
  }
}

function normalizeComponent(comp) {
  var type = comp.type || comp.component_type || comp.metadataType || null;
  var name = comp.name || comp.component_name || comp.ComponentName || null;
  var apiSnake = comp.api_name;
  var apiCamel = comp.apiName || comp.fullName;
  var api = (typeof apiSnake === 'string') ? apiSnake : ((typeof apiCamel === 'string') ? apiCamel : null);
  if (api) {
    var parts = api.split('.');
    if (parts.length > 1) {
      type = parts[0] || type || 'UnknownType';
      name = parts.slice(1).join('.');
    } else if (!name) {
      name = api;
    }
  }
  if (!type) type = 'UnknownType';
  if (!name) return null;
  return {
    type: type,
    name: name,
    commit_date: comp.story_commit_date || comp.commit_date || comp.last_modified || comp.commitDate,
    commit_by: comp.commit_by || comp.author,
    latest_commit_sha: comp.latest_commit_sha || comp.commit_hash || comp.commit_sha,
    production_commit_date: comp.production_commit_date,
    production_story_id: comp.production_story_id,
    production_story_title: comp.production_story_title
  };
}

function isAfter(a, b) {
  var da = new Date(a); var db = new Date(b);
  return !isNaN(da) && !isNaN(db) && da > db;
}

function computeComponentRisk(cinfo, usage, currentStoryId) {
  var isShared = Array.isArray(usage) && usage.some(function(u){ return u.story_id && u.story_id !== currentStoryId; });
  var isInProd = !!cinfo.production_commit_date;

  // NEW RULE: Prod is ahead (prod date > this change's date) AND shared
  var prodAhead = Boolean(
    isShared &&
    isInProd &&
    cinfo.commit_date &&
    isAfter(cinfo.production_commit_date, cinfo.commit_date)
  );

  if (prodAhead) {
    return { level: 'high', label: 'Prod newer than this change (shared) — cannot promote older version', flags: { prodAhead: true } };
  }

  // Existing checks
  var isNewerThanProd = isInProd && cinfo.commit_date && isAfter(cinfo.commit_date, cinfo.production_commit_date);
  var isOwnedHere = Array.isArray(usage) && usage.length > 0 && usage.every(function(u){ return u.story_id === currentStoryId; });

  if (isShared && isNewerThanProd) return { level: 'high', label: 'Shared & newer than Prod', flags: {} };
  if (isShared) return { level: 'medium', label: 'Shared component', flags: {} };
  if (isInProd && isNewerThanProd) return { level: 'medium', label: 'Newer than Prod', flags: {} };
  if (isOwnedHere) return { level: 'low', label: 'Standalone in this story', flags: {} };
  return { level: 'low', label: 'Low risk', flags: {} };
}

function cssStatus(status) {
  switch (status) {
    case 'Safe': return 'safe';
    case 'Safe with commit': return 'safewc';
    case 'Conflict': return 'conflict';
    case 'Blocked': return 'blocked';
    default: return 'other';
  }
}

function fmtDate(d) {
  try { var dd = new Date(d); if (isNaN(dd)) return String(d || ''); return dd.toISOString().slice(0,10); } catch (e) { return String(d || ''); }
}

function escapeHtml(str) {
  if (str == null) return '';
  return String(str).replace(/[&<>"']/g, function (c) {
    return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
  });
}

function injectRollbackStyles() {
  if (document.querySelector('#rollback-impact-css')) return;
  var style = document.createElement('style');
  style.id = 'rollback-impact-css';
  var css = '\n' +
    '  /* Summary chips */\n' +
    '  .rollback-summary { display:flex; gap:12px; margin: 0 0 24px 0; flex-wrap: wrap; justify-content: center; }\n' +
    '  .chip { display:inline-flex; align-items:center; gap:8px; border-radius:12px; padding:12px 20px; font-size:14px; font-weight:600; border: 1px solid; box-shadow: 0 2px 8px rgba(0,0,0,0.08); transition: all 0.2s ease; }\n' +
    '  .chip:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.12); }\n' +
    '  .chip-safe { background:#e8f5e9; color:#1b5e20; border-color:#a5d6a7; }\n' +
    '  .chip-safewc { background:#e3f2fd; color:#0d47a1; border-color:#90caf9; }\n' +
    '  .chip-conflict { background:#ffebee; color:#b71c1c; border-color:#ef9a9a; }\n' +
    '  .chip-blocked { background:#fff3e0; color:#e65100; border-color:#ffb74d; }\n' +
    '\n' +
    '  /* Search Controls */\n' +
    '  .rb-controls { background: white; border-radius: 12px; padding: 20px; margin-bottom: 24px; border: 1px solid #e5e5e7; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }\n' +
    '  .rb-searchbar { display:flex; align-items:center; gap:12px; flex-wrap: wrap; }\n' +
    '  .rb-label { font-size:13px; color:#666666; font-weight:600; text-transform: uppercase; letter-spacing: 0.5px; }\n' +
    '  .rb-mode { padding:12px 16px; border: 1px solid #d2d2d7; border-radius: 8px; font-size: 14px; background: white; cursor: pointer; transition: all 0.2s ease; min-width: 180px; }\n' +
    '  .rb-mode:focus { outline: none; border-color: #0071e3; box-shadow: 0 0 0 3px rgba(0, 113, 227, 0.1); }\n' +
    '  .rb-query { padding:12px 16px; border: 1px solid #d2d2d7; border-radius: 8px; font-size: 14px; flex: 1; min-width: 300px; transition: all 0.2s ease; }\n' +
    '  .rb-query:focus { outline: none; border-color: #0071e3; box-shadow: 0 0 0 3px rgba(0, 113, 227, 0.1); }\n' +
    '  .rb-query::placeholder { color: #86868b; }\n' +
    '  .rb-go { padding:12px 24px; border:none; border-radius:8px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; cursor:pointer; font-weight: 600; font-size: 14px; transition: all 0.2s ease; box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3); }\n' +
    '  .rb-go:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4); }\n' +
    '  .rb-go:active { transform: translateY(0); }\n' +
    '  .rb-hint { font-size:12px; color:#86868b; font-style: italic; }\n' +
    '\n' +
    '  /* Story sections */\n' +
    '  .rollback-section h3 { font-size: 20px; margin-top: 32px; margin-bottom: 16px; color: #1d1d1f; font-weight: 700; }\n' +
    '  .rollback-list { list-style-type: none; padding-left: 0; display: flex; flex-direction: column; gap: 16px; }\n' +
    '  .rb-story-item { border:1px solid #e5e5e7; border-radius:18px; margin:0; overflow:hidden; background:white; box-shadow: 0 4px 12px rgba(0,0,0,0.05); transition: all 0.3s ease; }\n' +
    '  .rb-story-item:hover { box-shadow: 0 8px 32px rgba(0,0,0,0.12); border-color: #d2d2d7; transform: translateY(-2px); }\n' +
    '  .rb-story-header { display:flex; align-items:center; gap:12px; padding:20px 24px; background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); border-bottom:1px solid #e5e5e7; }\n' +
    '  .rb-story-title { font-weight:700; font-size:16px; color:#1d1d1f; }\n' +
    '  .rb-badges { margin-left:auto; display:flex; gap:8px; align-items:center; }\n' +
    '  .rb-toggle { border:none; background:transparent; cursor:pointer; font-size:16px; width:28px; height:28px; border-radius:6px; transition: all 0.2s ease; display:flex; align-items:center; justify-content:center; }\n' +
    '  .rb-toggle:hover { background:rgba(0,0,0,0.05); }\n' +
    '  .btn-light { padding:8px 16px; border:1px solid #d2d2d7; background:white; border-radius:8px; cursor:pointer; font-size:13px; font-weight:600; transition: all 0.2s ease; }\n' +
    '  .btn-light:hover { background:#f8f9fa; border-color:#0071e3; color:#0071e3; }\n' +
    '  .btn-link { border:none; background:transparent; cursor:pointer; text-decoration:none; color:#0071e3; font-size:13px; font-weight:600; transition: all 0.2s ease; padding:4px 8px; border-radius:6px; }\n' +
    '  .btn-link:hover { background:rgba(0,113,227,0.1); color:#0056b3; }\n' +
    '  .hidden { display:none; }\n' +
    '  .rb-story-details { padding:20px 24px; background:#fafbfc; }\n' +
    '  .rb-components { display:flex; flex-direction:column; gap:12px; }\n' +
    '  .rb-comp-row { display:grid; grid-template-columns: 2fr 1fr 1fr; gap:12px; align-items:start; border:1px solid #e5e5e7; padding:16px; border-radius:12px; background:white; transition: all 0.2s ease; }\n' +
    '  .rb-comp-row:hover { border-color:#0071e3; box-shadow: 0 2px 8px rgba(0,113,227,0.1); }\n' +
    '  .rb-comp-row.rb-prod-ahead { border-color:#ff4d4f; box-shadow: 0 0 0 2px rgba(255,77,79,0.15) inset; background:#fff1f0; }\n' +
    '  .rb-comp-row.rb-prod-ahead:hover { border-color:#ff1a1a; box-shadow: 0 0 0 2px rgba(255,77,79,0.25) inset, 0 2px 8px rgba(255,77,79,0.2); }\n' +
    '  .badge-prod-ahead { display:inline-block; border:1px solid #ff4d4f; color:#b42318; background:#fff1f0; border-radius:10px; padding:2px 6px; font-size:12px; margin-left:6px; }\n' +
    '  .rb-comp-id { font-family: "SF Mono", Monaco, "Cascadia Code", "Roboto Mono", Consolas, "Courier New", monospace; font-size:13px; line-height:1.5; }\n' +
    '  .rb-comp-type { color:#0071e3; font-weight:700; }\n' +
    '  .rb-comp-name { color:#1d1d1f; font-weight:500; }\n' +
    '  .rb-comp-meta { display:flex; flex-direction:column; gap:4px; }\n' +
    '  .rb-comp-meta .meta { color:#666666; font-size:12px; line-height:1.4; }\n' +
    '  .rb-comp-risk { display:flex; flex-direction:column; gap:8px; align-items:flex-end; }\n' +
    '  .risk-badge { border-radius:6px; padding:4px 8px; font-size:11px; border:1px solid; font-weight:700; text-transform:uppercase; letter-spacing:0.3px; white-space:normal; word-wrap:break-word; max-width:100%; display:inline-block; line-height:1.3; }\n' +
    '  .level-high { background:#ffebee; color:#b71c1c; border-color:#ef9a9a; }\n' +
    '  .level-medium { background:#fff3e0; color:#e65100; border-color:#ffb74d; }\n' +
    '  .level-low { background:#e8f5e9; color:#1b5e20; border-color:#a5d6a7; }\n' +
    '  .tag { border:1px solid; border-radius:8px; padding:6px 12px; font-size:12px; font-weight:700; text-transform:uppercase; letter-spacing:0.5px; white-space:nowrap; }\n' +
    '  .tag-safe { background:#e8f5e9; color:#1b5e20; border-color:#a5d6a7; }\n' +
    '  .tag-safewc { background:#e3f2fd; color:#0d47a1; border-color:#90caf9; }\n' +
    '  .tag-conflict { background:#ffebee; color:#b71c1c; border-color:#ef9a9a; }\n' +
    '  .tag-blocked { background:#fff3e0; color:#e65100; border-color:#ffb74d; }\n' +
    '  .tag-other { background:#f5f5f5; color:#666666; border-color:#e0e0e0; }\n' +
    '  .muted { color:#666666; font-size:13px; }\n' +
    '  .mono { font-family: "SF Mono", Monaco, "Cascadia Code", "Roboto Mono", Consolas, "Courier New", monospace; }\n' +
    '  /* Modal */\n' +
    '  #rb-modal-root { position: fixed; inset: 0; z-index: 9999; display:none; }\n' +
    '  .rb-modal-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.5); cursor:pointer; backdrop-filter: blur(4px); }\n' +
    '  .rb-modal { position: fixed; left:50%; top:50%; transform: translate(-50%, -50%); background:white; width: 92%; max-width:1100px; max-height: 90vh; overflow-y:auto; border-radius:18px; box-shadow:0 20px 60px rgba(0,0,0,0.3); z-index:10000; }\n' +
    '  .rb-modal-close { position:sticky; top:8px; float:right; margin:12px; border:none; background:#f5f5f5; font-size:20px; cursor:pointer; width:36px; height:36px; border-radius:50%; display:flex; align-items:center; justify-content:center; z-index:10001; transition: all 0.2s ease; }\n' +
    '  .rb-modal-close:hover { background:#e5e5e5; transform: rotate(90deg); }\n' +
    '  .rb-modal-body { padding: 32px; clear:both; }\n' +
    '  .rb-modal-body h3 { margin-top:0; color:#1d1d1f; font-size:24px; font-weight:700; }\n' +
    '  .rb-block { border:1px solid #e5e5e7; border-radius:12px; padding:20px; margin:20px 0; background:#f8f9fa; }\n' +
    '  .rb-block > div:first-child { margin-bottom:12px; }\n' +
    '  .rb-timeline-list { display:flex; flex-direction:column; gap:12px; margin-top:16px; }\n' +
    '  .rb-timeline-row { display:grid; grid-template-columns: 140px 160px 1fr; gap:16px; align-items:center; padding:14px 16px; background:white; border-radius:8px; border:1px solid #e5e5e7; transition: all 0.2s ease; }\n' +
    '  .rb-timeline-row:hover { border-color:#0071e3; box-shadow: 0 2px 8px rgba(0,113,227,0.1); }\n' +
    '  .rb-grid { display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:16px; margin:20px 0; }\n' +
    '  .rb-grid > div { padding:16px; border:1px solid #e5e5e7; border-radius:12px; background:white; }\n' +
    '  .rb-grid > div > div:first-child { margin-bottom:8px; }\n' +
    '  .rb-actions-table { width:100%; border-collapse: separate; border-spacing:0; background:#e5e5e7; border:1px solid #e5e5e7; border-radius:12px; overflow:hidden; table-layout:fixed; }\n' +
    '  .rb-actions-head { }\n' +
    '  .rb-actions-head th { padding:12px 10px; background:#f8f9fa; font-weight:700; color:#1d1d1f; font-size:12px; text-transform:uppercase; letter-spacing:0.5px; vertical-align:middle; border-bottom:2px solid #e5e5e7; text-align:left; }\n' +
    '  .rb-actions-row { transition: all 0.2s ease; }\n' +
    '  .rb-actions-row td { padding:12px 10px; background:white; font-size:13px; vertical-align:top; border-bottom:1px solid #e5e5e7; word-wrap:break-word; overflow-wrap:break-word; max-width:0; }\n' +
    '  .rb-actions-row:last-child td { border-bottom:none; }\n' +
    '  .rb-actions-row:hover td { background:#f8f9fa; }\n' +
    '  @media (max-width: 768px) {\n' +
    '    .rb-modal { width: 95%; max-width: 95%; }\n' +
    '    .rb-modal-body { padding: 20px; }\n' +
    '    .rb-searchbar { flex-direction: column; align-items: stretch; }\n' +
    '    .rb-mode, .rb-query { width: 100%; min-width: auto; }\n' +
    '    .rb-timeline-row { grid-template-columns: 1fr; }\n' +
    '    .rb-comp-row { grid-template-columns: 1fr; }\n' +
    '    .rb-actions-table, .rb-actions-head, .rb-actions-row, .rb-actions-head th, .rb-actions-row td { display:block; }\n' +
    '    .rb-actions-table { border:none; }\n' +
    '    .rb-actions-head { display:none; }\n' +
    '    .rb-actions-row { margin-bottom:12px; border:1px solid #e5e5e7; border-radius:8px; background:white; }\n' +
    '    .rb-actions-row td { padding:8px 12px; border-bottom:1px solid #f5f5f7; }\n' +
    '    .rb-actions-row td:last-child { border-bottom:none; }\n' +
    '  }\n';
  style.textContent = css;
  document.head.appendChild(style);
}
