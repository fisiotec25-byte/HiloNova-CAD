/* ============================================================
   HiloNova CAD — Motor de acomodo (nesting) por rasterización
   Tela: eje X = largo (crece), eje Y = ancho (fijo).
   Algoritmo: bottom-left-fill sobre rejilla con sumas prefijas por renglón,
   saltos inteligentes y búsqueda local sobre el orden de colocación.
   Archivo clásico (sin módulos) para usarse en Web Worker con importScripts.
   ============================================================ */
(function (root) {
  'use strict';

  function rotPts(pts, ang) {
    var c = Math.cos(ang), s = Math.sin(ang), out = new Array(pts.length);
    for (var i = 0; i < pts.length; i++) out[i] = { x: pts[i].x * c - pts[i].y * s, y: pts[i].x * s + pts[i].y * c };
    return out;
  }

  function bb(pts) {
    var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (var i = 0; i < pts.length; i++) { var p = pts[i]; if (p.x < x0) x0 = p.x; if (p.y < y0) y0 = p.y; if (p.x > x1) x1 = p.x; if (p.y > y1) y1 = p.y; }
    return { x0: x0, y0: y0, x1: x1, y1: y1 };
  }

  // Intervalos interiores (regla nonzero) de un polígono en la horizontal y
  function intervalsAt(pts, y) {
    var xs = [];
    for (var i = 0, n = pts.length; i < n; i++) {
      var a = pts[i], b = pts[(i + 1) % n];
      if ((a.y <= y && b.y > y) || (b.y <= y && a.y > y)) {
        var x = a.x + ((y - a.y) / (b.y - a.y)) * (b.x - a.x);
        xs.push({ x: x, w: b.y > a.y ? 1 : -1 });
      }
    }
    xs.sort(function (p, q) { return p.x - q.x; });
    var out = [], wn = 0, start = 0;
    for (var k = 0; k < xs.length; k++) {
      var prev = wn; wn += xs[k].w;
      if (prev === 0 && wn !== 0) start = xs[k].x;
      else if (prev !== 0 && wn === 0) out.push([start, xs[k].x]);
    }
    return out;
  }

  function mergeRuns(r) {
    if (!r.length) return r;
    r.sort(function (a, b) { return a[0] - b[0]; });
    var out = [r[0].slice()];
    for (var i = 1; i < r.length; i++) {
      var l = out[out.length - 1];
      if (r[i][0] <= l[1]) { if (r[i][1] > l[1]) l[1] = r[i][1]; } else out.push(r[i].slice());
    }
    return out;
  }

  // Rasteriza un polígono (ya en origen 0,0) a renglones de celdas ocupadas (conservador)
  function rasterize(pts, res, dil) {
    var B = bb(pts);
    var H = Math.max(1, Math.ceil((B.y1 + 1e-6) / res));
    var rows = [];
    var n = pts.length;
    for (var r = 0; r < H; r++) {
      var top = r * res, bot = (r + 1) * res;
      var iv = intervalsAt(pts, top + 1e-4).concat(intervalsAt(pts, bot - 1e-4));
      // tramos del contorno recortados a la banda
      for (var i = 0; i < n; i++) {
        var a = pts[i], b = pts[(i + 1) % n];
        var ya = a.y, yb = b.y;
        if ((ya < top && yb < top) || (ya > bot && yb > bot)) continue;
        var t0 = 0, t1 = 1, dy = yb - ya;
        if (Math.abs(dy) > 1e-9) {
          var ta = (top - ya) / dy, tb = (bot - ya) / dy;
          var lo = Math.min(ta, tb), hi = Math.max(ta, tb);
          t0 = Math.max(0, lo); t1 = Math.min(1, hi);
          if (t0 > t1) continue;
        }
        var xa = a.x + (b.x - a.x) * t0, xb = a.x + (b.x - a.x) * t1;
        iv.push([Math.min(xa, xb), Math.max(xa, xb)]);
      }
      var cells = iv.map(function (s) { return [Math.floor(s[0] / res), Math.floor(s[1] / res) + 1]; });
      rows.push(mergeRuns(cells));
    }
    // dilatación (separación entre piezas)
    if (dil > 0) {
      var R2 = [];
      for (var rr = -dil; rr < H + dil; rr++) {
        var acc = [];
        for (var k = rr - dil; k <= rr + dil; k++) {
          if (k < 0 || k >= H) continue;
          for (var j = 0; j < rows[k].length; j++) acc.push([rows[k][j][0] - dil + dil, rows[k][j][1] + dil + dil]);
        }
        R2.push(mergeRuns(acc));
      }
      rows = R2;
    }
    var w = 0, cellsCount = 0;
    for (var q = 0; q < rows.length; q++) for (var z = 0; z < rows[q].length; z++) { if (rows[q][z][1] > w) w = rows[q][z][1]; cellsCount += rows[q][z][1] - rows[q][z][0]; }
    // aplanar a Int32Array por renglón para velocidad
    var flat = rows.map(function (rw) { var f = new Int32Array(rw.length * 2); for (var i2 = 0; i2 < rw.length; i2++) { f[2 * i2] = rw[i2][0]; f[2 * i2 + 1] = rw[i2][1]; } return f; });
    return { h: rows.length, w: w, rows: flat, cells: cellsCount };
  }

  // Prepara cada pieza en cada orientación
  function prepare(items, res, gapMm) {
    var dil = Math.max(0, Math.ceil(gapMm / 2 / res));
    return items.map(function (it) {
      var ors = it.orients.map(function (ang) {
        var p = rotPts(it.poly, ang);
        var B = bb(p);
        var p0 = p.map(function (q) { return { x: q.x - B.x0, y: q.y - B.y0 }; });
        var R = rasterize(p0, res, dil);
        return { ang: ang, dx: -B.x0, dy: -B.y0, R: R, dil: dil };
      });
      return { id: it.id, area: it.area, ors: ors, maxDim: Math.max.apply(null, ors.map(function (o) { return Math.max(o.R.w, o.R.h); })), h0: ors[0].R.h, w0: ors[0].R.w };
    });
  }

  function Grid(Wc, Lcap) {
    this.Wc = Wc; this.L = Lcap;
    this.occ = []; this.pre = []; this.nf = [];
    for (var i = 0; i < Wc; i++) {
      this.occ.push(new Uint8Array(Lcap)); this.pre.push(new Int32Array(Lcap + 1));
      var nf = new Int32Array(Lcap + 2); for (var j = 0; j < nf.length; j++) nf[j] = j; this.nf.push(nf);
    }
    this.maxX = 0;
  }
  Grid.prototype.firstOcc = function (row, s, e) {
    var pre = this.pre[row], base = pre[s], lo = s, hi = e - 1;
    while (lo < hi) { var mid = (lo + hi) >> 1; if (pre[mid + 1] > base) hi = mid; else lo = mid + 1; }
    return lo;
  };
  // Siguiente celda libre >= c (union-find con compresión de caminos)
  Grid.prototype.nextFree = function (row, c) {
    var nf = this.nf[row], r = c;
    while (nf[r] !== r) r = nf[r];
    while (nf[c] !== r) { var t = nf[c]; nf[c] = r; c = t; }
    return r;
  };
  // Devuelve -1 si cabe, o el siguiente x candidato
  Grid.prototype.check = function (R, x, y) {
    var L = this.L;
    for (var r = 0; r < R.h; r++) {
      var runs = R.rows[r]; if (!runs.length) continue;
      var pre = this.pre[y + r];
      for (var k = 0; k < runs.length; k += 2) {
        var s = x + runs[k], e = x + runs[k + 1];
        if (e > L) return L; // fuera de capacidad
        if (pre[e] - pre[s] > 0) {
          var o = this.firstOcc(y + r, s, e);
          return this.nextFree(y + r, o) - runs[k];
        }
      }
    }
    return -1;
  };
  Grid.prototype.place = function (R, x, y) {
    for (var r = 0; r < R.h; r++) {
      var runs = R.rows[r]; if (!runs.length) continue;
      var row = y + r, occ = this.occ[row], pre = this.pre[row];
      var minS = Infinity;
      for (var k = 0; k < runs.length; k += 2) {
        var s = x + runs[k], e = x + runs[k + 1];
        var nfr = this.nf[row];
        for (var c = s; c < e; c++) { occ[c] = 1; nfr[c] = c + 1; }
        if (s < minS) minS = s;
      }
      for (var c2 = minS; c2 < this.L; c2++) pre[c2 + 1] = pre[c2] + occ[c2];
    }
    if (x + R.w > this.maxX) this.maxX = x + R.w;
  };

  function greedy(prep, order, Wc, Lcap, genes) {
    var G = new Grid(Wc, Lcap);
    var out = [];
    for (var oi = 0; oi < order.length; oi++) {
      var it = prep[order[oi]];
      var best = null;
      var g = genes ? genes[order[oi]] : -1;
      for (var a = 0; a < it.ors.length; a++) {
        if (g >= 0 && g !== a && it.ors.length > 1) continue;
        var O = it.ors[a], R = O.R;
        if (R.h > Wc) continue;
        // objetivo: menor borde derecho (x + ancho); empate -> menor x
        for (var y = 0; y + R.h <= Wc; y++) {
          var x = 0;
          var limit = best ? best.score - R.w + 1 : Lcap;
          while (x < limit && x + R.w <= Lcap) {
            var nx = G.check(R, x, y);
            if (nx === -1) {
              var sc = x + R.w;
              if (!best || sc < best.score) { best = { x: x, y: y, a: a, R: R, score: sc }; }
              break;
            }
            x = nx > x ? nx : x + 1;
          }
        }
      }
      if (!best) return null; // no cupo (pieza más ancha que la tela)
      G.place(best.R, best.x, best.y);
      out.push({ idx: order[oi], x: best.x, y: best.y, a: best.a });
    }
    return { placements: out, len: G.maxX };
  }

  function rng(seed) { var s = seed >>> 0 || 1; return function () { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 1e9) / 1e9; }; }

  // Ejecuta la búsqueda. opts: {W, res, gap, orilla, timeMs, seed, onProgress}
  function run(items, opts) {
    var res = opts.res || 5, orilla = opts.orilla || 0;
    var Weff = opts.W - 2 * orilla;
    var Wc = Math.floor(Weff / res);
    var prep = prepare(items, res, opts.gap || 0);
    var tooWide = prep.filter(function (p) { return p.ors.every(function (o) { return o.R.h > Wc; }); }).map(function (p) { return p.id; });
    if (tooWide.length) return { error: 'Hay piezas más anchas que la tela: ' + tooWide.join(', ') };
    var Lcap = 0; prep.forEach(function (p) { Lcap += Math.max.apply(null, p.ors.map(function (o) { return o.R.w; })); });
    Lcap = Math.ceil(Lcap * 1.05) + 20;

    var idx = prep.map(function (_, i) { return i; });
    var orders = [
      idx.slice().sort(function (a, b) { return prep[b].area - prep[a].area; }),
      idx.slice().sort(function (a, b) { return prep[b].maxDim - prep[a].maxDim; }),
      idx.slice().sort(function (a, b) { return prep[b].h0 - prep[a].h0; }),
      idx.slice().sort(function (a, b) { return prep[b].w0 - prep[a].w0; }),
    ];
    var best = null, bestOrder = null, bestGenes = null, iter = 0;
    var t0 = Date.now();
    var noGenes = prep.map(function () { return -1; });
    var consider = function (ord) {
      var r = greedy(prep, ord, Wc, Lcap, noGenes); iter++;
      if (r && (!best || r.len < best.len)) { best = r; bestOrder = ord.slice(); bestGenes = noGenes.slice(); return true; }
      return false;
    };
    for (var i = 0; i < orders.length; i++) {
      consider(orders[i]);
      if (opts.onProgress) opts.onProgress({ iter: iter, len: best ? best.len * res : 0, elapsed: Date.now() - t0 });
    }
    var rand = rng(opts.seed || 12345);
    var cur = bestOrder.slice(), curLen = best.len, curG = bestGenes.slice();
    // los genes de orientación arrancan con la orientación elegida en la mejor solución
    best.placements.forEach(function (p) { curG[p.idx] = p.a; });
    var T = Math.max(2, curLen * 0.02);
    while (Date.now() - t0 < (opts.timeMs || 3000)) {
      var cand = cur.slice(), cg = curG.slice();
      var m = rand() < 0.5 ? 1 : 2 + Math.floor(rand() * 2);
      if (rand() < 0.35) { var gi = Math.floor(rand() * cg.length); var no = prep[gi].ors.length; cg[gi] = rand() < 0.3 ? -1 : Math.floor(rand() * no); }
      for (var q = 0; q < m; q++) {
        var i1 = Math.floor(rand() * cand.length), i2 = Math.floor(rand() * cand.length);
        if (rand() < 0.5) { var tmp = cand[i1]; cand[i1] = cand[i2]; cand[i2] = tmp; }
        else { var el = cand.splice(i1, 1)[0]; cand.splice(i2, 0, el); }
      }
      var r = greedy(prep, cand, Wc, Lcap, cg); iter++;
      if (r) {
        if (r.len < best.len) { best = r; bestOrder = cand.slice(); bestGenes = cg.slice(); }
        if (r.len <= curLen || rand() < Math.exp(-(r.len - curLen) / T)) { cur = cand; curLen = r.len; curG = cg; }
      }
      T *= 0.995;
      if (opts.onProgress && iter % 4 === 0) opts.onProgress({ iter: iter, len: best.len * res, elapsed: Date.now() - t0 });
    }
    var placements = best.placements.map(function (p) {
      var it = prep[p.idx], O = it.ors[p.a];
      return { id: it.id, ang: O.ang, tx: p.x * res + O.dx + O.dil * res, ty: p.y * res + O.dy + O.dil * res + orilla };
    });
    return { placements: placements, largo: best.len * res, iter: iter, ms: Date.now() - t0 };
  }

  root.HNNest = { run: run, rasterize: rasterize, intervalsAt: intervalsAt };
})(typeof self !== 'undefined' ? self : this);
