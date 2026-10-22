// ============================================================
// HiloNova CAD — Graduación por reglas (estilo tabla de reglas industrial)
// Cada pieza guarda su geometría en la talla base y reglas por punto:
//   rules[talla][pointId] = {dx, dy, dh1?, dh2?}  (mm, relativo a la base)
// ============================================================
import { v, clone, bbox, flatten, segments, segLength, cutPolygon, unfoldPolygon, area } from './geom.js';

export function gradedPoints(piece, talla, base) {
  if (!talla || talla === base || !piece.rules || !piece.rules[talla]) return piece.points;
  const R = piece.rules[talla];
  return piece.points.map((p) => {
    const r = R[p.id];
    if (!r) return p;
    const q = { ...p, x: p.x + (r.dx || 0), y: p.y + (r.dy || 0) };
    if (p.h1) q.h1 = r.dh1 ? { x: p.h1.x + r.dh1.x, y: p.h1.y + r.dh1.y } : { ...p.h1 };
    if (p.h2) q.h2 = r.dh2 ? { x: p.h2.x + r.dh2.x, y: p.h2.y + r.dh2.y } : { ...p.h2 };
    return q;
  });
}

// Mapa afín de bbox base -> bbox talla (para hilo, piquetes internos, líneas internas)
function bboxMap(basePts, sizePts) {
  const A = bbox(flatten(basePts).pts), B = bbox(flatten(sizePts).pts);
  const sx = A.w ? B.w / A.w : 1, sy = A.h ? B.h / A.h : 1;
  return (p) => ({ x: B.x + (p.x - A.x) * sx, y: B.y + (p.y - A.y) * sy });
}

export function gradedPiece(piece, talla, base) {
  const pts = gradedPoints(piece, talla, base);
  if (pts === piece.points) return { points: pts, grain: piece.grain, internals: piece.internals };
  const map = bboxMap(piece.points, pts);
  return {
    points: pts,
    grain: (piece.grain || []).map(map),
    internals: (piece.internals || []).map((it) => ({ ...it, pts: it.pts.map(map) })),
  };
}

export function setRule(piece, talla, pointId, dx, dy) {
  piece.rules = piece.rules || {};
  piece.rules[talla] = piece.rules[talla] || {};
  const r = piece.rules[talla][pointId] || {};
  r.dx = dx; r.dy = dy;
  piece.rules[talla][pointId] = r;
}

// Copia la regla de un punto a otros (como "copiar regla" en sistemas CAD)
export function copyRule(piece, tallas, fromId, toIds, { flipX = false, flipY = false } = {}) {
  for (const t of tallas) {
    const r = piece.rules?.[t]?.[fromId];
    if (!r) continue;
    for (const id of toIds) setRule(piece, t, id, flipX ? -r.dx : r.dx, flipY ? -r.dy : r.dy);
  }
}

// Graduación proporcional: incremento total horizontal/vertical por paso de talla,
// repartido según la distancia de cada punto al punto ancla.
export function reglaProporcional(piece, tabla, { anclaId, incX = 10, incY = 5 }) {
  const pts = piece.points;
  const ancla = pts.find((p) => p.id === anclaId) || pts[0];
  const bb = bbox(flatten(pts).pts);
  const bi = tabla.tallas.indexOf(tabla.base);
  piece.rules = {};
  tabla.tallas.forEach((t, i) => {
    if (t === tabla.base) return;
    const k = i - bi;
    const R = {};
    for (const p of pts) {
      const fx = bb.w ? (p.x - ancla.x) / bb.w : 0, fy = bb.h ? (p.y - ancla.y) / bb.h : 0;
      R[p.id] = { dx: fx * incX * k, dy: fy * incY * k };
    }
    piece.rules[t] = R;
  });
}

// Limpia reglas de puntos borrados y agrega reglas cero para puntos nuevos
export function syncRules(piece, tallas, base) {
  piece.rules = piece.rules || {};
  for (const t of tallas) {
    if (t === base) continue;
    const R = piece.rules[t] || (piece.rules[t] = {});
    const ids = new Set(piece.points.map((p) => p.id));
    for (const id of Object.keys(R)) if (!ids.has(id)) delete R[id];
  }
  for (const t of Object.keys(piece.rules)) if (!tallas.includes(t) || t === base) delete piece.rules[t];
}

// Al insertar un punto en un tramo, su regla se interpola de los vecinos
export function interpolateRuleForNew(piece, newId, prevId, nextId, t) {
  for (const talla of Object.keys(piece.rules || {})) {
    const R = piece.rules[talla];
    const a = R[prevId] || { dx: 0, dy: 0 }, b = R[nextId] || { dx: 0, dy: 0 };
    R[newId] = { dx: a.dx + (b.dx - a.dx) * t, dy: a.dy + (b.dy - a.dy) * t };
  }
}

// ---------- Medición de costuras ----------
export function rangeLen(piece, talla, base, fromId, toId) {
  const pts = gradedPoints(piece, talla, base);
  const segs = segments(pts, true), n = pts.length;
  let i = pts.findIndex((p) => p.id === fromId);
  const end = pts.findIndex((p) => p.id === toId);
  if (i < 0 || end < 0) return NaN;
  let L = 0, g = 0;
  while (i !== end && g++ <= n) { L += segLength(segs[i]); i = (i + 1) % n; }
  return L;
}

export function evaluarCostura(proyecto, c, talla) {
  const base = proyecto.tabla.base;
  const sum = (lado) => lado.reduce((s, r) => {
    const pz = proyecto.piezas.find((p) => p.key === r.p || p.id === r.p);
    if (!pz) return NaN;
    return s + (r.k || 1) * rangeLen(pz, talla, base, r.from, r.to);
  }, 0);
  const A = sum(c.a), B = sum(c.b);
  const dif = A - B;
  const ok = Math.abs(dif - (c.esperado || 0)) <= (c.tol ?? 3);
  return { A, B, dif, ok };
}

// ---------- Datos de pieza para trazo y reportes ----------
// Polígono de corte (con margen y desdoblado si va al doblez)
export function piezaCorte(piece, talla, base) {
  const pts = gradedPoints(piece, talla, base);
  let poly = cutPolygon(pts, piece.seam ?? 10, piece.seamEdges || {}, piece.fold);
  if (piece.fold !== null && piece.fold !== undefined && pts[piece.fold]) {
    const A = pts[piece.fold], B = pts[(piece.fold + 1) % pts.length];
    poly = unfoldPolygon(poly, A, B);
  }
  return poly;
}

export function piezaArea(piece, talla, base) {
  return Math.abs(area(piezaCorte(piece, talla, base)));
}

// Ángulo del hilo (para alinearlo al largo de la tela)
export function grainAngle(piece) {
  const g = piece.grain;
  if (!g || g.length < 2) return Math.PI / 2;
  return Math.atan2(g[1].y - g[0].y, g[1].x - g[0].x);
}
