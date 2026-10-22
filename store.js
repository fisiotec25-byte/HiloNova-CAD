// ============================================================
// HiloNova CAD — Estado, deshacer/rehacer y guardado
// ============================================================
import { clone, uid } from '../core/geom.js';
import { construirPrenda, TABLA_MUJER, PRENDAS } from '../core/blocks.js';
import { syncRules } from '../core/grading.js';
import { debounce } from './ui.js';

const listeners = {};
export const on = (ev, fn) => { (listeners[ev] = listeners[ev] || []).push(fn); };
export const emit = (ev, d) => (listeners[ev] || []).forEach((f) => f(d));

export const state = {
  p: null,           // proyecto abierto
  ui: {
    view: 'proyectos', talla: null, selPieza: null, selPunto: null, selSeg: null,
    tool: 'select', showSizes: {}, snap: 1, showSeam: true, showLabels: true,
  },
  session: { user: null, licencia: false, demo: true },
};

const undo = [], redo = [];
let lastSnap = null;

export function nuevoProyecto({ nombre, prenda = 'blusa', tabla = null }) {
  const t = clone(tabla || TABLA_MUJER);
  const p = {
    id: uid('prj'), nombre: nombre || 'Proyecto sin nombre', prenda, version: 1,
    creado: Date.now(), actualizado: Date.now(),
    tabla: t, holguras: { ...(PRENDAS[prenda]?.holguras || { busto: 8, cintura: 6, cadera: 4, embebido: 1.5 }) },
    piezas: [], costuras: [],
    config: { seam: 10 },
    trazo: { ancho: 1500, orilla: 10, separacion: 2, res: 5, sentido: 'dos', tiempo: 6, tela: 'Tela', cantidades: Object.fromEntries(t.tallas.map((s) => [s, 1])), resultado: null },
    ficha: {
      referencia: '', descripcion: '', temporada: '', cliente: '', tela: '', composicion: '', color: '', notas: '',
      precioTela: 85, costoMinuto: 1.2, indirectos: 15, margen: 35, merma: 3,
      avios: [{ desc: 'Botones', cant: 7, costo: 1.5 }, { desc: 'Hilo', cant: 1, costo: 4 }, { desc: 'Entretela (m)', cant: 0.15, costo: 40 }, { desc: 'Etiqueta', cant: 1, costo: 2 }],
      operaciones: [{ op: 'Unir hombros', min: 1.2 }, { op: 'Pegar cuello', min: 4.5 }, { op: 'Pegar mangas', min: 3.5 }, { op: 'Cerrar costados', min: 2.5 }, { op: 'Pegar puños', min: 4 }, { op: 'Bastillas', min: 2.5 }, { op: 'Ojales y botones', min: 3 }, { op: 'Planchado y empaque', min: 3 }],
    },
    checklist: {},
  };
  if (PRENDAS[prenda]) {
    const r = construirPrenda(prenda, p.tabla, p.holguras);
    p.piezas = r.pieces; p.costuras = r.costuras;
    if (prenda !== 'blusa') { p.ficha.operaciones = [{ op: 'Pinzas', min: 1.5 }, { op: 'Cerrar costados', min: 2.5 }, { op: 'Cierre', min: 4 }, { op: 'Pretina', min: 4 }, { op: 'Bastilla', min: 2.5 }, { op: 'Planchado y empaque', min: 2.5 }]; p.ficha.avios = [{ desc: 'Cierre', cant: 1, costo: 6 }, { desc: 'Botón', cant: 1, costo: 1.5 }, { desc: 'Hilo', cant: 1, costo: 4 }, { desc: 'Etiqueta', cant: 1, costo: 2 }]; }
  }
  return p;
}

export function regenerar(p) {
  const r = construirPrenda(p.prenda, p.tabla, p.holguras);
  // conserva posiciones de piezas existentes por clave
  const oldPos = Object.fromEntries(p.piezas.map((x) => [x.key, x.pos]));
  r.pieces.forEach((x) => { if (oldPos[x.key]) x.pos = oldPos[x.key]; });
  p.piezas = r.pieces; p.costuras = r.costuras;
  p.trazo.resultado = null;
}

export function abrir(p) {
  state.p = p;
  undo.length = 0; redo.length = 0;
  lastSnap = JSON.stringify(p);
  state.ui.talla = p.tabla.base;
  state.ui.selPieza = p.piezas[0]?.id || null;
  state.ui.selPunto = null;
  state.ui.showSizes = Object.fromEntries(p.tabla.tallas.map((t) => [t, true]));
  p.tabla.tallas.forEach((t) => { if (p.trazo.cantidades[t] === undefined) p.trazo.cantidades[t] = 1; });
  emit('open', p); emit('change', { all: true });
}

