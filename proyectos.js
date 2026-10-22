// ============================================================
// HiloNova CAD — Proyectos
// ============================================================
import { state, abrir, nuevoProyecto, listarProyectos, cargarProyecto, borrarProyecto, guardarLocal, saveSoon } from '../store.js';
import { icon, h, esc, modal, toast, confirmar, download, slug, enhanceSelects } from '../ui.js';
import { PRENDAS, TABLA_MUJER } from '../../core/blocks.js';
import { projectThumb } from '../render.js';
import { clone, uid } from '../../core/geom.js';
import { cargarLocal } from '../store.js';
import { requiereLicencia } from '../auth.js';

let root;
const PRESETS = {
  mujer: { nombre: 'Mujer S–XL (México)', tabla: TABLA_MUJER },
  mujer6: { nombre: 'Mujer XS–XXL', tabla: (() => { const t = clone(TABLA_MUJER); t.tallas = ['XS', 'S', 'M', 'L', 'XL', 'XXL']; for (const k in t.valores) { const a = t.valores[k]; const d = a[1] - a[0]; t.valores[k] = [a[0] - d, ...a, a[3] + d].map((x) => Math.round(x * 10) / 10); } return t; })() },
  numerica: { nombre: 'Numérica 28–36', tabla: (() => { const t = clone(TABLA_MUJER); t.tallas = ['28', '30', '32', '34', '36']; t.base = '32'; for (const k in t.valores) { const a = t.valores[k]; const d = (a[1] - a[0]) / 1.5; t.valores[k] = [a[1] - d * 2, a[1] - d, a[1], a[1] + d, a[1] + d * 2].map((x) => Math.round(x * 10) / 10); } return t; })() },
};

function mount(el) { root = el; }

async function render() {
  if (!root || !root.classList.contains('on')) return;
  root.innerHTML = `<div class="page"><div class="page-h"><div><h1>Proyectos</h1><p>Cada proyecto guarda la tabla de medidas, las piezas, la graduación, el trazo y la ficha técnica.</p></div>
    <div class="row"><button class="btn" id="pImp">${icon('upload', 'sm')}Importar .hnv</button><button class="btn pri" id="pNew">${icon('plus', 'sm')}Nuevo proyecto</button></div></div>
    <div class="pcards" id="pCards"><div class="card newcard" id="pNew2"><div style="text-align:center">${icon('plus')}<div style="margin-top:8px">Nuevo proyecto</div></div></div></div></div>`;
  root.querySelector('#pNew').onclick = nuevo;
  root.querySelector('#pNew2').onclick = nuevo;
  root.querySelector('#pImp').onclick = importar;
  const lista = await listarProyectos();
  const cards = root.querySelector('#pCards');
  lista.forEach((m) => {
    const local = cargarLocal(m.id);
    const c = h(`<div class="card pcard ${state.p && state.p.id === m.id ? 'on' : ''}">
      <div class="thumb">${local ? projectThumb(local) : icon('cloud')}</div>
      <div class="meta"><b>${esc(m.nombre)}</b><span class="muted">${esc(PRENDAS[m.prenda]?.nombre || 'Libre')} · ${(m.tallas || []).join(' ')} · ${m.piezas ?? ''} piezas</span><br>
      <span class="muted" style="font-size:11.5px">${m.actualizado ? new Date(m.actualizado).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' }) : ''} · ${m.origen === 'nube' ? 'nube' : 'este equipo'}</span></div>
      <div class="acts"><button class="btn icon sm" data-a="dup" title="Duplicar">${icon('copy', 'sm')}</button><button class="btn icon sm danger" data-a="del" title="Eliminar">${icon('trash', 'sm')}</button></div></div>`);
    c.addEventListener('click', async (e) => {
      const a = e.target.closest('[data-a]')?.dataset.a;
      if (a === 'del') {
        if (await confirmar(`¿Eliminar <b>${esc(m.nombre)}</b>? Esta acción no se puede deshacer.`, { ok: 'Eliminar', danger: true })) {
          await borrarProyecto(m.id);
          if (state.p && state.p.id === m.id) { state.p = null; localStorage.removeItem('hnv.last'); }
          render();
        }
        return;
      }
      const p = await cargarProyecto(m);
      if (!p) return toast('No se pudo abrir el proyecto', 'bad');
      if (a === 'dup') { const c2 = clone(p); c2.id = uid('prj'); c2.nombre = p.nombre + ' (copia)'; c2.actualizado = Date.now(); guardarLocal(c2); render(); return; }
      abrir(p); window.hnvGo('editor');
    });
    cards.appendChild(c);
  });
}

