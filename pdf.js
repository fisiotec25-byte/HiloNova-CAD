// ============================================================
// HiloNova CAD — Exportación PDF (ficha técnica, patrones 1:1, trazo)
// ============================================================
import { getJsPDF, slug, money } from '../ui.js';
import { gradedPiece } from '../../core/grading.js';
import { flatten, bbox, segments, pointOnSeg, v } from '../../core/geom.js';
import { MEDIDAS, SIZE_COLORS } from '../../core/blocks.js';
import { cutPolyFull, notchLines } from '../render.js';
import { resumen, colocados } from '../views/trazo.js';
import { costeo } from '../views/produccion.js';

const NAVY = [11, 30, 58], BLUE = [30, 120, 210], GRAY = [110, 120, 140], LIGHT = [235, 240, 248];
const PAPEL = { carta: [215.9, 279.4], a4: [210, 297], oficio: [215.9, 340.4] };
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const fecha = () => new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' });

function poly(doc, pts, ox, oy, style = 'S', closed = true) {
  if (pts.length < 2) return;
  const d = [];
  for (let i = 1; i < pts.length; i++) d.push([pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y]);
  doc.lines(d, pts[0].x + ox, pts[0].y + oy, [1, 1], style, closed);
}

// Geometría imprimible de una pieza en una talla (coordenadas con origen en su bbox de corte)
export function geomPieza(p, pz, talla) {
  const g = gradedPiece(pz, talla, p.tabla.base);
  const sew = flatten(g.points, true, 0.4).pts;
  const cut = cutPolyFull(pz, g.points);
  const bb = bbox(cut.concat(sew));
  const sh = (a) => ({ x: a.x - bb.x, y: a.y - bb.y });
  let foldLine = null, sewMirror = null;
  if (pz.fold !== null && pz.fold !== undefined && g.points[pz.fold]) {
    const A = g.points[pz.fold], B = g.points[(pz.fold + 1) % g.points.length];
    foldLine = [sh(A), sh(B)];
    const d = v.norm(v.sub(B, A));
    sewMirror = sew.map((q) => { const ap = v.sub(q, A), pr = v.add(A, v.mul(d, v.dot(ap, d))); return sh({ x: 2 * pr.x - q.x, y: 2 * pr.y - q.y }); });
  }
  return {
    w: bb.w, h: bb.h, cut: cut.map(sh), sew: sew.map(sh), sewMirror, foldLine,
    grain: (g.grain || []).map(sh),
    notches: notchLines(g.points, pz.notches, pz.seam).map((l) => ({ a: sh(l.a), b: sh(l.b) })),
    internals: (g.internals || []).map((it) => ({ ...it, pts: it.pts.map(sh) })),
  };
}

