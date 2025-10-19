// ui/src/ui/components/modal.js
// Lightweight promise-based modal (no deps). Great for small forms like Analyze CSV.

const $  = (s, r=document) => r.querySelector(s);
const el = (tag, props={}, kids=[]) => {
  const n = Object.assign(document.createElement(tag), props);
  kids.forEach(k => n.append(k));
  return n;
};

export function openModal({ title='Dialog', content=null, actions=[] } = {}) {
  // Ensure root exists
  const root = document.getElementById('modal-root') || document.body.appendChild(el('div', { id:'modal-root' }));

  // Backdrop + dialog
  const backdrop = el('div', { className:'md-backdrop', role:'presentation' });
  const dialog   = el('div', { className:'md-dialog', role:'dialog', ariaModal:'true', ariaLabelledby:'md-title' });

  const header = el('div', { className:'md-header' }, [
    el('h3', { id:'md-title', textContent:title }),
    el('button', { className:'md-x', type:'button', ariaLabel:'Close', innerHTML:'&times;' })
  ]);
  const body   = el('div', { className:'md-body' });
  const footer = el('div', { className:'md-footer' });

  // Inject provided content (DOM node or string)
  if (content instanceof Node) body.append(content);
  else if (typeof content === 'string') body.innerHTML = content;

  // Default action if none provided
  if (!actions.length) {
    actions = [{ label:'Close', action:'close', variant:'secondary' }];
  }

  // Buttons
  actions.forEach(a => {
    const btn = el('button', {
      className: `btn ${a.variant === 'primary' ? 'btn-primary' : ''}`,
      type: a.type || 'button',
      textContent: a.label || 'OK'
    });
    btn.addEventListener('click', () => resolveAndClose({ action: a.action || a.label?.toLowerCase() || 'ok', payload: a.payload }));
    footer.append(btn);
  });

  dialog.append(header, body, footer);
  root.append(backdrop, dialog);

  // Focus handling
  const focusables = () => dialog.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
  const firstFocus = () => (focusables()[0] || dialog).focus();

  // Anim + initial focus
  requestAnimationFrame(() => {
    backdrop.classList.add('in'); dialog.classList.add('in');
    setTimeout(firstFocus, 30);
  });

  // Close helpers
  let settled = false;
  function resolveAndClose(result) {
    if (settled) return; settled = true;
    // animate out
    backdrop.classList.remove('in'); dialog.classList.remove('in');
    setTimeout(() => { backdrop.remove(); dialog.remove(); }, 120);
    resolver(result);
  }
  function cancelAndClose() { resolveAndClose({ action:'cancel' }); }

  // Events
  header.querySelector('.md-x').addEventListener('click', cancelAndClose);
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) cancelAndClose(); });
  document.addEventListener('keydown', onKeyDown);
  function onKeyDown(e){
    if (!document.body.contains(dialog)) { document.removeEventListener('keydown', onKeyDown); return; }
    if (e.key === 'Escape') { e.preventDefault(); cancelAndClose(); }
    if (e.key === 'Tab') {
      // focus trap
      const items = Array.from(focusables());
      if (!items.length) return;
      const i = items.indexOf(document.activeElement);
      if (e.shiftKey && (i <= 0)) { e.preventDefault(); items[items.length-1].focus(); }
      if (!e.shiftKey && (i === items.length-1)) { e.preventDefault(); items[0].focus(); }
    }
  }

  // Promise interface
  let resolver;
  const p = new Promise(r => { resolver = r; });
  p.close = cancelAndClose;
  p.setBody = (nodeOrHtml) => {
    body.innerHTML = '';
    if (nodeOrHtml instanceof Node) body.append(nodeOrHtml);
    else body.innerHTML = nodeOrHtml;
  };
  p.setTitle = (t) => { header.querySelector('#md-title').textContent = t || title; };

  // One-time CSS injection
  injectCssOnce();

  return p;
}

/* ------- One-time CSS for the modal ------- */
let cssInjected = false;
function injectCssOnce(){
  if (cssInjected) return; cssInjected = true;
  const css = `
  .md-backdrop{
    position:fixed; inset:0; background:rgba(0,0,0,.45);
    opacity:0; transition:opacity .12s ease; z-index:400;
  }
  .md-backdrop.in{opacity:1}
  .md-dialog{
    position:fixed; inset:auto; left:50%; top:10%;
    transform:translateX(-50%) translateY(-12px) scale(.98);
    width:min(720px, 92vw); background:var(--surface); color:var(--text);
    border:var(--border); border-radius:12px; box-shadow:var(--shadow);
    opacity:0; transition:all .12s ease; z-index:401; outline:0;
    display:flex; flex-direction:column; max-height:80vh;
  }
  .md-dialog.in{ opacity:1; transform:translateX(-50%) translateY(0) scale(1); }
  .md-header{ display:flex; justify-content:space-between; align-items:center; padding:12px 14px; border-bottom:var(--border); }
  .md-header h3{ margin:0; font-size:16px }
  .md-x{ background:transparent; border:0; color:var(--text); font-size:20px; line-height:1; cursor:pointer; padding:4px 8px; border-radius:8px }
  .md-x:hover{ background:#1a2140 }
  .md-body{ padding:12px 14px; overflow:auto }
  .md-footer{ padding:12px 14px; display:flex; gap:8px; justify-content:flex-end; border-top:var(--border) }
  `;
  document.head.appendChild(el('style', { textContent: css }));
}

/* ------- Convenience builders for simple forms ------- */
export function buildForm(fields = []) {
  // fields: [{ type:'file'|'text'|'select', name, label, accept?, multiple?, options? }]
  const form = el('form', { className:'md-form' });
  fields.forEach(f => {
    const row = el('label', { className:'md-row' });
    row.append(el('div', { className:'md-lab', textContent: f.label || f.name || '' }));
    let input;
    if (f.type === 'select') {
      input = el('select', { name:f.name });
      (f.options || []).forEach(opt => input.append(el('option', { value: opt.value ?? opt, textContent: opt.label ?? opt })));
    } else {
      input = el('input', { type: f.type || 'text', name: f.name, accept: f.accept, multiple: !!f.multiple, placeholder: f.placeholder || '' });
    }
    if (f.required) input.required = true;
    row.append(input);
    form.append(row);
  });
  injectFormCssOnce();
  return form;
}

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
    border-color: rgba(255,255,255,.12); /* overridden by theme below */
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

  /* theme-specific border tweaks for better contrast */
  :root:not([data-theme="quartz"]) .md-row input,
  :root:not([data-theme="quartz"]) .md-row select,
  :root:not([data-theme="quartz"]) .md-row textarea{
    border-color: rgba(255,255,255,.12);
  }
  :root[data-theme="quartz"] .md-row input,
  :root[data-theme="quartz"] .md-row select,
  :root[data-theme="quartz"] .md-row textarea{
    background: #fff;
    border-color: rgba(0,0,0,.12);
  }
  `;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
}

