// ============================================================
// HiloNova CAD — Motor geométrico
// Unidades internas: milímetros. Eje X a la derecha, Y hacia abajo.
// Un punto de patrón: {id, name, x, y, h1?:{x,y}, h2?:{x,y}}
// h1 = manija de entrada (relativa al punto), h2 = manija de salida.
// El tramo i -> i+1 es curva cúbica si p[i].h2 o p[i+1].h1 existen.
// ============================================================

export const EPS = 1e-9;

export const v = {
  add: (a, b) => ({ x: a.x + b.x, y: a.y + b.y }),
  sub: (a, b) => ({ x: a.x - b.x, y: a.y - b.y }),
  mul: (a, k) => ({ x: a.x * k, y: a.y * k }),
  len: (a) => Math.hypot(a.x, a.y),
  dist: (a, b) => Math.hypot(a.x - b.x, a.y - b.y),
  norm: (a) => { const l = Math.hypot(a.x, a.y) || 1; return { x: a.x / l, y: a.y / l }; },
  perp: (a) => ({ x: -a.y, y: a.x }),
  lerp: (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }),
  dot: (a, b) => a.x * b.x + a.y * b.y,
  cross: (a, b) => a.x * b.y - a.y * b.x,
  rot: (a, ang) => { const c = Math.cos(ang), s = Math.sin(ang); return { x: a.x * c - a.y * s, y: a.x * s + a.y * c }; },
};

export const uid = (p = 'id') => p + '_' + Math.random().toString(36).slice(2, 9);
export const clone = (o) => JSON.parse(JSON.stringify(o));
export const round = (n, d = 1) => { const k = Math.pow(10, d); return Math.round(n * k) / k; };

// ---------- Bezier ----------
export function bez(p0, c1, c2, p3, t) {
  const u = 1 - t;
  return {
    x: u * u * u * p0.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * p3.x,
    y: u * u * u * p0.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * p3.y,
  };
}

// Divide un cúbico en t (de Casteljau). Devuelve {left:[p0,c1,c2,m], right:[m,c1,c2,p3]}
export function splitBez(p0, c1, c2, p3, t) {
  const a = v.lerp(p0, c1, t), b = v.lerp(c1, c2, t), c = v.lerp(c2, p3, t);
  const d = v.lerp(a, b, t), e = v.lerp(b, c, t), m = v.lerp(d, e, t);
  return { left: [p0, a, d, m], right: [m, e, c, p3] };
}

// Devuelve los segmentos de una pieza (cerrada) con puntos de control absolutos.
export function segments(points, closed = true) {
  const segs = [];
  const n = points.length;
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const a = points[i], b = points[(i + 1) % n];
    const curve = !!(a.h2 || b.h1);
    segs.push({
      i, j: (i + 1) % n, a, b, curve,
      c1: a.h2 ? { x: a.x + a.h2.x, y: a.y + a.h2.y } : { x: a.x, y: a.y },
      c2: b.h1 ? { x: b.x + b.h1.x, y: b.y + b.h1.y } : { x: b.x, y: b.y },
    });
  }
  return segs;
}

// Aplana un segmento a polilínea (incluye punto inicial, excluye final)
export function flattenSeg(s, tol = 0.6) {
  if (!s.curve) return [{ x: s.a.x, y: s.a.y }];
  const approx = v.dist(s.a, s.c1) + v.dist(s.c1, s.c2) + v.dist(s.c2, s.b);
  const n = Math.max(4, Math.min(160, Math.ceil(approx / (tol * 6))));
  const out = [];
  for (let k = 0; k < n; k++) out.push(bez(s.a, s.c1, s.c2, s.b, k / n));
  return out;
}

export function segLength(s) {
  if (!s.curve) return v.dist(s.a, s.b);
  let L = 0, prev = s.a;
  const n = 64;
  for (let k = 1; k <= n; k++) { const p = bez(s.a, s.c1, s.c2, s.b, k / n); L += v.dist(prev, p); prev = p; }
  return L;
}

// Polígono aplanado de la pieza. Devuelve {pts, segIndex} donde segIndex[k] = tramo de origen.
export function flatten(points, closed = true, tol = 0.6) {
  const pts = [], segIndex = [];
  segments(points, closed).forEach((s, idx) => {
    flattenSeg(s, tol).forEach((p) => { pts.push(p); segIndex.push(idx); });
  });
  if (!closed && points.length) { const l = points[points.length - 1]; pts.push({ x: l.x, y: l.y }); segIndex.push(points.length - 2); }
  return { pts, segIndex };
}

