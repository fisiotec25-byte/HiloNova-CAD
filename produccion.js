// ============================================================
// HiloNova CAD — Ficha técnica y costeo de producción
// ============================================================
import { state, commit } from '../store.js';
import { icon, esc, money, toast, fmtLen, unitLbl } from '../ui.js';
import { resumen } from './trazo.js';
import { requiereLicencia } from '../auth.js';
import { fichaPDF } from '../export/pdf.js';

let root;
function mount(el) { root = el; }

export function costeo(p) {
  const f = p.ficha, R = resumen(p);
  const consumo = f.consumoManual ? +f.consumoManual : R ? R.consumoProm / 1000 : 0; // m por prenda
  const tela = consumo * (1 + (f.merma || 0) / 100) * (+f.precioTela || 0);
  const avios = (f.avios || []).reduce((s, a) => s + (+a.cant || 0) * (+a.costo || 0), 0);
  const minutos = (f.operaciones || []).reduce((s, o) => s + (+o.min || 0), 0);
  const mo = minutos * (+f.costoMinuto || 0);
  const directo = tela + avios + mo;
  const ind = directo * ((+f.indirectos || 0) / 100);
  const costo = directo + ind;
  const precio = (+f.margen || 0) < 100 ? costo / (1 - (+f.margen || 0) / 100) : costo;
  return { consumo, tela, avios, minutos, mo, directo, ind, costo, precio, fuente: f.consumoManual ? 'manual' : R ? 'trazo' : 'sin trazo' };
}

