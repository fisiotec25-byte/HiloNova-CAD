// ============================================================
// HiloNova CAD — Exportación DXF con estructura AAMA/ASTM
// Capas AAMA: 1 contorno de corte · 14 línea de costura · 7 hilo
//             4 piquetes · 8 líneas internas · 13 perforaciones
// Unidades: milímetros. Eje Y invertido (DXF crece hacia arriba).
// ============================================================
import { geomPieza } from './pdf.js';
import { slug } from '../ui.js';
import { colocados, resumen } from '../views/trazo.js';

class DXF {
  constructor() { this.out = []; }
  g(code, val) { this.out.push(String(code), String(val)); }
  polyline(layer, pts, closed = true) {
    this.g(0, 'POLYLINE'); this.g(8, layer); this.g(66, 1); this.g(10, 0); this.g(20, 0); this.g(30, 0); this.g(70, closed ? 1 : 0);
    pts.forEach((p) => { this.g(0, 'VERTEX'); this.g(8, layer); this.g(10, p.x.toFixed(3)); this.g(20, (-p.y).toFixed(3)); this.g(30, 0); });
    this.g(0, 'SEQEND'); this.g(8, layer);
  }
  line(layer, a, b) { this.g(0, 'LINE'); this.g(8, layer); this.g(10, a.x.toFixed(3)); this.g(20, (-a.y).toFixed(3)); this.g(30, 0); this.g(11, b.x.toFixed(3)); this.g(21, (-b.y).toFixed(3)); this.g(31, 0); }
  point(layer, a) { this.g(0, 'POINT'); this.g(8, layer); this.g(10, a.x.toFixed(3)); this.g(20, (-a.y).toFixed(3)); this.g(30, 0); }
  text(layer, a, h, s) { this.g(0, 'TEXT'); this.g(8, layer); this.g(10, a.x.toFixed(3)); this.g(20, (-a.y).toFixed(3)); this.g(30, 0); this.g(40, h); this.g(1, ascii(s)); }
  header() {
    this.g(0, 'SECTION'); this.g(2, 'HEADER');
    this.g(9, '$ACADVER'); this.g(1, 'AC1009');
    this.g(9, '$INSUNITS'); this.g(70, 4);
    this.g(9, '$MEASUREMENT'); this.g(70, 1);
    this.g(0, 'ENDSEC');
    this.g(0, 'SECTION'); this.g(2, 'TABLES');
    this.g(0, 'TABLE'); this.g(2, 'LAYER'); this.g(70, 6);
    [['1', 7], ['14', 8], ['7', 3], ['4', 1], ['8', 5], ['13', 6]].forEach(([n, c]) => { this.g(0, 'LAYER'); this.g(2, n); this.g(70, 0); this.g(62, c); this.g(6, 'CONTINUOUS'); });
    this.g(0, 'ENDTAB'); this.g(0, 'ENDSEC');
  }
  toString() { return this.out.join('\r\n') + '\r\n'; }
}
const ascii = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\x20-\x7E]/g, '');

function pieceBlock(d, p, pz, talla, name) {
  const G = geomPieza(p, pz, talla);
  d.g(0, 'BLOCK'); d.g(8, '1'); d.g(2, name); d.g(70, 0); d.g(10, 0); d.g(20, 0); d.g(30, 0);
  d.polyline('1', G.cut);
  d.polyline('14', G.sew);
  if (G.sewMirror) d.polyline('14', G.sewMirror);
  if (G.grain.length === 2) d.line('7', G.grain[0], G.grain[1]);
  G.notches.forEach((l) => d.line('4', l.a, l.b));
  G.internals.forEach((it) => { if (it.type === 'boton') d.point('13', it.pts[0]); else d.polyline('8', it.pts, false); });
  const tp = { x: G.w * 0.25, y: G.h * 0.55 };
  const corte = pz.fold !== null && pz.fold !== undefined ? 'FOLD' : pz.pair ? 'PAIR' : 'SINGLE';
  [`Piece Name: ${pz.name}`, `Size: ${talla}`, `Quantity: ${pz.qty}`, `Material: ${pz.material || 'Tela'}`, `Cut: ${corte}`, `Style Name: ${p.nombre}`].forEach((t, i) => d.text('1', { x: tp.x, y: tp.y + i * 9 }, 6, t));
  d.g(0, 'ENDBLK'); d.g(8, '1');
  return G;
}