export function pathD(points, closed = true) {
  if (!points.length) return '';
  let d = `M${f(points[0].x)} ${f(points[0].y)}`;
  segments(points, closed).forEach((s) => {
    d += s.curve
      ? ` C${f(s.c1.x)} ${f(s.c1.y)} ${f(s.c2.x)} ${f(s.c2.y)} ${f(s.b.x)} ${f(s.b.y)}`
      : ` L${f(s.b.x)} ${f(s.b.y)}`;
  });
  return d + (closed ? ' Z' : '');
}
const f = (n) => Math.round(n * 100) / 100;

export function polyPathD(pts, closed = true) {
  if (!pts.length) return '';
  return 'M' + pts.map((p) => `${f(p.x)} ${f(p.y)}`).join(' L') + (closed ? ' Z' : '');
}

export function area(pts) {
  let a = 0;
  for (let i = 0, n = pts.length; i < n; i++) { const p = pts[i], q = pts[(i + 1) % n]; a += p.x * q.y - q.x * p.y; }
  return a / 2;
}

export function bbox(pts) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of pts) { if (p.x < x0) x0 = p.x; if (p.y < y0) y0 = p.y; if (p.x > x1) x1 = p.x; if (p.y > y1) y1 = p.y; }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0, x1, y1 };
}

export function perimeter(points, closed = true) {
  return segments(points, closed).reduce((s, sg) => s + segLength(sg), 0);
}

// Punto y tangente en el tramo s a la fracción t
export function pointOnSeg(s, t) {
  if (!s.curve) return { p: v.lerp(s.a, s.b, t), tan: v.norm(v.sub(s.b, s.a)) };
  const p = bez(s.a, s.c1, s.c2, s.b, t);
  const q = bez(s.a, s.c1, s.c2, s.b, Math.min(1, t + 0.01));
  const r = bez(s.a, s.c1, s.c2, s.b, Math.max(0, t - 0.01));
  return { p, tan: v.norm(v.sub(q, r)) };
}

// Proyección del punto m sobre el tramo s. Devuelve {t, d, p}
export function projectOnSeg(s, m) {
  if (!s.curve) {
    const ab = v.sub(s.b, s.a), L2 = v.dot(ab, ab) || EPS;
    let t = v.dot(v.sub(m, s.a), ab) / L2; t = Math.max(0, Math.min(1, t));
    const p = v.lerp(s.a, s.b, t);
    return { t, d: v.dist(p, m), p };
  }
  let best = { t: 0, d: Infinity, p: s.a };
  const N = 60;
  for (let k = 0; k <= N; k++) {
    const t = k / N, p = bez(s.a, s.c1, s.c2, s.b, t), d = v.dist(p, m);
    if (d < best.d) best = { t, d, p };
  }
  // refinamiento
  let lo = Math.max(0, best.t - 1 / N), hi = Math.min(1, best.t + 1 / N);
  for (let it = 0; it < 20; it++) {
    const t1 = lo + (hi - lo) / 3, t2 = hi - (hi - lo) / 3;
    const d1 = v.dist(bez(s.a, s.c1, s.c2, s.b, t1), m), d2 = v.dist(bez(s.a, s.c1, s.c2, s.b, t2), m);
    if (d1 < d2) hi = t2; else lo = t1;
  }
  const t = (lo + hi) / 2, p = bez(s.a, s.c1, s.c2, s.b, t);
  return { t, d: v.dist(p, m), p };
}

// Longitud de un tramo de puntos i -> j recorriendo hacia adelante (pieza cerrada)
export function rangeLength(points, from, to) {
  const segs = segments(points, true), n = points.length;
  let L = 0, i = from, guard = 0;
  while (i !== to && guard++ <= n) { L += segLength(segs[i]); i = (i + 1) % n; }
  return L;
}

// Manijas automáticas tipo Catmull-Rom para un punto "suave"
export function autoHandles(points, i, closed = true, tension = 0.33) {
  const n = points.length;
  const prev = points[(i - 1 + n) % n], next = points[(i + 1) % n], p = points[i];
  if (!closed && (i === 0 || i === n - 1)) return;
  const dir = v.norm(v.sub(next, prev));
  const l1 = v.dist(prev, p) * tension, l2 = v.dist(p, next) * tension;
  p.h1 = v.mul(dir, -l1);
  p.h2 = v.mul(dir, l2);
}