function drawPiece(doc, p, pz, talla, G, ox, oy, { color = true, labels = true } = {}) {
  const col = color ? hex(pz.color || '#000000') : [0, 0, 0];
  // línea de costura
  doc.setDrawColor(...GRAY); doc.setLineWidth(0.2); doc.setLineDashPattern([1.6, 1.2], 0);
  poly(doc, G.sew, ox, oy);
  if (G.sewMirror) poly(doc, G.sewMirror, ox, oy);
  doc.setLineDashPattern([], 0);
  // línea de corte
  doc.setDrawColor(...col); doc.setLineWidth(0.45);
  poly(doc, G.cut, ox, oy);
  // doblez
  if (G.foldLine) {
    doc.setLineDashPattern([4, 1.5, 0.8, 1.5], 0); doc.setLineWidth(0.35);
    doc.line(G.foldLine[0].x + ox, G.foldLine[0].y + oy, G.foldLine[1].x + ox, G.foldLine[1].y + oy);
    doc.setLineDashPattern([], 0);
    const m = v.lerp(G.foldLine[0], G.foldLine[1], 0.5);
    const ang = Math.atan2(G.foldLine[1].y - G.foldLine[0].y, G.foldLine[1].x - G.foldLine[0].x) * 180 / Math.PI;
    doc.setFontSize(8); doc.setTextColor(...col);
    doc.text('DOBLEZ DE TELA', m.x + ox + 3, m.y + oy, { angle: -ang, align: 'center' });
  }
  // piquetes
  doc.setLineWidth(0.35); doc.setDrawColor(...col);
  G.notches.forEach((l) => doc.line(l.a.x + ox, l.a.y + oy, l.b.x + ox, l.b.y + oy));
  // líneas internas
  doc.setLineWidth(0.25); doc.setLineDashPattern([2, 1.2], 0);
  G.internals.forEach((it) => {
    if (it.type === 'boton') { doc.setLineDashPattern([], 0); doc.circle(it.pts[0].x + ox, it.pts[0].y + oy, 1.6, 'S'); doc.setLineDashPattern([2, 1.2], 0); }
    else poly(doc, it.pts, ox, oy, 'S', false);
  });
  doc.setLineDashPattern([], 0);
  // hilo
  if (G.grain.length === 2) {
    const [a, b] = G.grain, d = v.norm(v.sub(b, a)), n = v.perp(d);
    doc.setLineWidth(0.35);
    doc.line(a.x + ox, a.y + oy, b.x + ox, b.y + oy);
    [[b, d], [a, v.mul(d, -1)]].forEach(([p0, dir]) => {
      const t1 = v.add(v.sub(p0, v.mul(dir, 5)), v.mul(n, 2.2)), t2 = v.sub(v.sub(p0, v.mul(dir, 5)), v.mul(n, 2.2));
      doc.line(t1.x + ox, t1.y + oy, p0.x + ox, p0.y + oy); doc.line(t2.x + ox, t2.y + oy, p0.x + ox, p0.y + oy);
    });
  }
  if (labels) {
    const cx = G.w / 2 + ox, cy = G.h * 0.38 + oy;
    const fs = Math.max(6, Math.min(16, Math.min(G.w, G.h) / 9));
    doc.setTextColor(...col); doc.setFont('helvetica', 'bold'); doc.setFontSize(fs);
    doc.text(pz.name.toUpperCase(), cx, cy, { align: 'center' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(fs * 0.62); doc.setTextColor(40, 50, 70);
    const corte = pz.fold !== null && pz.fold !== undefined ? 'al doblez' : pz.pair ? 'en pares' : '';
    doc.text(`Talla ${talla}  ·  Cortar ${pz.qty} ${corte}  ·  ${pz.material || 'Tela'}`, cx, cy + fs * 0.55, { align: 'center' });
    doc.text(`${p.nombre}${p.ficha?.referencia ? ' · ' + p.ficha.referencia : ''}`, cx, cy + fs * 0.95, { align: 'center' });
  }
}

// Gira 90° la geometría imprimible (para piezas más largas que el rollo)
function rotG(G) {
  const r = (q) => ({ x: G.h - q.y, y: q.x });
  return { ...G, w: G.h, h: G.w, cut: G.cut.map(r), sew: G.sew.map(r), sewMirror: G.sewMirror && G.sewMirror.map(r), foldLine: G.foldLine && G.foldLine.map(r), grain: G.grain.map(r), notches: G.notches.map((l) => ({ a: r(l.a), b: r(l.b) })), internals: G.internals.map((it) => ({ ...it, pts: it.pts.map(r) })) };
}

// Acomodo simple en renglones para impresión
function shelf(items, W, gap = 12) {
  let x = 0, y = 0, rowH = 0;
  items.sort((a, b) => b.G.h - a.G.h);
  items.forEach((it) => {
    if (x > 0 && x + it.G.w > W) { x = 0; y += rowH + gap; rowH = 0; }
    it.x = x; it.y = y; x += it.G.w + gap; rowH = Math.max(rowH, it.G.h);
  });
  return { w: Math.max(...items.map((i) => i.x + i.G.w)), h: y + rowH };
}

function testSquare(doc, x, y) {
  doc.setDrawColor(0); doc.setLineWidth(0.3); doc.rect(x, y, 50, 50);
  doc.setFontSize(7); doc.setTextColor(0);
  doc.text('Cuadro de control', x + 25, y + 22, { align: 'center' });
  doc.text('5 cm x 5 cm', x + 25, y + 27, { align: 'center' });
  doc.text('Mide antes de cortar', x + 25, y + 32, { align: 'center' });
}

// ---------- Patrón 1:1 ----------
export async function patronPDF(p, { talla, piezaIds, papel = 'carta', modo = 'mosaico', anchoRollo = 914, color = true }) {
  const jsPDF = await getJsPDF();
  const items = p.piezas.filter((pz) => !piezaIds || piezaIds.includes(pz.id)).map((pz) => ({ pz, G: geomPieza(p, pz, talla) }));
  if (!items.length) throw new Error('Selecciona al menos una pieza');
  const m = 8; // margen de impresión
  if (modo === 'plotter') {
    const W = anchoRollo - 2 * m;
    const big = items.filter((i) => Math.min(i.G.w, i.G.h) > W);
    if (big.length) throw new Error('El rollo es más angosto que: ' + big.map((b) => b.pz.name).join(', '));
    items.forEach((i) => { if (i.G.w > W) i.G = rotG(i.G); });
    const L = shelf(items, W, 15);
    const doc = new jsPDF({ unit: 'mm', format: [anchoRollo, L.h + 2 * m + 60], orientation: 'portrait' });
    doc.setFontSize(10); doc.setTextColor(...NAVY);
    doc.text(`${p.nombre} · Talla ${talla} · Escala 1:1 · ${fecha()}`, m, m + 4);
    testSquare(doc, anchoRollo - m - 50, m);
    items.forEach((i) => drawPiece(doc, p, i.pz, talla, i.G, i.x + m, i.y + m + 60, { color }));
    doc.save(`${slug(p.nombre)}-talla-${slug(talla)}-plotter.pdf`);
    return { paginas: 1 };
  }
  // mosaico en hojas
  const [PW, PH] = PAPEL[papel] || PAPEL.carta;
  const aw = PW - 2 * m, ah = PH - 2 * m - 6;
  const L = shelf(items, aw * 3 - 10, 12);
  const cols = Math.ceil(L.w / aw), rows = Math.ceil(L.h / ah);
  const doc = new jsPDF({ unit: 'mm', format: [PW, PH] });
  // portada / índice
  doc.setFillColor(...NAVY); doc.rect(0, 0, PW, 26, 'F');
  doc.setTextColor(255); doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.text('PATRÓN A ESCALA 1:1', m, 12);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.text(`${p.nombre} · Talla ${talla} · ${items.length} piezas · ${cols * rows} hojas ${papel.toUpperCase()}`, m, 19);
  doc.setTextColor(...NAVY); doc.setFontSize(10);
  const ins = ['1. Imprime al 100% (tamaño real). Desactiva "Ajustar a página".', '2. Mide el cuadro de control: debe medir 5 x 5 cm exactos.', '3. Recorta el margen y une las hojas haciendo coincidir las marcas de las esquinas.', '4. Las hojas se nombran por fila (letra) y columna (número), igual que el mapa.', '5. Línea continua = corte · línea punteada = costura · flecha = hilo de la tela.'];
  ins.forEach((t, i) => doc.text(t, m, 36 + i * 6));
  testSquare(doc, PW - m - 50, 34);
  // mapa de hojas
  const mapW = PW - 2 * m, mapH = PH - 110;
  const k = Math.min(mapW / (cols * aw), mapH / (rows * ah));
  const mx = m, my = 92;
  doc.setDrawColor(...GRAY); doc.setLineWidth(0.2);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    doc.rect(mx + c * aw * k, my + r * ah * k, aw * k, ah * k);
    doc.setFontSize(9); doc.setTextColor(...GRAY);
    doc.text(String.fromCharCode(65 + r) + (c + 1), mx + c * aw * k + 2, my + r * ah * k + 5);
  }
  items.forEach((i) => { doc.setDrawColor(...hex(i.pz.color)); doc.setLineWidth(0.3); poly(doc, i.G.cut.map((q) => ({ x: (q.x + i.x) * k, y: (q.y + i.y) * k })), mx, my); doc.setFontSize(7); doc.setTextColor(...hex(i.pz.color)); doc.text(i.pz.name, mx + (i.x + i.G.w / 2) * k, my + (i.y + i.G.h / 2) * k, { align: 'center' }); });
  // hojas
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    doc.addPage([PW, PH]);
    const ox = m - c * aw, oy = m - r * ah;
    doc.saveGraphicsState();
    doc.rect(m, m, aw, ah, null); doc.clip(); doc.discardPath();
    items.forEach((i) => drawPiece(doc, p, i.pz, talla, i.G, i.x + ox, i.y + oy, { color }));
    doc.restoreGraphicsState();
    // marco y marcas de unión
    doc.setDrawColor(150); doc.setLineWidth(0.15); doc.setLineDashPattern([1, 1], 0); doc.rect(m, m, aw, ah); doc.setLineDashPattern([], 0);
    doc.setDrawColor(0); doc.setLineWidth(0.25);
    [[m, m], [m + aw, m], [m, m + ah], [m + aw, m + ah]].forEach(([x, y]) => { doc.circle(x, y, 2.5, 'S'); doc.line(x - 4, y, x + 4, y); doc.line(x, y - 4, x, y + 4); });
    doc.setFontSize(9); doc.setTextColor(...NAVY);
    const id = String.fromCharCode(65 + r) + (c + 1);
    doc.text(`Hoja ${id}  ·  ${p.nombre}  ·  Talla ${talla}  ·  1:1`, m, PH - m + 1);
    doc.setFontSize(7); doc.setTextColor(...GRAY);
    if (c < cols - 1) doc.text('une con ' + String.fromCharCode(65 + r) + (c + 2) + ' (derecha)', m + aw - 1, m + ah / 2, { align: 'right' });
    if (r < rows - 1) doc.text('une con ' + String.fromCharCode(66 + r) + (c + 1) + ' (abajo)', m + aw / 2, m + ah - 1, { align: 'center' });
  }
  doc.save(`${slug(p.nombre)}-talla-${slug(talla)}-${papel}.pdf`);
  return { paginas: cols * rows + 1 };
}

