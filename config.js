// ============================================================
// HiloNova CAD — Configuración y cuenta
// ============================================================
import { state, emit } from '../store.js';
import { icon, esc, U, enhanceSelects } from '../ui.js';
import { abrirCompra, cerrarSesion } from '../auth.js';

let root;
try { U.unit = localStorage.getItem('hnv.unit') || 'cm'; } catch {}
function mount(el) { root = el; }

const ATAJOS = [['V', 'Seleccionar'], ['H / Espacio', 'Desplazar lienzo'], ['N', 'Dibujar pieza'], ['R', 'Rectángulo'], ['P', 'Agregar punto'], ['C', 'Curva / esquina'], ['K', 'Piquete'], ['G', 'Línea de hilo'], ['M', 'Medir'], ['F', 'Ajustar a pantalla'], ['Flechas', 'Mover 1 mm (Shift = 1 cm)'], ['Supr', 'Eliminar punto o pieza'], ['Ctrl+D', 'Duplicar pieza'], ['Ctrl+Z / Ctrl+Y', 'Deshacer / rehacer']];

function render() {
  if (!root || !root.classList.contains('on')) return;
  const s = state.session, lic = s.licData;
  root.innerHTML = `<div class="page"><div class="page-h"><div><h1>Configuración</h1><p>Preferencias del software y tu cuenta.</p></div></div>
    <div class="grid2" style="align-items:start">
      <div style="display:flex;flex-direction:column;gap:14px">
        <div class="card"><div class="card-h">Cuenta y licencia</div><div class="card-b" style="display:flex;flex-direction:column;gap:12px">
          <div class="row">${icon('user')}<div><b>${esc(s.user?.nombre || s.user?.email || 'Sin sesión')}</b><br><span class="muted">${esc(s.user?.email || '')}</span></div></div>
          <div class="row"><span class="badge ${s.licencia ? 'ok' : 'warn'}">${s.licencia ? 'Licencia activa' : 'Modo demo'}</span>
            ${lic?.tipo ? `<span class="muted">${esc(lic.tipo === 'codigo' ? 'Código de alumno' : lic.tipo === 'subscription' ? 'Suscripción' : 'Pago único')}</span>` : ''}
            ${lic?.vence ? `<span class="muted">vence ${new Date(lic.vence.toMillis ? lic.vence.toMillis() : lic.vence).toLocaleDateString('es-MX')}</span>` : ''}</div>
          <div class="row">${s.licencia ? '' : `<button class="btn pri" id="cBuy">${icon('unlock', 'sm')}Activar licencia</button>`}<button class="btn" id="cOut">${icon('logout', 'sm')}Cerrar sesión</button></div>
        </div></div>
        <div class="card"><div class="card-h">Preferencias</div><div class="card-b grid2">
          <div class="field"><label>Unidades de pantalla</label><select class="select" id="cUnit"><option value="cm" ${U.unit === 'cm' ? 'selected' : ''}>Centímetros</option><option value="in" ${U.unit === 'in' ? 'selected' : ''}>Pulgadas</option></select></div>
          <div class="field"><label>Tema</label><select class="select" id="cTheme"><option value="dark">Noche</option><option value="light" ${document.documentElement.dataset.theme === 'light' ? 'selected' : ''}>Día</option></select></div>
        </div></div>
      </div>
      <div class="card"><div class="card-h">Atajos de teclado (Patronaje 2D)</div><table class="tbl">${ATAJOS.map(([k, d]) => `<tr><td><span class="badge mono">${esc(k)}</span></td><td>${esc(d)}</td></tr>`).join('')}</table></div>
    </div></div>`;
  enhanceSelects(root);
  const b = root.querySelector('#cBuy'); if (b) b.onclick = abrirCompra;
  root.querySelector('#cOut').onclick = cerrarSesion;
  root.querySelector('#cUnit').onchange = (e) => { U.unit = e.target.value; try { localStorage.setItem('hnv.unit', U.unit); } catch {} emit('change', {}); };
  root.querySelector('#cTheme').onchange = (e) => { document.documentElement.dataset.theme = e.target.value; try { localStorage.setItem('hnv.theme', e.target.value); } catch {} };
}

export default { id: 'config', mount, render, onShow: render };