function nuevo() {
  const body = h(`<div style="display:flex;flex-direction:column;gap:14px">
    <div class="field"><label>Nombre del proyecto</label><input class="input" name="nombre" value="Blusa clásica BL-001"></div>
    <div class="field"><label>Prenda base</label>
      <div class="grid2" id="prendas">${Object.entries(PRENDAS).map(([k, d], i) => `<label class="card" style="padding:12px;cursor:pointer;display:flex;gap:10px;align-items:flex-start"><input type="radio" name="prenda" value="${k}" ${i === 0 ? 'checked' : ''} style="margin-top:3px;accent-color:var(--accent)"><span><b>${esc(d.nombre)}</b><br><span class="muted" style="font-size:12px">${esc(d.desc)}</span></span></label>`).join('')}
      <label class="card" style="padding:12px;cursor:pointer;display:flex;gap:10px;align-items:flex-start"><input type="radio" name="prenda" value="libre" style="margin-top:3px;accent-color:var(--accent)"><span><b>En blanco</b><br><span class="muted" style="font-size:12px">Dibuja tus propias piezas con las herramientas de trazo.</span></span></label></div></div>
    <div class="field"><label>Tabla de tallas</label><select class="select" name="preset">${Object.entries(PRESETS).map(([k, v]) => `<option value="${k}">${esc(v.nombre)}</option>`).join('')}</select></div>
  </div>`);
  body.querySelectorAll('[name=prenda]').forEach((r) => r.addEventListener('change', () => {
    const n = body.querySelector('[name=nombre]');
    const names = { blusa: 'Blusa clásica BL-001', falda: 'Falda recta FR-001', pantalon: 'Pantalón básico PB-001', libre: 'Proyecto libre' };
    if (Object.values(names).includes(n.value) || !n.value) n.value = names[r.value];
  }));
  modal({ title: 'Nuevo proyecto', body, wide: true, actions: [
    { label: 'Cancelar', cls: 'ghost' },
    { label: 'Crear proyecto', cls: 'pri', icon: 'sparkle', onClick: () => {
      const prenda = body.querySelector('[name=prenda]:checked').value;
      const preset = PRESETS[body.querySelector('[name=preset]').value];
      const p = nuevoProyecto({ nombre: body.querySelector('[name=nombre]').value.trim() || 'Proyecto', prenda, tabla: preset.tabla });
      guardarLocal(p); abrir(p); saveSoon(); window.hnvGo('editor');
      toast(prenda === 'libre' ? 'Proyecto creado. Dibuja tu primera pieza (N o R).' : `${p.piezas.length} piezas generadas y graduadas en ${p.tabla.tallas.length} tallas`, 'ok');
    } },
  ] });
}

function importar() {
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = '.hnv,.json,application/json';
  inp.onchange = async () => {
    const f = inp.files[0]; if (!f) return;
    try {
      const p = JSON.parse(await f.text());
      if (!p.piezas || !p.tabla) throw new Error('Archivo no válido');
      p.id = uid('prj'); p.actualizado = Date.now();
      guardarLocal(p); abrir(p); saveSoon(); window.hnvGo('editor'); toast('Proyecto importado', 'ok');
    } catch (e) { toast('No se pudo importar: ' + e.message, 'bad'); }
  };
  inp.click();
}

export function exportarProyecto() {
  if (!requiereLicencia('exportar el proyecto')) return;
  download(slug(state.p.nombre) + '.hnv', JSON.stringify(state.p), 'application/json');
}

export default { id: 'proyectos', mount, render, onShow: render };
void enhanceSelects;