// ---------- Trazo ----------
export async function trazoPDF(p, { modo = 'resumen' } = {}) {
  const jsPDF = await getJsPDF();
  const R = resumen(p); if (!R) throw new Error('Genera el trazo primero');
  const pl = colocados(p), W = p.trazo.ancho, L = p.trazo.resultado.largo;
  const sc = (t) => hex(SIZE_COLORS[p.tabla.tallas.indexOf(t) % SIZE_COLORS.length]);
  if (modo === 'plotter') {
    const m = 10;
    const doc = new jsPDF({ unit: 'mm', format: [W + 2 * m + 20, L + 2 * m + 30], orientation: 'portrait' });
    // largo hacia abajo: rotamos el trazo (x->y)
    doc.setFontSize(12); doc.setTextColor(...NAVY);
    doc.text(`${p.nombre} · Trazo ${p.trazo.tela} · ${(R.largo / 1000).toFixed(3)} m · eficiencia ${(R.eficiencia * 100).toFixed(1)}%`, m, m + 4);
    doc.setDrawColor(...GRAY); doc.rect(m, m + 20, W, L);
    pl.forEach((it) => {
      doc.setDrawColor(...sc(it.talla)); doc.setLineWidth(0.4);
      poly(doc, it.pts.map((q) => ({ x: q.y, y: q.x })), m, m + 20);
      const b = bbox(it.pts); doc.setFontSize(9); doc.setTextColor(...sc(it.talla));
      doc.text(`${it.name} ${it.talla}`, m + b.y + b.h / 2, m + 20 + b.x + b.w / 2, { align: 'center' });
    });
    doc.save(`${slug(p.nombre)}-trazo-1a1.pdf`); return;
  }
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' });
  const PW = 297, m = 12;
  doc.setFillColor(...NAVY); doc.rect(0, 0, PW, 24, 'F');
  doc.setTextColor(255); doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.text('TRAZO DE CORTE', m, 11);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.text(`${p.nombre} · ${p.trazo.tela} · ${fecha()}`, m, 18);
  const stats = [['Largo', (R.largo / 1000).toFixed(3) + ' m'], ['Ancho útil', (W / 10).toFixed(1) + ' cm'], ['Eficiencia', (R.eficiencia * 100).toFixed(1) + ' %'], ['Consumo/prenda', (R.consumoProm / 1000).toFixed(3) + ' m'], ['Prendas', String(R.prendas)], ['Piezas', String(R.piezas)]];
  stats.forEach(([k, val], i) => { const x = m + i * 46; doc.setFillColor(...LIGHT); doc.roundedRect(x, 30, 43, 16, 2, 2, 'F'); doc.setFontSize(7.5); doc.setTextColor(...GRAY); doc.text(k, x + 3, 35); doc.setFontSize(12); doc.setTextColor(...NAVY); doc.setFont('helvetica', 'bold'); doc.text(val, x + 3, 42.5); doc.setFont('helvetica', 'normal'); });
  const k = Math.min((PW - 2 * m) / L, 110 / W);
  const oy = 56;
  doc.setDrawColor(...GRAY); doc.setLineWidth(0.2); doc.rect(m, oy, L * k, W * k);
  pl.forEach((it) => { doc.setDrawColor(...sc(it.talla)); doc.setLineWidth(0.25); poly(doc, it.pts.map((q) => ({ x: q.x * k, y: q.y * k })), m, oy); });
  for (let x = 0; x <= L; x += 500) { doc.setFontSize(6.5); doc.setTextColor(...GRAY); doc.text((x / 1000).toFixed(1) + ' m', m + x * k, oy - 1.5, { align: 'center' }); }
  let y = oy + W * k + 10;
  doc.setFontSize(10); doc.setTextColor(...NAVY); doc.setFont('helvetica', 'bold'); doc.text('Consumo estimado por talla', m, y); doc.setFont('helvetica', 'normal');
  y += 6;
  Object.entries(R.porTalla).forEach(([t, x2], i) => { doc.setFillColor(...sc(t)); doc.rect(m + i * 45, y - 3, 3, 3, 'F'); doc.setFontSize(9); doc.setTextColor(40); doc.text(`${t}: ${(x2.consumo / 1000).toFixed(3)} m · ${p.trazo.cantidades[t]} pz`, m + i * 45 + 5, y); });
  doc.save(`${slug(p.nombre)}-trazo.pdf`);
}

