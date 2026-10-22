// ============================================================
// HiloNova CAD — Operaciones sobre piezas
// ============================================================
import { v, uid, clone, segments, splitBez, bbox, flatten, autoHandles } from './geom.js';
import { interpolateRuleForNew } from './grading.js';

// Inserta un punto en el tramo segIdx a la fracción t
export function insertPoint(piece, segIdx, t) {
  const pts = piece.points, n = pts.length;
  const s = segments(pts, true)[segIdx];
  const a = pts[segIdx], b = pts[(segIdx + 1) % n];
  let np;
  if (s.curve) {
    const { left, right } = splitBez(s.a, s.c1, s.c2, s.b, t);
    const m = left[3];
    np = { id: uid('pt'), name: 'Punto', x: m.x, y: m.y, h1: v.sub(left[2], m), h2: v.sub(right[1], m) };
    if (a.h2 || b.h1) { a.h2 = v.sub(left[1], a); b.h1 = v.sub(right[2], b); }
  } else {
    const m = v.lerp(a, b, t);
    np = { id: uid('pt'), name: 'Punto', x: m.x, y: m.y };
  }
  pts.splice(segIdx + 1, 0, np);
  interpolateRuleForNew(piece, np.id, a.id, b.id, t);
  // reacomodar piquetes, márgenes y doblez
  piece.notches = (piece.notches || []).map((no) => {
    if (no.seg > segIdx) return { ...no, seg: no.seg + 1 };
    if (no.seg === segIdx) return no.t <= t ? { ...no, t: no.t / t } : { seg: segIdx + 1, t: (no.t - t) / (1 - t) };
    return no;
  });
  piece.seamEdges = shiftKeys(piece.seamEdges, (k) => (k > segIdx ? k + 1 : k), segIdx, segIdx + 1);
  if (piece.fold !== null && piece.fold !== undefined && piece.fold > segIdx) piece.fold += 1;
  return segIdx + 1;
}

function shiftKeys(obj = {}, f, dupFrom = null, dupTo = null) {
  const o = {};
  for (const k in obj) o[f(+k)] = obj[k];
  if (dupFrom !== null && obj[dupFrom] !== undefined) o[dupTo] = obj[dupFrom];
  return o;
}

export function deletePoint(piece, idx) {
  const pts = piece.points, n = pts.length;
  if (n <= 3) return false;
  const id = pts[idx].id;
  pts.splice(idx, 1);
  const prev = (idx - 1 + n) % n;
  const merged = prev > idx ? prev - 1 : prev;
  piece.notches = (piece.notches || []).map((no) => {
    if (no.seg === idx || no.seg === prev) return { seg: merged, t: no.seg === prev ? no.t * 0.5 : 0.5 + no.t * 0.5 };
    if (no.seg > idx) return { ...no, seg: no.seg - 1 };
    return no;
  });
  const se = {};
  for (const k in piece.seamEdges || {}) { const kk = +k; if (kk === idx) continue; se[kk > idx ? kk - 1 : kk] = piece.seamEdges[k]; }
  piece.seamEdges = se;
  if (piece.fold !== null && piece.fold !== undefined) { if (piece.fold === idx || piece.fold === prev) piece.fold = null; else if (piece.fold > idx) piece.fold -= 1; }
  void merged;
  for (const t in piece.rules || {}) delete piece.rules[t][id];
  return true;
}

export function toggleSmooth(piece, idx) {
  const p = piece.points[idx];
  if (p.h1 || p.h2) { delete p.h1; delete p.h2; }
  else autoHandles(piece.points, idx, true, 0.33);
  for (const t in piece.rules || {}) { const r = piece.rules[t][p.id]; if (r) { delete r.dh1; delete r.dh2; } }
}

