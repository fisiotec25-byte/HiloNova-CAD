// ============================================================
// HiloNova CAD — Centro de exportación
// ============================================================
import { state } from '../store.js';
import { icon, esc, toast, download, enhanceSelects, slug } from '../ui.js';
import { requiereLicencia } from '../auth.js';
import { patronPDF, trazoPDF, fichaPDF } from '../export/pdf.js';
import { patronDXF, trazoDXF, patronSVG } from '../export/dxf.js';
import { resumen } from './trazo.js';

let root;
const opt = { talla: null, papel: 'carta', rollo: 914, piezas: null, color: true };
function mount(el) { root = el; }

function render() {
  if (!root || !root.classList.contains('on') || !state.p) return;
  const p = state.p, lic = state.session.licencia;
  if (!opt.talla || !p.tabla.tallas.includes(opt.talla)) opt.talla = state.ui.talla || p.tabla.base;
  if (!opt.piezas) opt.piezas = new Set(p.piezas.map((x) => x.id));
  const R = resumen(p);
  const lock = lic ? '' : ' ' + icon('lock', 'sm lock');
  const card = (ic, t, d, btns) => `<div class="card"><div class="card-b" style="display:flex;gap:14px;align-items:flex-start">
    <div style="width:42px;height:42px;border-radius:11px;display:grid;place-items:center;background:var(--accent-soft);color:var(--accent);flex:none">${icon(ic)}</div>
    <div style="flex:1"><b style="font-size:14px">${t}</b><p class="muted" style="margin:4px 0 12px;line-height:1.5">${d}</p><div class="row wrap">${btns}</div></div></div></div>`;
  root.innerHTML = `<div class="page">
    <div class="page-h"><div><h1>Exportar</h1><p>Lleva tu trabajo al plotter, a la impresora de casa o a otros sistemas CAD.</p></div></div>
    <div class="card" style="margin-bottom:14px"><div class="card-b grid4">
      <div class="field"><label>Talla</label><select class="select" id="eT">${p.tabla.tallas.map((t) => `<option ${t === opt.talla ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></div>
      <div class="field"><label>Papel para mosaico</label><select class="select" id="eP">${[['carta', 'Carta'], ['a4', 'A4'], ['oficio', 'Oficio']].map(([k, l]) => `<option value="${k}" ${opt.papel === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
      <div class="field"><label>Ancho de rollo de plotter</label><select class="select" id="eR">${[[610, '61 cm'], [914, '91.4 cm'], [1067, '106.7 cm'], [1500, '150 cm'], [1800, '180 cm']].map(([k, l]) => `<option value="${k}" ${opt.rollo == k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
      <div class="field"><label>Color</label><select class="select" id="eC"><option value="1" ${opt.color ? 'selected' : ''}>Color por pieza</option><option value="0" ${!opt.color ? 'selected' : ''}>Blanco y negro</option></select></div>
      <div style="grid-column:1/-1"><label class="muted" style="font-size:11.5px">Piezas</label><div class="row wrap" style="margin-top:6px">${p.piezas.map((x) => `<label class="check" style="padding:5px 10px;border:1px solid var(--line);border-radius:8px"><input type="checkbox" data-pz="${x.id}" ${opt.piezas.has(x.id) ? 'checked' : ''}><i class="dot" style="--c:${x.color}"></i>${esc(x.name)}</label>`).join('')}</div></div>
    </div></div>
    <div class="grid2">
      ${card('file', 'Patrón 1:1 en hojas (mosaico)', 'PDF a tamaño real en hojas Carta, A4 u Oficio con mapa de armado, marcas de unión y cuadro de control de 5 cm. Ideal para imprimir en casa.', `<button class="btn pri" data-x="mosaico">${icon('download', 'sm')}Descargar PDF${lock}</button>`)}
      ${card('layers', 'Patrón 1:1 para plotter', 'PDF de una sola hoja al ancho de tu rollo, con todas las piezas de la talla elegida, rótulos, hilo, piquetes y doblez.', `<button class="btn pri" data-x="plotter">${icon('download', 'sm')}Descargar PDF${lock}</button>`)}
      ${card('grade', 'DXF-AAMA (sistemas CAD)', 'Bloques por pieza con capas AAMA (1 corte, 14 costura, 7 hilo, 4 piquetes, 8 internas, 13 perforaciones) y textos de pieza, talla y cantidad. Valida la importación en tu versión de software.', `<button class="btn pri" data-x="dxf">${icon('download', 'sm')}Talla elegida${lock}</button><button class="btn" data-x="dxfnido">${icon('download', 'sm')}Todas las tallas${lock}</button>`)}
      ${card('marker', 'Trazo de corte', R ? `Largo ${(R.largo / 1000).toFixed(3)} m · eficiencia ${(R.eficiencia * 100).toFixed(1)}%. Resumen en A4, a escala 1:1 para plotter, o DXF.` : 'Genera primero el trazo en la sección Trazo.', `<button class="btn pri" data-x="trazo" ${R ? '' : 'disabled'}>${icon('download', 'sm')}Resumen PDF${lock}</button><button class="btn" data-x="trazo11" ${R ? '' : 'disabled'}>PDF 1:1${lock}</button><button class="btn" data-x="trazodxf" ${R ? '' : 'disabled'}>DXF${lock}</button>`)}
      ${card('factory', 'Ficha técnica', 'Datos generales, dibujo del patrón, piezas, tabla de medidas, consumo, costeo y operaciones con firmas de liberación.', `<button class="btn pri" data-x="ficha">${icon('download', 'sm')}Descargar PDF${lock}</button>`)}
      ${card('folder', 'Proyecto y vectores', 'Respaldo completo del proyecto (.hnv) para abrirlo en otro equipo, o SVG a escala en milímetros para otros programas.', `<button class="btn pri" data-x="hnv">${icon('download', 'sm')}Proyecto .hnv${lock}</button><button class="btn" data-x="svg">${icon('download', 'sm')}SVG talla elegida${lock}</button>`)}
    </div></div>`;
  enhanceSelects(root);
  root.querySelector('#eT').onchange = (e) => { opt.talla = e.target.value; };
  root.querySelector('#eP').onchange = (e) => { opt.papel = e.target.value; };
  root.querySelector('#eR').onchange = (e) => { opt.rollo = +e.target.value; };
  root.querySelector('#eC').onchange = (e) => { opt.color = e.target.value === '1'; };
  root.querySelectorAll('[data-pz]').forEach((c) => c.addEventListener('change', () => { c.checked ? opt.piezas.add(c.dataset.pz) : opt.piezas.delete(c.dataset.pz); }));
  root.querySelectorAll('[data-x]').forEach((b) => b.addEventListener('click', () => exportar(b.dataset.x, b)));
}

async function exportar(kind, btn) {
  const p = state.p;
  if (!requiereLicencia('exportar archivos')) return;
  const ids = [...opt.piezas];
  btn.disabled = true;
  try {
    if (kind === 'mosaico') { const r = await patronPDF(p, { talla: opt.talla, piezaIds: ids, papel: opt.papel, color: opt.color }); toast(`PDF listo: ${r.paginas} páginas`, 'ok'); }
    if (kind === 'plotter') { await patronPDF(p, { talla: opt.talla, piezaIds: ids, modo: 'plotter', anchoRollo: opt.rollo, color: opt.color }); toast('PDF para plotter listo', 'ok'); }
    if (kind === 'dxf') { const r = patronDXF(p, { tallas: [opt.talla], piezaIds: ids }); download(r.name, r.data, 'application/dxf'); toast('DXF exportado', 'ok'); }
    if (kind === 'dxfnido') { const r = patronDXF(p, { piezaIds: ids }); download(r.name, r.data, 'application/dxf'); toast('DXF con todas las tallas exportado', 'ok'); }
    if (kind === 'trazo') { await trazoPDF(p); toast('Trazo exportado', 'ok'); }
    if (kind === 'trazo11') { await trazoPDF(p, { modo: 'plotter' }); toast('Trazo 1:1 exportado', 'ok'); }
    if (kind === 'trazodxf') { const r = trazoDXF(p); download(r.name, r.data, 'application/dxf'); toast('Trazo DXF exportado', 'ok'); }
    if (kind === 'ficha') { await fichaPDF(p); toast('Ficha técnica exportada', 'ok'); }
    if (kind === 'hnv') { download(slug(p.nombre) + '.hnv', JSON.stringify(p), 'application/json'); toast('Proyecto exportado', 'ok'); }
    if (kind === 'svg') { const r = patronSVG(p, opt.talla); download(r.name, r.data, 'image/svg+xml'); toast('SVG exportado', 'ok'); }
  } catch (e) { console.error(e); toast(e.message || 'No se pudo exportar', 'bad', 5000); }
  btn.disabled = false;
}

export default { id: 'exportar', mount, render, onShow: render };