// ---------- Ficha técnica ----------
function table(doc, x, y, widths, rows, { head = true, fs = 8.5, zebra = true, maxY = 285 } = {}) {
  const rh = fs * 0.62 + 2.6;
  const body = head ? rows.slice(1) : rows;
  const isNum = (c) => /^[\d$.,%\s+-]+(m|cm|min|h)?$/.test(String(c ?? '').trim()) && String(c ?? '').trim() !== '';
  const right = widths.map((_, j) => j > 0 && body.length > 0 && body.every((r) => isNum(r[j]) || String(r[j] ?? '').trim() === '' || String(r[j]).trim() === '—'));
  rows.forEach((r, i) => {
    if (y + rh > maxY) { doc.addPage(); y = 16; }
    const isH = head && i === 0;
    if (isH) { doc.setFillColor(...NAVY); doc.rect(x, y, widths.reduce((a, b) => a + b, 0), rh, 'F'); }
    else if (zebra && i % 2 === 0) { doc.setFillColor(...LIGHT); doc.rect(x, y, widths.reduce((a, b) => a + b, 0), rh, 'F'); }
    let cx = x;
    r.forEach((cell, j) => {
      doc.setFont('helvetica', isH ? 'bold' : 'normal'); doc.setFontSize(fs); doc.setTextColor(...(isH ? [255, 255, 255] : [30, 40, 60]));
      const s = String(cell ?? '');
      doc.text(doc.splitTextToSize(s, widths[j] - 3)[0] || '', right[j] ? cx + widths[j] - 2 : cx + 2, y + rh - 2.2, { align: right[j] ? 'right' : 'left' });
      cx += widths[j];
    });
    y += rh;
  });
  return y;
}
function sectionTitle(doc, t, x, y) { doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...BLUE); doc.text(t.toUpperCase(), x, y); doc.setDrawColor(...BLUE); doc.setLineWidth(0.4); doc.line(x, y + 1.5, x + 186, y + 1.5); doc.setFont('helvetica', 'normal'); return y + 7; }