// Registra un cambio: guarda instantánea previa para deshacer
export function commit(label = '') {
  if (!state.p) return;
  if (lastSnap) { undo.push(lastSnap); if (undo.length > 80) undo.shift(); }
  redo.length = 0;
  state.p.actualizado = Date.now();
  lastSnap = JSON.stringify(state.p);
  emit('change', { label });
  saveSoon();
}

export function mutate(label, fn) { fn(state.p); state.p.piezas.forEach((pz) => syncRules(pz, state.p.tabla.tallas, state.p.tabla.base)); commit(label); }

export function doUndo() {
  if (!undo.length) return false;
  redo.push(lastSnap);
  lastSnap = undo.pop();
  restore(lastSnap); return true;
}
export function doRedo() {
  if (!redo.length) return false;
  undo.push(lastSnap);
  lastSnap = redo.pop();
  restore(lastSnap); return true;
}
function restore(json) {
  const sel = state.ui.selPieza;
  state.p = JSON.parse(json);
  if (!state.p.piezas.find((x) => x.id === sel)) state.ui.selPieza = state.p.piezas[0]?.id || null;
  state.ui.selPunto = null;
  emit('change', { all: true, undo: true }); saveSoon();
}
export const canUndo = () => undo.length > 0;
export const canRedo = () => redo.length > 0;

export const pieza = (id = state.ui.selPieza) => state.p?.piezas.find((x) => x.id === id) || null;

// ---------- Persistencia local + nube ----------
const LS_INDEX = 'hnv.index', LS_P = 'hnv.p.';
let cloud = null;
export function setCloud(adapter) { cloud = adapter; }

export function listaLocal() { try { return JSON.parse(localStorage.getItem(LS_INDEX) || '[]'); } catch { return []; } }
function setIndex(arr) { try { localStorage.setItem(LS_INDEX, JSON.stringify(arr)); } catch {} }

export function guardarLocal(p) {
  try { localStorage.setItem(LS_P + p.id, JSON.stringify(p)); } catch (e) { console.warn('localStorage lleno', e); }
  const idx = listaLocal().filter((x) => x.id !== p.id);
  idx.unshift({ id: p.id, nombre: p.nombre, prenda: p.prenda, actualizado: p.actualizado, tallas: p.tabla.tallas, piezas: p.piezas.length });
  setIndex(idx);
}
export function cargarLocal(id) { try { return JSON.parse(localStorage.getItem(LS_P + id)); } catch { return null; } }
export function borrarLocal(id) { localStorage.removeItem(LS_P + id); setIndex(listaLocal().filter((x) => x.id !== id)); }

export const saveState = { status: 'guardado', at: 0 };
const _save = debounce(async () => {
  if (!state.p) return;
  guardarLocal(state.p);
  if (cloud && state.session.licencia) {
    saveState.status = 'sincronizando'; emit('save', saveState);
    try { await cloud.save(state.p); saveState.status = 'nube'; }
    catch (e) { console.warn(e); saveState.status = 'local'; }
  } else saveState.status = 'local';
  saveState.at = Date.now(); emit('save', saveState);
}, 900);
export function saveSoon() { saveState.status = 'pendiente'; emit('save', saveState); _save(); }

export async function listarProyectos() {
  const local = listaLocal();
  if (!cloud || !state.session.licencia) return local.map((x) => ({ ...x, origen: 'local' }));
  try {
    const remote = await cloud.list();
    const map = new Map(local.map((x) => [x.id, { ...x, origen: 'local' }]));
    remote.forEach((r) => { const l = map.get(r.id); if (!l || (r.actualizado || 0) >= (l.actualizado || 0)) map.set(r.id, { ...r, origen: 'nube' }); });
    return [...map.values()].sort((a, b) => (b.actualizado || 0) - (a.actualizado || 0));
  } catch (e) { console.warn(e); return local.map((x) => ({ ...x, origen: 'local' })); }
}
export async function cargarProyecto(meta) {
  if (meta.origen === 'nube' && cloud) { const p = await cloud.load(meta.id); if (p) { guardarLocal(p); return p; } }
  return cargarLocal(meta.id);
}
export async function borrarProyecto(id) { borrarLocal(id); if (cloud && state.session.licencia) { try { await cloud.remove(id); } catch {} } }
