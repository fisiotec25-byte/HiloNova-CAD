// ============================================================
// HiloNova CAD — Render SVG de piezas
// ============================================================
import { pathD, polyPathD, segments, pointOnSeg, area, flatten, bbox, cutPolygon, unfoldPolygon, v } from '../core/geom.js';
import { gradedPiece } from '../core/grading.js';
import { esc } from './ui.js';

export function outwardSign(points) { return area(flatten(points).pts) > 0 ? -1 : 1; }

export function notchLines(points, notches, seam) {
  const segs = segments(points, true), sg = outwardSign(points);
  return (notches || []).map((n) => {
    const s = segs[n.seg]; if (!s) return null;
    const { p, tan } = pointOnSeg(s, Math.min(0.9999, Math.max(0.0001, n.t)));
    const nrm = v.mul(v.perp(tan), sg);
    const L = Math.max(4, Math.min(seam || 10, 8));
    return { a: v.add(p, v.mul(nrm, -1.5)), b: v.add(p, v.mul(nrm, L)) };
  }).filter(Boolean);
}

export function pieceCut(piece, pts) {
  return cutPolygon(pts, piece.seam ?? 10, piece.seamEdges || {}, piece.fold);
}

// Devuelve el <g> de una pieza en coordenadas de pieza (sin pos)
export function pieceSVG(piece, o = {}) {
  const g = gradedPiece(piece, o.talla, o.base);
  const pts = g.points;
  const col = o.color || piece.color || '#3aa8ff';
  let s = '';
  if (o.fill !== false) s += `<path class="piece-fill" d="${pathD(pts)}" fill="${col}"/>`;
  if (o.seam !== false) {
    const cut = pieceCut(piece, pts);
    s += `<path class="cut-line" d="${polyPathD(cut)}" stroke="${col}"/>`;
  }
  s += `<path class="piece-line" d="${pathD(pts)}" stroke="${col}"/>`;
  if (o.fold !== false && piece.fold !== null && piece.fold !== undefined && pts[piece.fold]) {
    const a = pts[piece.fold], b = pts[(piece.fold + 1) % pts.length];
    s += `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="${col}" stroke-width="3" vector-effect="non-scaling-stroke" stroke-dasharray="1 5" stroke-linecap="round"/>`;
  }
  if (o.notches !== false) {
    notchLines(pts, piece.notches, piece.seam).forEach((l) => { s += `<line class="notch" x1="${l.a.x}" y1="${l.a.y}" x2="${l.b.x}" y2="${l.b.y}" stroke="${col}"/>`; });
  }
  if (o.internals !== false) {
    (g.internals || []).forEach((it) => {
      if (it.type === 'boton') { const p = it.pts[0]; s += `<circle cx="${p.x}" cy="${p.y}" r="5" fill="none" stroke="${col}" vector-effect="non-scaling-stroke"/><line x1="${p.x - 4}" y1="${p.y}" x2="${p.x + 4}" y2="${p.y}" stroke="${col}" vector-effect="non-scaling-stroke"/>`; }
      else s += `<path class="internal" d="${polyPathD(it.pts, false)}" stroke="${col}"/>`;
    });
  }
  if (o.grain !== false && g.grain && g.grain.length === 2) s += grainSVG(g.grain, col);
  if (o.label) {
    const bb = bbox(flatten(pts).pts);
    const fs = Math.max(9, Math.min(22, Math.min(bb.w, bb.h) / 7));
    const cx = bb.x + bb.w / 2, cy = bb.y + bb.h * 0.32;
    s += `<text x="${cx}" y="${cy}" text-anchor="middle" font-size="${fs}" fill="${col}" font-weight="600">${esc(piece.name)}</text>`;
    s += `<text x="${cx}" y="${cy + fs * 1.25}" text-anchor="middle" font-size="${fs * 0.75}" fill="${col}" opacity=".85">x${piece.qty} ${esc(piece.material || 'Tela')}${o.labelTalla ? ' · ' + esc(o.labelTalla) : ''}</text>`;
  }
  return s;
}

export function grainSVG([a, b], col) {
  const d = v.norm(v.sub(b, a)), n = v.perp(d), k = 9;
  const ar = (p, dir) => { const t1 = v.add(v.sub(p, v.mul(dir, k)), v.mul(n, k * 0.45)), t2 = v.sub(v.sub(p, v.mul(dir, k)), v.mul(n, k * 0.45)); return `M${t1.x} ${t1.y} L${p.x} ${p.y} L${t2.x} ${t2.y}`; };
  return `<line class="grain" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="${col}"/><path class="grain" d="${ar(b, d)} ${ar(a, v.mul(d, -1))}" fill="none" stroke="${col}"/>`;
}

// Miniatura del proyecto (todas las piezas en talla base)
export function projectThumb(p) {
  if (!p || !p.piezas || !p.piezas.length) return '';
  let all = [], body = '';
  for (const pz of p.piezas) {
    const pts = flatten(pz.points).pts.map((q) => ({ x: q.x + pz.pos.x, y: q.y + pz.pos.y }));
    all = all.concat(pts);
    body += `<path d="${polyPathD(pts)}" fill="${pz.color}" fill-opacity=".12" stroke="${pz.color}" stroke-width="1.4" vector-effect="non-scaling-stroke"/>`;
  }
  const bb = bbox(all), m = 30;
  return `<svg viewBox="${bb.x - m} ${bb.y - m} ${bb.w + 2 * m} ${bb.h + 2 * m}" preserveAspectRatio="xMidYMid meet">${body}</svg>`;
}

// Polígono de corte desdoblado (para trazo/exportación)
export function cutPolyFull(piece, pts) {
  let poly = pieceCut(piece, pts);
  if (piece.fold !== null && piece.fold !== undefined && pts[piece.fold]) poly = unfoldPolygon(poly, pts[piece.fold], pts[(piece.fold + 1) % pts.length]);
  return poly;
}