export async function fichaPDF(p) {
  const jsPDF = await getJsPDF();
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const f = p.ficha, m = 12, base = p.tabla.base, C = costeo(p), R = resumen(p);
  // encabezado
  doc.setFillColor(...NAVY); doc.rect(0, 0, 210, 30, 'F');
  doc.setTextColor(255); doc.setFont('helvetica', 'bold'); doc.setFontSize(17); doc.text('FICHA TÉCNICA', m, 13);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.text(`${p.nombre}${f.referencia ? ' · Ref. ' + f.referencia : ''}`, m, 21);
  doc.setFontSize(8.5); doc.text(fecha(), 198, 13, { align: 'right' }); doc.text('HiloNova CAD', 198, 21, { align: 'right' });
  let y = 40;
  y = sectionTitle(doc, 'Datos generales', m, y);
  const dg = [['Referencia', f.referencia || '—', 'Temporada', f.temporada || '—'], ['Descripción', f.descripcion || p.nombre, 'Cliente / marca', f.cliente || '—'], ['Tela', f.tela || '—', 'Composición', f.composicion || '—'], ['Colores', f.color || '—', 'Tallas', p.tabla.tallas.join(' · ') + ` (base ${base})`]];
  y = table(doc, m, y, [28, 65, 30, 63], dg, { head: false });
  y += 6;
  y = sectionTitle(doc, `Patrón · talla base ${base}`, m, y);
  // dibujo de piezas
  const items = p.piezas.map((pz) => ({ pz, G: geomPieza(p, pz, base) }));
  const L = shelf(items, 2200, 40);
  const boxH = 92, k = Math.min(186 / L.w, boxH / L.h);
  doc.setFillColor(248, 250, 253); doc.rect(m, y, 186, boxH + 4, 'F');
  items.forEach((i) => {
    doc.setDrawColor(...hex(i.pz.color)); doc.setLineWidth(0.3);
    poly(doc, i.G.cut.map((q) => ({ x: (q.x + i.x) * k, y: (q.y + i.y) * k })), m + (186 - L.w * k) / 2, y + 2);
    doc.setDrawColor(...GRAY); doc.setLineDashPattern([0.8, 0.8], 0); doc.setLineWidth(0.15);
    poly(doc, i.G.sew.map((q) => ({ x: (q.x + i.x) * k, y: (q.y + i.y) * k })), m + (186 - L.w * k) / 2, y + 2); doc.setLineDashPattern([], 0);
    doc.setFontSize(6.5); doc.setTextColor(...hex(i.pz.color));
    doc.text(`${i.pz.name} x${i.pz.qty}`, m + (186 - L.w * k) / 2 + (i.x + i.G.w / 2) * k, y + 2 + (i.y + i.G.h / 2) * k, { align: 'center' });
  });
  y += boxH + 10;
  y = sectionTitle(doc, 'Piezas', m, y);
  y = table(doc, m, y, [56, 30, 20, 40, 40], [['Pieza', 'Material', 'Cant.', 'Corte', 'Margen'], ...p.piezas.map((x) => [x.name, x.material || 'Tela', String(x.qty), x.fold !== null && x.fold !== undefined ? 'Al doblez' : x.pair ? 'En pares' : 'Sencillo', ((x.seam ?? 10) / 10).toFixed(1) + ' cm'])]);
  // página 2
  doc.addPage(); y = 16;
  y = sectionTitle(doc, 'Tabla de medidas (cm)', m, y);
  const keys = Object.keys(p.tabla.valores).filter((k2) => MEDIDAS[k2]);
  const used = { blusa: ['busto', 'cintura', 'cadera', 'cuello', 'espalda', 'hombro', 'talleEsp', 'talleDel', 'largoBlusa', 'largoManga', 'brazo', 'puno'], falda: ['cintura', 'cadera', 'altCadera', 'largoFalda'], pantalon: ['cintura', 'cadera', 'altCadera', 'tiro', 'largoPant', 'rodilla', 'bajo'] }[p.prenda] || keys;
  const tw = (186 - 60) / p.tabla.tallas.length;
  y = table(doc, m, y, [60, ...p.tabla.tallas.map(() => tw)], [['Medida', ...p.tabla.tallas], ...used.map((k2) => [MEDIDAS[k2].label, ...p.tabla.valores[k2].map((x) => (+x).toFixed(1))])]);
  y += 6;
  y = sectionTitle(doc, 'Consumo y trazo', m, y);
  y = table(doc, m, y, [60, 63, 63], [['Concepto', 'Valor', 'Nota'],
    ['Ancho útil de tela', (p.trazo.ancho / 10).toFixed(1) + ' cm', `Orilla ${(p.trazo.orilla / 10).toFixed(1)} cm`],
    ['Largo de trazo', R ? (R.largo / 1000).toFixed(3) + ' m' : '—', R ? `${R.prendas} prendas · ${R.piezas} piezas` : 'Sin trazo'],
    ['Eficiencia', R ? (R.eficiencia * 100).toFixed(1) + ' %' : '—', ''],
    ['Consumo por prenda', C.consumo.toFixed(3) + ' m', C.fuente],
    ...(R ? Object.entries(R.porTalla).map(([t, x]) => [`Consumo talla ${t}`, (x.consumo / 1000).toFixed(3) + ' m', '']) : [])]);
  y += 6;
  y = sectionTitle(doc, 'Costeo por prenda (MXN)', m, y);
  y = table(doc, m, y, [123, 63], [['Concepto', 'Importe'], ['Tela con merma', money(C.tela)], ...(f.avios || []).map((a) => [`${a.desc} (${a.cant} x ${money(+a.costo)})`, money(a.cant * a.costo)]), [`Mano de obra (${C.minutos.toFixed(1)} min x ${money(+f.costoMinuto)})`, money(C.mo)], [`Indirectos (${f.indirectos}%)`, money(C.ind)], ['COSTO TOTAL', money(C.costo)], [`PRECIO SUGERIDO (margen ${f.margen}%)`, money(C.precio)]]);
  y += 6;
  y = sectionTitle(doc, 'Operaciones de confección', m, y);
  y = table(doc, m, y, [20, 126, 40], [['#', 'Operación', 'Minutos'], ...(f.operaciones || []).map((o, i) => [String(i + 1), o.op, (+o.min).toFixed(1)]), ['', 'Tiempo estándar total', C.minutos.toFixed(1)]]);
  if (f.notas) { y += 6; if (y > 250) { doc.addPage(); y = 16; } y = sectionTitle(doc, 'Notas de confección', m, y); doc.setFontSize(9); doc.setTextColor(40); doc.text(doc.splitTextToSize(f.notas, 186), m, y); y += 14; }
  if (y > 255) { doc.addPage(); y = 20; }
  y = Math.max(y + 14, 262);
  ['Patronista', 'Producción', 'Calidad'].forEach((t, i) => { const x = m + i * 64; doc.setDrawColor(...GRAY); doc.line(x, y, x + 56, y); doc.setFontSize(8); doc.setTextColor(...GRAY); doc.text(t, x + 28, y + 4.5, { align: 'center' }); });
  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) { doc.setPage(i); doc.setFontSize(7.5); doc.setTextColor(...GRAY); doc.text(`${p.nombre} · página ${i} de ${n}`, 105, 292, { align: 'center' }); }
  doc.save(`${slug(p.nombre)}-ficha-tecnica.pdf`);
}

void segments; void pointOnSeg;