// Exporta piezas: tallas = ['M'] o todas. Las tallas se acomodan en filas.
export function patronDXF(p, { tallas, piezaIds } = {}) {
  const T = tallas && tallas.length ? tallas : p.tabla.tallas;
  const piezas = p.piezas.filter((pz) => !piezaIds || piezaIds.includes(pz.id));
  const d = new DXF(); d.header();
  d.g(0, 'SECTION'); d.g(2, 'BLOCKS');
  const ins = [];
  let y = 0;
  T.forEach((t) => {
    let x = 0, rowH = 0;
    piezas.forEach((pz) => {
      const name = ascii(`${pz.name}_${t}`).replace(/\s+/g, '_').toUpperCase();
      const G = pieceBlock(d, p, pz, t, name);
      ins.push({ name, x, y }); x += G.w + 50; rowH = Math.max(rowH, G.h);
    });
    y += rowH + 120;
  });
  d.g(0, 'ENDSEC');
  d.g(0, 'SECTION'); d.g(2, 'ENTITIES');
  ins.forEach((i) => { d.g(0, 'INSERT'); d.g(8, '1'); d.g(2, i.name); d.g(10, i.x.toFixed(3)); d.g(20, (-i.y).toFixed(3)); d.g(30, 0); });
  d.g(0, 'ENDSEC'); d.g(0, 'EOF');
  return { name: `${slug(p.nombre)}-${T.length > 1 ? 'nido' : 'talla-' + slug(T[0])}.dxf`, data: d.toString() };
}

export function trazoDXF(p) {
  const R = resumen(p); if (!R) throw new Error('Genera el trazo primero');
  const d = new DXF(); d.header();
  d.g(0, 'SECTION'); d.g(2, 'ENTITIES');
  const W = p.trazo.ancho, L = p.trazo.resultado.largo;
  d.polyline('8', [{ x: 0, y: 0 }, { x: L, y: 0 }, { x: L, y: W }, { x: 0, y: W }]);
  colocados(p).forEach((it) => {
    d.polyline('1', it.pts);
    const xs = it.pts.map((q) => q.x), ys = it.pts.map((q) => q.y);
    d.text('1', { x: (Math.min(...xs) + Math.max(...xs)) / 2 - 20, y: (Math.min(...ys) + Math.max(...ys)) / 2 }, 12, `${it.name} ${it.talla}`);
  });
  d.text('8', { x: 0, y: W + 40 }, 20, `${p.nombre} - largo ${(R.largo / 1000).toFixed(3)} m - eficiencia ${(R.eficiencia * 100).toFixed(1)}%`);
  d.g(0, 'ENDSEC'); d.g(0, 'EOF');
  return { name: `${slug(p.nombre)}-trazo.dxf`, data: d.toString() };
}

// SVG 1:1 (mm) de una talla
export function patronSVG(p, talla) {
  const items = p.piezas.map((pz) => ({ pz, G: geomPieza(p, pz, talla) }));
  let x = 20, s = '', H = 0;
  items.forEach(({ pz, G }) => {
    const P = (pts, c = true) => 'M' + pts.map((q) => `${(q.x + x).toFixed(2)} ${(q.y + 20).toFixed(2)}`).join(' L') + (c ? ' Z' : '');
    s += `<g id="${ascii(pz.name).replace(/\s+/g, '_')}"><path d="${P(G.cut)}" fill="none" stroke="${pz.color}" stroke-width="0.5"/><path d="${P(G.sew)}" fill="none" stroke="#888" stroke-width="0.3" stroke-dasharray="2 1.5"/>`;
    if (G.grain.length === 2) s += `<path d="${P(G.grain, false)}" stroke="#333" stroke-width="0.4"/>`;
    G.notches.forEach((l) => { s += `<path d="${P([l.a, l.b], false)}" stroke="${pz.color}" stroke-width="0.4"/>`; });
    s += `<text x="${x + G.w / 2}" y="${20 + G.h / 2}" font-size="10" text-anchor="middle" fill="${pz.color}">${pz.name} ${talla} x${pz.qty}</text></g>`;
    x += G.w + 30; H = Math.max(H, G.h);
  });
  const W = x;
  return { name: `${slug(p.nombre)}-talla-${slug(talla)}.svg`, data: `<svg xmlns="http://www.w3.org/2000/svg" width="${W}mm" height="${H + 40}mm" viewBox="0 0 ${W} ${H + 40}">${s}</svg>` };
}