function render() {
  if (!root || !root.classList.contains('on') || !state.p) return;
  const p = state.p, f = p.ficha, C = costeo(p), R = resumen(p);
  f.lote = f.lote || 100;
  const lote = +f.lote || 0;
  root.innerHTML = `<div class="page">
    <div class="page-h"><div><h1>Ficha técnica y costeo</h1><p>Datos de producción, costo por prenda y planeación de lote. El consumo de tela viene del último trazo.</p></div>
      <button class="btn pri" id="fPdf">${icon('download', 'sm')}Ficha técnica PDF${state.session.licencia ? '' : ' ' + icon('lock', 'sm lock')}</button></div>
    <div class="grid4" style="margin-bottom:14px">
      <div class="kpi"><small>Costo por prenda</small><b>${money(C.costo)}</b></div>
      <div class="kpi"><small>Precio sugerido (${f.margen}% margen)</small><b style="color:var(--ok)">${money(C.precio)}</b></div>
      <div class="kpi"><small>Consumo de tela</small><b>${C.consumo.toFixed(3)}<em>m · ${C.fuente}</em></b></div>
      <div class="kpi"><small>Tiempo estándar</small><b>${C.minutos.toFixed(1)}<em>min</em></b></div>
    </div>
    <div class="grid2" style="align-items:start">
      <div style="display:flex;flex-direction:column;gap:14px">
        <div class="card"><div class="card-h">Datos generales</div><div class="card-b grid2">
          ${[['referencia', 'Referencia'], ['descripcion', 'Descripción'], ['temporada', 'Temporada / colección'], ['cliente', 'Cliente / marca'], ['tela', 'Tela'], ['composicion', 'Composición'], ['color', 'Colores']].map(([k, l]) => `<div class="field"><label>${l}</label><input class="input" data-f="${k}" value="${esc(f[k] || '')}"></div>`).join('')}
          <div class="field" style="grid-column:1/-1"><label>Notas de confección</label><textarea class="input" rows="3" data-f="notas">${esc(f.notas || '')}</textarea></div>
        </div></div>
        <div class="card"><div class="card-h">Piezas del modelo <span class="muted">${p.piezas.length}</span></div>
          <div style="overflow:auto"><table class="tbl"><tr><th>Pieza</th><th>Material</th><th class="num">Cant.</th><th>Corte</th><th class="num">Margen (${unitLbl()})</th></tr>
          ${p.piezas.map((x) => `<tr><td><i class="dot" style="--c:${x.color}"></i> ${esc(x.name)}</td><td>${esc(x.material || 'Tela')}</td><td class="num">${x.qty}</td><td>${x.fold !== null && x.fold !== undefined ? 'Al doblez' : x.pair ? 'En pares' : 'Sencillo'}</td><td class="num">${fmtLen(x.seam ?? 10)}</td></tr>`).join('')}</table></div></div>
      </div>
      <div style="display:flex;flex-direction:column;gap:14px">
        <div class="card"><div class="card-h">Tela</div><div class="card-b grid3">
          <div class="field"><label>Precio por metro</label><input class="input num" type="number" step="0.5" data-f="precioTela" value="${f.precioTela}"></div>
          <div class="field"><label>Merma de tendido %</label><input class="input num" type="number" step="0.5" data-f="merma" value="${f.merma}"></div>
          <div class="field"><label>Consumo manual (m)</label><input class="input num" type="number" step="0.01" data-f="consumoManual" value="${f.consumoManual || ''}" placeholder="${R ? (R.consumoProm / 1000).toFixed(3) : 'del trazo'}"></div>
          <div style="grid-column:1/-1" class="row"><span class="muted">Costo de tela por prenda</span><b class="mono" style="margin-left:auto">${money(C.tela)}</b></div>
        </div></div>
        <div class="card"><div class="card-h">Avíos <button class="btn sm" data-add="avios">${icon('plus', 'sm')}Agregar</button></div>
          <table class="tbl"><tr><th>Descripción</th><th class="num">Cant.</th><th class="num">Costo unit.</th><th class="num">Subtotal</th><th></th></tr>
          ${(f.avios || []).map((a, i) => `<tr><td><input class="input" data-l="avios" data-i="${i}" data-k="desc" value="${esc(a.desc)}"></td><td style="width:80px"><input class="input num" type="number" step="0.01" data-l="avios" data-i="${i}" data-k="cant" value="${a.cant}"></td><td style="width:100px"><input class="input num" type="number" step="0.1" data-l="avios" data-i="${i}" data-k="costo" value="${a.costo}"></td><td class="num">${money((+a.cant || 0) * (+a.costo || 0))}</td><td><button class="btn icon sm ghost" data-rm="avios" data-i="${i}">${icon('x', 'sm')}</button></td></tr>`).join('')}
          <tr><td colspan="3" class="muted">Total avíos</td><td class="num"><b>${money(C.avios)}</b></td><td></td></tr></table></div>
        <div class="card"><div class="card-h">Operaciones de confección <button class="btn sm" data-add="operaciones">${icon('plus', 'sm')}Agregar</button></div>
          <table class="tbl"><tr><th>Operación</th><th class="num">Minutos</th><th></th></tr>
          ${(f.operaciones || []).map((o, i) => `<tr><td><input class="input" data-l="operaciones" data-i="${i}" data-k="op" value="${esc(o.op)}"></td><td style="width:100px"><input class="input num" type="number" step="0.1" data-l="operaciones" data-i="${i}" data-k="min" value="${o.min}"></td><td><button class="btn icon sm ghost" data-rm="operaciones" data-i="${i}">${icon('x', 'sm')}</button></td></tr>`).join('')}</table>
          <div class="card-b grid3" style="border-top:1px solid var(--line)">
            <div class="field"><label>Costo por minuto</label><input class="input num" type="number" step="0.05" data-f="costoMinuto" value="${f.costoMinuto}"></div>
            <div class="field"><label>Indirectos %</label><input class="input num" type="number" step="1" data-f="indirectos" value="${f.indirectos}"></div>
            <div class="field"><label>Margen %</label><input class="input num" type="number" step="1" data-f="margen" value="${f.margen}"></div>
          </div></div>
        <div class="card"><div class="card-h">Resumen de costo</div><table class="tbl">
          <tr><td>Tela (con merma)</td><td class="num">${money(C.tela)}</td></tr><tr><td>Avíos</td><td class="num">${money(C.avios)}</td></tr>
          <tr><td>Mano de obra (${C.minutos.toFixed(1)} min)</td><td class="num">${money(C.mo)}</td></tr><tr><td>Indirectos</td><td class="num">${money(C.ind)}</td></tr>
          <tr><td><b>Costo total</b></td><td class="num"><b>${money(C.costo)}</b></td></tr><tr><td><b>Precio sugerido</b></td><td class="num"><b style="color:var(--ok)">${money(C.precio)}</b></td></tr></table></div>
        <div class="card"><div class="card-h">Planeación de lote</div><div class="card-b">
          <div class="row"><div class="field" style="width:140px"><label>Prendas del lote</label><input class="input num" type="number" step="1" data-f="lote" value="${lote}"></div></div>
          <div class="grid2" style="margin-top:12px">
            <div class="kpi"><small>Tela necesaria</small><b>${(C.consumo * (1 + (f.merma || 0) / 100) * lote).toFixed(1)}<em>m</em></b></div>
            <div class="kpi"><small>Horas de confección</small><b>${((C.minutos * lote) / 60).toFixed(1)}<em>h</em></b></div>
            <div class="kpi"><small>Costo del lote</small><b>${money(C.costo * lote)}</b></div>
            <div class="kpi"><small>Venta estimada</small><b>${money(C.precio * lote)}</b></div>
          </div></div></div>
      </div>
    </div></div>`;
  root.querySelectorAll('[data-f]').forEach((inp) => inp.addEventListener('change', () => {
    const k = inp.dataset.f;
    f[k] = inp.type === 'number' ? (inp.value === '' ? '' : +inp.value) : inp.value;
    commit('Ficha');
  }));
  root.querySelectorAll('[data-l]').forEach((inp) => inp.addEventListener('change', () => {
    const row = f[inp.dataset.l][+inp.dataset.i];
    row[inp.dataset.k] = inp.type === 'number' ? +inp.value : inp.value; commit('Ficha');
  }));
  root.querySelectorAll('[data-add]').forEach((b) => b.addEventListener('click', () => {
    const l = b.dataset.add; f[l] = f[l] || [];
    f[l].push(l === 'avios' ? { desc: 'Nuevo avío', cant: 1, costo: 0 } : { op: 'Nueva operación', min: 1 }); commit('Ficha');
  }));
  root.querySelectorAll('[data-rm]').forEach((b) => b.addEventListener('click', () => { f[b.dataset.rm].splice(+b.dataset.i, 1); commit('Ficha'); }));
  root.querySelector('#fPdf').onclick = async () => {
    if (!requiereLicencia('descargar la ficha técnica')) return;
    try { await fichaPDF(p); toast('Ficha técnica descargada', 'ok'); } catch (e) { console.error(e); toast('No se pudo generar el PDF: ' + e.message, 'bad'); }
  };
}

export default { id: 'produccion', mount, render, onShow: render };