// Espejo horizontal manteniendo el sentido horario de los puntos
export function flipPiece(piece) {
  const n = piece.points.length;
  const bb = bbox(flatten(piece.points).pts), cx = bb.x + bb.w / 2;
  const fx = (x) => 2 * cx - x;
  const pts = piece.points.map((p) => {
    const q = { ...p, x: fx(p.x) };
    const h1 = p.h2 ? { x: -p.h2.x, y: p.h2.y } : null, h2 = p.h1 ? { x: -p.h1.x, y: p.h1.y } : null;
    delete q.h1; delete q.h2; if (h1) q.h1 = h1; if (h2) q.h2 = h2;
    return q;
  }).reverse();
  piece.points = pts;
  const mapSeg = (i) => ((n - 2 - i) % n + n) % n;
  piece.notches = (piece.notches || []).map((no) => ({ seg: mapSeg(no.seg), t: 1 - no.t }));
  piece.seamEdges = shiftKeys(piece.seamEdges, mapSeg);
  if (piece.fold !== null && piece.fold !== undefined) piece.fold = mapSeg(piece.fold);
  piece.grain = (piece.grain || []).map((g) => ({ x: fx(g.x), y: g.y }));
  piece.internals = (piece.internals || []).map((it) => ({ ...it, pts: it.pts.map((g) => ({ x: fx(g.x), y: g.y })) }));
  for (const t in piece.rules || {}) for (const id in piece.rules[t]) {
    const r = piece.rules[t][id]; r.dx = -r.dx;
    const d1 = r.dh1, d2 = r.dh2; delete r.dh1; delete r.dh2;
    if (d2) r.dh1 = { x: -d2.x, y: d2.y }; if (d1) r.dh2 = { x: -d1.x, y: d1.y };
  }
}

export function rotatePiece(piece, ang) {
  const bb = bbox(flatten(piece.points).pts), c = { x: bb.x + bb.w / 2, y: bb.y + bb.h / 2 };
  const R = (p) => v.add(c, v.rot(v.sub(p, c), ang));
  piece.points = piece.points.map((p) => {
    const q = { ...p, ...R(p) };
    if (p.h1) q.h1 = v.rot(p.h1, ang); if (p.h2) q.h2 = v.rot(p.h2, ang);
    return q;
  });
  piece.grain = (piece.grain || []).map(R);
  piece.internals = (piece.internals || []).map((it) => ({ ...it, pts: it.pts.map(R) }));
  for (const t in piece.rules || {}) for (const id in piece.rules[t]) {
    const r = piece.rules[t][id];
    const d = v.rot({ x: r.dx, y: r.dy }, ang); r.dx = d.x; r.dy = d.y;
    if (r.dh1) r.dh1 = v.rot(r.dh1, ang); if (r.dh2) r.dh2 = v.rot(r.dh2, ang);
  }
}

export function newPiece(pts, { name = 'Pieza nueva', color = '#3aa8ff', qty = 1 } = {}) {
  // asegurar sentido horario (área positiva en Y-abajo)
  let area = 0;
  for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; area += p.x * q.y - q.x * p.y; }
  const P = area < 0 ? pts.slice().reverse() : pts.slice();
  const bb = bbox(P);
  const points = P.map((p, i) => ({ id: uid('pt'), name: 'P' + (i + 1), x: p.x - bb.x, y: p.y - bb.y }));
  const grainX = bb.w / 2;
  return {
    id: uid('pz'), key: uid('k'), name, qty, pair: false, color, material: 'Tela', seam: 10, seamEdges: {}, fold: null,
    points, grain: [{ x: grainX, y: bb.h * 0.2 }, { x: grainX, y: bb.h * 0.8 }], notches: [], internals: [],
    pos: { x: bb.x, y: bb.y }, rules: {}, visible: true,
  };
}

export function duplicatePiece(piece) {
  const c = clone(piece);
  c.id = uid('pz'); c.key = uid('k'); c.name = piece.name + ' (copia)';
  const map = {};
  c.points.forEach((p) => { const nid = uid('pt'); map[p.id] = nid; p.id = nid; });
  for (const t in c.rules || {}) { const R = {}; for (const id in c.rules[t]) R[map[id] || id] = c.rules[t][id]; c.rules[t] = R; }
  const bb = bbox(flatten(piece.points).pts);
  c.pos = { x: piece.pos.x + bb.w + 60, y: piece.pos.y };
  return c;
}

// Agrega o quita margen a todo el contorno (convierte la línea de costura en línea de corte, etc.)
export const PIECE_COLORS = ['#3aa8ff', '#47c38f', '#f0a03c', '#c86dd7', '#e86a7a', '#3fc1c9', '#8b7bff', '#d4c64a', '#5b8def', '#ef7d57'];
