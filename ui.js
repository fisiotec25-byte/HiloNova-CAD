// ============================================================
// HiloNova CAD — Utilidades de interfaz
// ============================================================
const P = {
  logo: '<path d="M5 19V5l7 9V5"/><path d="M12 19l7-14v14"/>',
  folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  ruler: '<path d="M3 17L17 3l4 4L7 21z"/><path d="M7 13l2 2M10 10l2 2M13 7l2 2"/>',
  pattern: '<path d="M6 3l-3 4v12h6V9l3-2 3 2v10h6V7l-3-4"/><path d="M9 3c0 2 1.3 3 3 3s3-1 3-3"/>',
  grade: '<path d="M4 20V8l4-4h8l4 4v12"/><path d="M7 20V10l3-3h4l3 3v10"/><path d="M10 20v-7h4v7"/>',
  marker: '<rect x="2.5" y="5" width="19" height="14" rx="1.5"/><path d="M7 5v14M12 5v8h9.5M12 13v6"/>',
  factory: '<path d="M3 21V10l6 4V10l6 4V5h6v16z"/><path d="M7 18h2M12 18h2M17 18h2"/>',
  check: '<path d="M20 6L9 17l-5-5"/>',
  shield: '<path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
  download: '<path d="M12 3v12M7 10l5 5 5-5"/><path d="M4 21h16"/>',
  upload: '<path d="M12 21V9M7 14l5-5 5 5"/><path d="M4 3h16"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  cursor: '<path d="M5 3l14 7-6 2-2 6z"/>',
  pen: '<path d="M12 19l7-7 3 3-7 7z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18z"/><circle cx="11" cy="11" r="2"/>',
  plusPt: '<circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>',
  curve: '<path d="M3 20C3 9 21 15 21 4"/><circle cx="3" cy="20" r="1.5"/><circle cx="21" cy="4" r="1.5"/>',
  rect: '<rect x="4" y="6" width="16" height="12" rx="1"/>',
  measure: '<path d="M2 12h20M6 9v6M18 9v6M2 8v8M22 8v8"/>',
  notch: '<path d="M3 18h18"/><path d="M12 18v-7"/><path d="M9 11h6"/>',
  grain: '<path d="M12 3v18M8 7l4-4 4 4M8 17l4 4 4-4"/>',
  text: '<path d="M4 7V5h16v2M12 5v14M9 19h6"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M5 7l1 13h12l1-13M9 7V4h6v3"/>',
  undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>',
  redo: '<path d="M15 14l5-5-5-5"/><path d="M20 9H9a5 5 0 0 0 0 10h3"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  copy: '<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>',
  x: '<path d="M18 6L6 18M6 6l12 12"/>',
  play: '<path d="M6 4l14 8-14 8z"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="1"/>',
  zoomIn: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3M11 8v6M8 11h6"/>',
  zoomOut: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3M8 11h6"/>',
  fit: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff: '<path d="M3 3l18 18"/><path d="M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.2M6.6 6.6A17 17 0 0 0 2 12s3.5 7 10 7a9.6 9.6 0 0 0 5.4-1.6"/>',
  lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  unlock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.8-1.3"/>',
  alert: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18h.01"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5h.01"/>',
  ok: '<circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/>',
  bad: '<circle cx="12" cy="12" r="9"/><path d="M15 9l-6 6M9 9l6 6"/>',
  flip: '<path d="M12 3v18"/><path d="M8 7L3 12l5 5V7zM16 7l5 5-5 5V7z"/>',
  rotate: '<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>',
  scissors: '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M20 4L8.1 15.9M14.5 14.5L20 20M8.1 8.1L12 12"/>',
  file: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/>',
  layers: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  card: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>',
  key: '<circle cx="7.5" cy="15.5" r="4.5"/><path d="M10.7 12.3L21 2M17 6l3 3M14 9l2 2"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  chevron: '<path d="M6 9l6 6 6-6"/>',
  wand: '<path d="M15 4V2M15 16v-2M8 9h2M20 9h2M17.8 11.8L19 13M17.8 6.2L19 5M3 21l9-9M12.2 6.2L11 5"/>',
  hand: '<path d="M18 11V6a2 2 0 0 0-4 0v5M14 10V4a2 2 0 0 0-4 0v6M10 10.5V6a2 2 0 0 0-4 0v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.9-6-2.4l-3.6-3.6a2 2 0 0 1 2.8-2.8L7 15"/>',
  cloud: '<path d="M17.5 19a4.5 4.5 0 1 0-1.4-8.8A6 6 0 1 0 6 16.9"/><path d="M6 17h11.5"/>',
  sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>',
  split: '<path d="M4 4l16 16"/><circle cx="12" cy="12" r="2.5"/>',
};