// ---------- Offset (margen de costura) ----------
// pts: polígono aplanado; offs: margen por vértice-inicio de arista (mm). Devuelve polígono desplazado hacia afuera.
export function offsetPolygon(pts, offs, miterLimit = 3) {
  const n = pts.length;
  if (n < 3) return pts.slice();
  const ccw = area(pts) > 0; // en coordenadas con Y abajo, area>0 = sentido horario visual
  const sign = ccw ? -1 : 1;
  // líneas desplazadas por arista
  const lines = [];
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % n];
    const d = v.sub(b, a);
    if (v.len(d) < 1e-6) { lines.push(null); continue; }
    const nrm = v.mul(v.norm(v.perp(d)), sign * (offs[i] ?? 0));
    lines.push({ a: v.add(a, nrm), b: v.add(b, nrm), d: v.norm(d), off: offs[i] ?? 0 });
  }
  // compactar aristas nulas
  const L = lines.filter(Boolean);
  const out = [];
  const m = L.length;
  for (let i = 0; i < m; i++) {
    const l0 = L[(i - 1 + m) % m], l1 = L[i];
    const den = v.cross(l0.d, l1.d);
    if (Math.abs(den) < 1e-4) { out.push(l1.a); continue; }
    const t = v.cross(v.sub(l1.a, l0.a), l1.d) / den;
    const X = v.add(l0.a, v.mul(l0.d, t));
    const maxOff = Math.max(l0.off, l1.off, 0.01);
    if (v.dist(X, l1.a) > maxOff * miterLimit && v.dist(X, l0.b) > maxOff * miterLimit) {
      out.push(l0.b, l1.a); // bisel
    } else out.push(X);
  }
  return out;
}

// Polígono de corte de una pieza graduada: aplana y aplica margen por tramo
export function cutPolygon(points, seamDefault = 10, seamEdges = {}, foldEdge = null) {
  const { pts, segIndex } = flatten(points, true, 0.8);
  const offs = segIndex.map((si) => {
    if (foldEdge !== null && foldEdge !== undefined && si === foldEdge) return 0;
    const o = seamEdges[si];
    return o === undefined || o === null || o === '' ? seamDefault : +o;
  });
  return removeLoops(offsetPolygon(pts, offs));
}

// Elimina lazos pequeños que deja el margen en pinzas y esquinas cóncavas
function segX(a, b, c, d) {
  const r = v.sub(b, a), s = v.sub(d, c), den = v.cross(r, s);
  if (Math.abs(den) < 1e-12) return null;
  const t = v.cross(v.sub(c, a), s) / den, u = v.cross(v.sub(c, a), r) / den;
  if (t > 1e-9 && t < 1 - 1e-9 && u > 1e-9 && u < 1 - 1e-9) return v.add(a, v.mul(r, t));
  return null;
}
export function removeLoops(poly) {
  let P = poly.slice(), guard = 0, changed = true;
  while (changed && guard++ < 50) {
    changed = false;
    const n = P.length;
    outer: for (let i = 0; i < n; i++) {
      for (let k = 2; k < n - 1; k++) {
        const j = (i + k) % n;
        if ((j + 1) % n === i) continue;
        const X = segX(P[i], P[(i + 1) % n], P[j], P[(j + 1) % n]);
        if (!X) continue;
        // lazo A: i+1..j  (k puntos) · lazo B: el resto
        if (k <= n / 2) {
          const out = [];
          for (let m = 0; m < n; m++) { const idx = (i + 1 + m) % n; if (m < k) continue; out.push(P[idx]); }
          out.unshift(X);
          P = out;
        } else {
          const out = [X];
          for (let m = 1; m <= k; m++) out.push(P[(i + m) % n]);
          P = out;
        }
        changed = true; break outer;
      }
    }
  }
  return P;
}

// Refleja puntos respecto a la recta que pasa por A,B
export function mirrorPts(pts, A, B) {
  const d = v.norm(v.sub(B, A));
  return pts.map((p) => {
    const ap = v.sub(p, A), proj = v.add(A, v.mul(d, v.dot(ap, d)));
    return { x: 2 * proj.x - p.x, y: 2 * proj.y - p.y };
  });
}

// Pieza "al doblez": une la mitad con su espejo sobre la arista de doblez (polígono ya aplanado)
export function unfoldPolygon(poly, A, B) {
  const mir = mirrorPts(poly, A, B).reverse();
  return removeNearDup(poly.concat(mir));
}

function removeNearDup(pts) {
  const out = [];
  for (const p of pts) { const l = out[out.length - 1]; if (!l || v.dist(l, p) > 0.05) out.push(p); }
  if (out.length > 2 && v.dist(out[0], out[out.length - 1]) < 0.05) out.pop();
  return out;
}

export function transformPts(pts, { rot = 0, flipX = false, tx = 0, ty = 0 } = {}) {
  return pts.map((p) => {
    let q = { x: flipX ? -p.x : p.x, y: p.y };
    if (rot) q = v.rot(q, rot);
    return { x: q.x + tx, y: q.y + ty };
  });
}

export function pointInPoly(pt, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.y > pt.y) !== (b.y > pt.y) && pt.x < ((b.x - a.x) * (pt.y - a.y)) / (b.y - a.y + EPS) + a.x) inside = !inside;
  }
  return inside;
}

// Longitud de una curva cúbica dada en puntos absolutos
export function cubicLen(p0, c1, c2, p3) { return segLength({ a: p0, b: p3, c1, c2, curve: true }); }
