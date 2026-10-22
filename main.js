// ============================================================
// HiloNova CAD — Arranque, navegación y barra superior
// ============================================================
import { state, on, emit, abrir, doUndo, doRedo, canUndo, canRedo, commit, cargarLocal, saveState } from './store.js';
import { icon, $, $$, esc, prompt, toast, h } from './ui.js';
import { SIZE_COLORS } from '../core/blocks.js';
import { iniciarAcceso, abrirCompra } from './auth.js';
import proyectos from './views/proyectos.js';
import medidas from './views/medidas.js';
import editor from './views/editor.js';
import graduacion from './views/graduacion.js';
import trazo from './views/trazo.js';
import produccion from './views/produccion.js';
import verificacion from './views/verificacion.js';
import exportar from './views/exportar.js';
import config from './views/config.js';

const VIEWS = { proyectos, medidas, editor, graduacion, trazo, produccion, verificacion, exportar, config };
const NEEDS_PROJECT = ['medidas', 'editor', 'graduacion', 'trazo', 'produccion', 'verificacion', 'exportar'];

// iconos de navegación
$$('.nav').forEach((b) => b.insertAdjacentHTML('afterbegin', icon(b.dataset.ic)));
$('#btnUndo').innerHTML = icon('undo'); $('#btnRedo').innerHTML = icon('redo');
$('#btnExport').innerHTML = icon('download', 'sm') + '<span>Exportar</span>';
const setThemeIcon = () => { $('#btnTheme').innerHTML = icon(document.documentElement.dataset.theme === 'light' ? 'moon' : 'sun'); };
setThemeIcon();

Object.values(VIEWS).forEach((vw) => vw.mount($('#v-' + vw.id)));

export function go(view) {
  if (NEEDS_PROJECT.includes(view) && !state.p) { toast('Abre o crea un proyecto primero', 'info'); view = 'proyectos'; }
  state.ui.view = view;
  $$('.view').forEach((s) => s.classList.toggle('on', s.id === 'v-' + view));
  $$('.nav').forEach((b) => b.classList.toggle('on', b.dataset.view === view));
  $$('.tab').forEach((b) => b.classList.toggle('on', b.dataset.view === view));
  try { localStorage.setItem('hnv.view', view); } catch {}
  VIEWS[view].onShow ? VIEWS[view].onShow() : VIEWS[view].render();
}
window.hnvGo = go;

$$('.nav, .tab').forEach((b) => b.addEventListener('click', () => go(b.dataset.view)));
$('#btnExport').addEventListener('click', () => go('exportar'));
$('#btnUndo').addEventListener('click', () => { doUndo(); });
$('#btnRedo').addEventListener('click', () => { doRedo(); });
$('#btnTheme').addEventListener('click', () => {
  const t = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
  document.documentElement.dataset.theme = t; try { localStorage.setItem('hnv.theme', t); } catch {}
  setThemeIcon(); emit('theme');
});
$('#projChip').addEventListener('click', async () => {
  if (!state.p) return go('proyectos');
  const n = await prompt('Nombre del proyecto', state.p.nombre);
  if (n && n.trim()) { state.p.nombre = n.trim(); commit('Renombrar'); }
});

document.addEventListener('keydown', (e) => {
  if (e.target.closest('input,textarea,select,[contenteditable]')) return;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); doUndo(); }
  else if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) { e.preventDefault(); doRedo(); }
});

function topbar() {
  const p = state.p;
  $('#projChip').innerHTML = p ? `${icon('file', 'sm')}<span>${esc(p.nombre)}</span>` : `${icon('folder', 'sm')}<span class="muted">Sin proyecto</span>`;
  $('#btnUndo').disabled = !canUndo(); $('#btnRedo').disabled = !canRedo();
  const pills = $('#sizePills');
  if (!p) { pills.innerHTML = ''; return; }
  pills.innerHTML = p.tabla.tallas.map((t, i) => `<button class="size-pill ${t === state.ui.talla ? 'on' : ''} ${t === p.tabla.base ? 'base' : ''}" style="--c:${SIZE_COLORS[i % SIZE_COLORS.length]}" data-t="${esc(t)}" title="Talla ${esc(t)}${t === p.tabla.base ? ' (base)' : ''}">${esc(t)}</button>`).join('');
  pills.querySelectorAll('[data-t]').forEach((b) => b.addEventListener('click', () => { state.ui.talla = b.dataset.t; state.ui.selPunto = state.ui.selPunto; topbar(); VIEWS[state.ui.view].render(); }));
}

function licBadge() {
  const s = state.session, el = $('#licBadge');
  if (s.licencia) { el.className = 'lic pro'; el.innerHTML = `${icon('shield', 'sm')}<span>Licencia activa</span>`; el.onclick = () => go('config'); }
  else { el.className = 'lic'; el.innerHTML = `${icon('lock', 'sm')}<span>Modo demo · Activar</span>`; el.onclick = () => abrirCompra(); }
  let band = $('#demoBand');
  if (!s.licencia && !band) {
    band = h(`<div class="demo-band" id="demoBand">${icon('alert', 'sm')}<span>Modo demo: diseña y prueba todo. Exportar y guardar en la nube requieren licencia.</span><button class="btn sm pri">Activar licencia</button><button class="btn icon sm ghost" title="Cerrar">${icon('x', 'sm')}</button></div>`);
    band.querySelector('.pri').onclick = () => abrirCompra();
    band.querySelector('.ghost').onclick = () => band.remove();
    document.body.appendChild(band);
  } else if (s.licencia && band) band.remove();
}

on('change', () => { topbar(); const vw = VIEWS[state.ui.view]; vw && vw.render(); });
on('open', () => { topbar(); });
on('session', () => { licBadge(); topbar(); const vw = VIEWS[state.ui.view]; vw && vw.render(); });
on('save', (s) => {
  const m = { pendiente: 'Guardando…', sincronizando: 'Sincronizando…', nube: 'Guardado en la nube', local: 'Guardado en este equipo' };
  $('#saveStatus').innerHTML = s.status === 'nube' ? `${icon('cloud', 'sm')} ${m.nube}` : (m[s.status] || '');
});

// ---------- Arranque ----------
iniciarAcceso().then(() => {
  licBadge();
  const last = localStorage.getItem('hnv.last');
  const p = last ? cargarLocal(last) : null;
  if (p) { abrir(p); go(localStorage.getItem('hnv.view') || 'editor'); }
  else go('proyectos');
  topbar();
  const q = new URLSearchParams(location.search);
  if (q.get('pago') === 'ok') toast('¡Pago recibido! Tu licencia se activa en unos segundos.', 'ok', 6000);
  if (q.get('pago') === 'cancelado') toast('El pago se canceló. Puedes intentarlo cuando quieras.', 'info', 5000);
  if (q.has('comprar') && !state.session.licencia) setTimeout(abrirCompra, 400);
  if (q.has('pago') || q.has('comprar')) history.replaceState(null, '', location.pathname + (q.has('dev') ? '?dev=1' : ''));
});
on('open', (p) => { try { localStorage.setItem('hnv.last', p.id); } catch {} });