export const icon = (name, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24">${P[name] || P.info}</svg>`;

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function h(html) { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; }

// Unidades: internamente mm. Mostrar en cm (o pulgadas)
export const U = { unit: 'cm' };
export const fmtLen = (mm, d = 1) => {
  if (!isFinite(mm)) return '—';
  if (U.unit === 'in') return (mm / 25.4).toFixed(d + 1) + '"';
  return (mm / 10).toFixed(d);
};
export const unitLbl = () => (U.unit === 'in' ? 'in' : 'cm');
export const toMM = (val) => (U.unit === 'in' ? +val * 25.4 : +val * 10);
export const fromMM = (mm, d = 2) => (U.unit === 'in' ? +(mm / 25.4).toFixed(d + 1) : +(mm / 10).toFixed(d));
export const money = (n) => isFinite(n) ? '$' + n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—';

// ---------- Toasts ----------
let toastBox;
export function toast(msg, type = 'ok', ms = 3200) {
  if (!toastBox) { toastBox = h('<div class="toasts"></div>'); document.body.appendChild(toastBox); }
  const ic = { ok: 'ok', bad: 'bad', warn: 'alert', info: 'info' }[type] || 'info';
  const t = h(`<div class="toast ${type}">${icon(ic)}<div>${msg}</div></div>`);
  toastBox.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transition = '.3s'; setTimeout(() => t.remove(), 300); }, ms);
}

// ---------- Modal ----------
export function modal({ title, body, actions = [], wide = false, onClose } = {}) {
  const bg = h(`<div class="modal-bg"><div class="modal ${wide ? 'wide' : ''}">
    <div class="modal-h"><h3>${title}</h3><button class="btn icon sm ghost" data-x>${icon('x', 'sm')}</button></div>
    <div class="modal-b"></div><div class="modal-f"></div></div></div>`);
  const b = bg.querySelector('.modal-b');
  if (typeof body === 'string') b.innerHTML = body; else if (body) b.appendChild(body);
  const f = bg.querySelector('.modal-f');
  const close = () => { bg.remove(); document.removeEventListener('keydown', onKey); onClose && onClose(); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  bg.querySelector('[data-x]').onclick = close;
  bg.addEventListener('mousedown', (e) => { if (e.target === bg) close(); });
  if (!actions.length) f.remove();
  actions.forEach((a) => {
    const btn = h(`<button class="btn ${a.cls || ''}">${a.icon ? icon(a.icon, 'sm') : ''}${a.label}</button>`);
    btn.onclick = async () => { const r = a.onClick ? await a.onClick(bg) : undefined; if (r !== false) close(); };
    f.appendChild(btn);
  });
  document.body.appendChild(bg);
  enhanceSelects(bg);
  setTimeout(() => { const i = bg.querySelector('input,textarea'); i && i.focus(); }, 30);
  return { el: bg, close };
}

export function confirmar(msg, { title = 'Confirmar', ok = 'Aceptar', danger = false } = {}) {
  return new Promise((res) => {
    let done = false;
    modal({ title, body: `<p style="margin:0;line-height:1.55">${msg}</p>`, onClose: () => !done && res(false), actions: [
      { label: 'Cancelar', cls: 'ghost', onClick: () => { done = true; res(false); } },
      { label: ok, cls: danger ? 'danger' : 'pri', onClick: () => { done = true; res(true); } },
    ] });
  });
}

export function prompt(title, value = '', label = '') {
  return new Promise((res) => {
    let done = false;
    const m = modal({ title, body: `<div class="field">${label ? `<label>${label}</label>` : ''}<input class="input" value="${esc(value)}"></div>`, onClose: () => !done && res(null), actions: [
      { label: 'Cancelar', cls: 'ghost', onClick: () => { done = true; res(null); } },
      { label: 'Aceptar', cls: 'pri', onClick: (el) => { done = true; res(el.querySelector('input').value); } },
    ] });
    m.el.querySelector('input').addEventListener('keydown', (e) => { if (e.key === 'Enter') { done = true; res(e.target.value); m.close(); } });
  });
}

// ---------- Dropdown de vidrio (reemplaza <select class="select">) ----------
let openMenu = null;
function closeMenu() { if (openMenu) { openMenu.remove(); openMenu = null; } }
document.addEventListener('mousedown', (e) => { if (openMenu && !openMenu.contains(e.target) && !e.target.closest('.dd-btn')) closeMenu(); });
window.addEventListener('resize', closeMenu);
document.addEventListener('scroll', (e) => { if (openMenu && !openMenu.contains(e.target)) closeMenu(); }, true);

export function enhanceSelects(root = document) {
  root.querySelectorAll('select.select:not([data-dd])').forEach((sel) => {
    sel.dataset.dd = '1';
    sel.style.display = 'none';
    const wrap = h('<div class="dd"></div>');
    const btn = h(`<button type="button" class="dd-btn"><span></span>${icon('chevron', 'sm')}</button>`);
    wrap.appendChild(btn);
    sel.after(wrap);
    const sync = () => { const o = sel.options[sel.selectedIndex]; btn.querySelector('span').textContent = o ? o.textContent : ''; btn.disabled = sel.disabled; };
    sync();
    sel.addEventListener('change', sync);
    sel._sync = sync;
    btn.onclick = () => {
      if (openMenu) { closeMenu(); return; }
      const r = btn.getBoundingClientRect();
      const m = h('<div class="dd-menu"></div>');
      Array.from(sel.options).forEach((o, i) => {
        const it = h(`<div class="dd-opt ${i === sel.selectedIndex ? 'on' : ''}">${esc(o.textContent)}</div>`);
        it.onclick = () => { sel.selectedIndex = i; sel.dispatchEvent(new Event('change', { bubbles: true })); closeMenu(); };
        m.appendChild(it);
      });
      document.body.appendChild(m);
      m.style.minWidth = r.width + 'px';
      const below = window.innerHeight - r.bottom;
      m.style.left = Math.min(r.left, window.innerWidth - m.offsetWidth - 8) + 'px';
      m.style.top = (below > m.offsetHeight + 8 ? r.bottom + 4 : r.top - m.offsetHeight - 4) + 'px';
      openMenu = m;
    };
  });
}
export function refreshSelect(sel) { sel && sel._sync && sel._sync(); }

export function download(name, data, mime = 'application/octet-stream') {
  const blob = data instanceof Blob ? data : new Blob([data], { type: mime });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

export function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

export const slug = (s) => String(s || 'proyecto').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();

// Carga diferida de librerías externas (jsPDF)
const loaded = {};
export function loadScript(src) {
  if (!loaded[src]) loaded[src] = new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('No se pudo cargar ' + src)); document.head.appendChild(s); });
  return loaded[src];
}
export async function getJsPDF() {
  if (!window.jspdf) await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
  return window.jspdf.jsPDF;
}
