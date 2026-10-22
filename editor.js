// ============================================================
// HiloNova CAD — Patronaje 2D (editor de piezas)
// ============================================================
import { state, commit, pieza, emit, on } from '../store.js';
import { icon, h, $, esc, fmtLen, unitLbl, toMM, fromMM, toast, enhanceSelects, confirmar } from '../ui.js';
import { pieceSVG, pieceCut } from '../render.js';
import { SIZE_COLORS } from '../../core/blocks.js';
import { gradedPoints, gradedPiece, setRule } from '../../core/grading.js';
import { v, segments, projectOnSeg, pointInPoly, flatten, bbox, perimeter, area, segLength, uid, pathD } from '../../core/geom.js';
import { insertPoint, deletePoint, toggleSmooth, flipPiece, rotatePiece, newPiece, duplicatePiece, PIECE_COLORS } from '../../core/pieceops.js';

const TOOLS = [
  { id: 'select', ic: 'cursor', tip: 'Seleccionar y mover (V)', key: 'v' },
  { id: 'pan', ic: 'hand', tip: 'Desplazar lienzo (H)', key: 'h' },
  { sep: true },
  { id: 'pen', ic: 'pen', tip: 'Dibujar pieza por puntos (N)', key: 'n' },
  { id: 'rect', ic: 'rect', tip: 'Pieza rectangular (R)', key: 'r' },
  { id: 'addpt', ic: 'plusPt', tip: 'Agregar punto en contorno (P)', key: 'p' },
  { id: 'curve', ic: 'curve', tip: 'Punto curvo / esquina (C)', key: 'c' },
  { id: 'notch', ic: 'notch', tip: 'Piquete (K)', key: 'k' },
  { id: 'grain', ic: 'grain', tip: 'Línea de hilo (G)', key: 'g' },
  { id: 'measure', ic: 'measure', tip: 'Medir (M)', key: 'm' },
  { sep: true },
  { id: 'flip', ic: 'flip', tip: 'Espejo de pieza', action: true },
  { id: 'rot90', ic: 'rotate', tip: 'Girar 90°', action: true },
  { id: 'dup', ic: 'copy', tip: 'Duplicar pieza (Ctrl+D)', action: true },
  { id: 'del', ic: 'trash', tip: 'Eliminar punto / pieza (Supr)', action: true },
];

let root, svg, gGrid, gWorld, gPieces, gOver, stage, ins, statusEl, legendEl;
const vp = { k: 0.6, tx: 60, ty: 60 };
let drag = null, pen = [], rectTmp = null, meas = null, cursor = { x: 0, y: 0 }, spaceDown = false, fitted = false;

const T = () => state.ui.talla;
const B = () => state.p.tabla.base;
const sizeColor = (t) => SIZE_COLORS[state.p.tabla.tallas.indexOf(t) % SIZE_COLORS.length];

function mount(el) {
  root = el;
  el.innerHTML = `<div class="workspace">
    <div class="toolbar">${TOOLS.map((t) => (t.sep ? '<div class="tool-sep"></div>' : `<button class="tool" data-tool="${t.id}" data-tip="${t.tip}">${icon(t.ic)}</button>`)).join('')}</div>
    <div class="stage t-select" id="edStage">
      <svg class="cv" id="edSvg"><g id="edGrid"></g><g id="edWorld"><g id="edPieces"></g><g id="edOver"></g></g></svg>
      <div class="legend" id="edLegend"></div>
      <div class="zoombox">
        <button class="btn icon sm" data-z="in" title="Acercar">${icon('zoomIn', 'sm')}</button>
        <button class="btn icon sm" data-z="out" title="Alejar">${icon('zoomOut', 'sm')}</button>
        <button class="btn icon sm" data-z="fit" title="Ajustar a pantalla (F)">${icon('fit', 'sm')}</button>
      </div>
      <div class="statusbar" id="edStatus"></div>
    </div>
    <div class="inspector" id="edIns"></div>
  </div>`;
  svg = $('#edSvg', el); gGrid = $('#edGrid', el); gWorld = $('#edWorld', el); gPieces = $('#edPieces', el); gOver = $('#edOver', el);
  stage = $('#edStage', el); ins = $('#edIns', el); statusEl = $('#edStatus', el); legendEl = $('#edLegend', el);

  el.querySelectorAll('.tool').forEach((b) => b.addEventListener('click', () => {
    const t = TOOLS.find((x) => x.id === b.dataset.tool);
    if (t.action) return action(t.id);
    setTool(t.id);
  }));
  el.querySelectorAll('[data-z]').forEach((b) => b.addEventListener('click', () => {
    const r = svg.getBoundingClientRect();
    if (b.dataset.z === 'fit') return fit();
    zoomAt(r.width / 2, r.height / 2, b.dataset.z === 'in' ? 1.25 : 0.8);
  }));

  svg.addEventListener('mousedown', onDown);
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
  svg.addEventListener('dblclick', onDbl);
  svg.addEventListener('wheel', (e) => { e.preventDefault(); const r = svg.getBoundingClientRect(); zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * 0.0015)); }, { passive: false });
  svg.addEventListener('contextmenu', (e) => e.preventDefault());
  new ResizeObserver(() => { if (isOn()) { drawGrid(); } }).observe(stage);
  document.addEventListener('keydown', onKey);
  document.addEventListener('keyup', (e) => { if (e.code === 'Space') { spaceDown = false; stage.classList.remove('panning'); } });
  on('open', () => { fitted = false; });
}

const isOn = () => root && root.classList.contains('on');

function setTool(t) {
  state.ui.tool = t; pen = []; rectTmp = null; meas = null;
  root.querySelectorAll('.tool').forEach((b) => b.classList.toggle('on', b.dataset.tool === t));
  stage.className = 'stage t-' + t;
  drawOverlay(); status();
}

// ---------- Vista ----------
function applyVP() { gWorld.setAttribute('transform', `translate(${vp.tx} ${vp.ty}) scale(${vp.k})`); drawGrid(); }
function zoomAt(sx, sy, f) {
  const k2 = Math.min(12, Math.max(0.05, vp.k * f));
  const wx = (sx - vp.tx) / vp.k, wy = (sy - vp.ty) / vp.k;
  vp.k = k2; vp.tx = sx - wx * k2; vp.ty = sy - wy * k2;
  applyVP(); drawOverlay(); status();
}
export function fit() {
  if (!state.p) return;
  const r = svg.getBoundingClientRect();
  if (!r.width) return;
  let all = [];
  state.p.piezas.filter((p) => p.visible !== false).forEach((p) => { flatten(gradedPoints(p, T(), B())).pts.forEach((q) => all.push({ x: q.x + p.pos.x, y: q.y + p.pos.y })); });
  if (!all.length) { vp.k = 0.6; vp.tx = 60; vp.ty = 60; applyVP(); return; }
  const bb = bbox(all), m = 60;
  vp.k = Math.min((r.width - 2 * m) / (bb.w + 1), (r.height - 2 * m - 30) / (bb.h + 1));
  vp.tx = (r.width - bb.w * vp.k) / 2 - bb.x * vp.k;
  vp.ty = (r.height - 30 - bb.h * vp.k) / 2 - bb.y * vp.k;
  applyVP(); drawOverlay(); status();
}
function world(e) { const r = svg.getBoundingClientRect(); return { x: (e.clientX - r.left - vp.tx) / vp.k, y: (e.clientY - r.top - vp.ty) / vp.k, sx: e.clientX - r.left, sy: e.clientY - r.top }; }

function drawGrid() {
  const r = svg.getBoundingClientRect();
  if (!r.width) return;
  const steps = [1, 5, 10, 50, 100, 500, 1000];
  let minor = steps.find((s) => s * vp.k >= 9) || 1000;
  const major = minor * (minor === 5 || minor === 50 || minor === 500 ? 2 : 10);
  const x0 = -vp.tx / vp.k, y0 = -vp.ty / vp.k, x1 = (r.width - vp.tx) / vp.k, y1 = (r.height - vp.ty) / vp.k;
  let s = '';
  for (let x = Math.floor(x0 / minor) * minor; x <= x1; x += minor) {
    const X = x * vp.k + vp.tx, mj = Math.abs(x % major) < 1e-6;
    s += `<line x1="${X}" y1="0" x2="${X}" y2="${r.height}" stroke="var(${mj ? '--grid2' : '--grid'})"/>`;
  }
  for (let y = Math.floor(y0 / minor) * minor; y <= y1; y += minor) {
    const Y = y * vp.k + vp.ty, mj = Math.abs(y % major) < 1e-6;
    s += `<line x1="0" y1="${Y}" x2="${r.width}" y2="${Y}" stroke="var(${mj ? '--grid2' : '--grid'})"/>`;
  }
  gGrid.innerHTML = s;
}

// ---------- Dibujo ----------
function drawPieces() {
  if (!state.p) { gPieces.innerHTML = ''; return; }
  const ui = state.ui;
  let s = '';
  for (const p of state.p.piezas) {
    if (p.visible === false) continue;
    const sel = p.id === ui.selPieza;
    s += `<g data-pid="${p.id}" class="${sel ? 'sel-piece' : ''}" transform="translate(${p.pos.x} ${p.pos.y})" style="color:${p.color}">`;
    if (ui.nest) {
      for (const t of state.p.tabla.tallas) {
        if (t === T() || !ui.showSizes[t]) continue;
        s += `<g opacity=".85">${pieceSVG(p, { talla: t, base: B(), color: sizeColor(t), fill: false, seam: false, notches: false, internals: false, grain: false, fold: false })}</g>`;
      }
    }
    s += pieceSVG(p, { talla: T(), base: B(), color: ui.nest ? sizeColor(T()) : p.color, seam: ui.showSeam, label: ui.showLabels, labelTalla: T() });
    s += '</g>';
  }
  gPieces.innerHTML = s;
  legendEl.innerHTML = ui.nest
    ? state.p.tabla.tallas.filter((t) => ui.showSizes[t] || t === T()).map((t) => `<span class="row" style="gap:6px"><i class="dot" style="--c:${sizeColor(t)}"></i>${esc(t)}${t === B() ? ' (base)' : ''}</span>`).join('')
    : `<span class="row" style="gap:6px"><i class="dot" style="--c:${sizeColor(T())}"></i>Talla ${esc(T())}${T() === B() ? ' · base' : ' · graduada'}</span>`;
}

function drawOverlay() {
  if (!state.p) { gOver.innerHTML = ''; return; }
  const p = pieza(); const r = 4.2 / vp.k; let s = '';
  if (p && p.visible !== false) {
    const pts = gradedPoints(p, T(), B());
    const o = p.pos;
    s += `<g transform="translate(${o.x} ${o.y})">`;
    if (state.ui.selSeg !== null && state.ui.selSeg !== undefined && pts.length > state.ui.selSeg) {
      const sg = segments(pts, true)[state.ui.selSeg];
      if (sg) s += `<path d="${segPath(sg)}" fill="none" stroke="var(--accent)" stroke-width="5" stroke-opacity=".55" vector-effect="non-scaling-stroke"/>`;
    }
    pts.forEach((q, i) => {
      const on = state.ui.selPunto === q.id;
      const fill = on ? 'var(--accent)' : 'var(--canvas)';
      if (q.h1 || q.h2) s += `<circle class="pt" data-pt="${i}" cx="${q.x}" cy="${q.y}" r="${r * (on ? 1.25 : 1)}" fill="${fill}" stroke="var(--accent)" stroke-width="1.5"/>`;
      else s += `<rect class="pt" data-pt="${i}" x="${q.x - r}" y="${q.y - r}" width="${2 * r}" height="${2 * r}" fill="${fill}" stroke="var(--accent)" stroke-width="1.5" ${on ? `transform="rotate(45 ${q.x} ${q.y})"` : ''}/>`;
      if (on) {
        ['h1', 'h2'].forEach((hk) => {
          if (!q[hk]) return;
          const hx = q.x + q[hk].x, hy = q.y + q[hk].y;
          s += `<line class="handle-line" x1="${q.x}" y1="${q.y}" x2="${hx}" y2="${hy}" stroke="var(--accent2)"/>`;
          s += `<circle class="pt" cx="${hx}" cy="${hy}" r="${r * 0.85}" fill="var(--accent2)" stroke="var(--canvas)" stroke-width="1"/>`;
        });
      }
    });
    s += '</g>';
  }
  if (pen.length) {
    const all = pen.concat(cursor ? [cursor] : []);
    s += `<polyline points="${all.map((q) => q.x + ',' + q.y).join(' ')}" fill="none" stroke="var(--accent)" stroke-width="1.5" stroke-dasharray="6 4" vector-effect="non-scaling-stroke"/>`;
    pen.forEach((q) => { s += `<rect x="${q.x - r}" y="${q.y - r}" width="${2 * r}" height="${2 * r}" fill="var(--accent)"/>`; });
  }
  if (rectTmp) s += `<rect x="${Math.min(rectTmp.a.x, rectTmp.b.x)}" y="${Math.min(rectTmp.a.y, rectTmp.b.y)}" width="${Math.abs(rectTmp.b.x - rectTmp.a.x)}" height="${Math.abs(rectTmp.b.y - rectTmp.a.y)}" fill="var(--accent-soft)" stroke="var(--accent)" stroke-dasharray="6 4" vector-effect="non-scaling-stroke"/>`;
  if (meas && meas.a) {
    const b = meas.b || cursor;
    const d = v.dist(meas.a, b);
    s += `<line x1="${meas.a.x}" y1="${meas.a.y}" x2="${b.x}" y2="${b.y}" stroke="#fbbf24" stroke-width="1.5" vector-effect="non-scaling-stroke"/>`;
    s += `<circle cx="${meas.a.x}" cy="${meas.a.y}" r="${r}" fill="#fbbf24"/><circle cx="${b.x}" cy="${b.y}" r="${r}" fill="#fbbf24"/>`;
    const mx = (meas.a.x + b.x) / 2, my = (meas.a.y + b.y) / 2;
    s += `<text x="${mx}" y="${my - 8 / vp.k}" font-size="${13 / vp.k}" fill="#fbbf24" text-anchor="middle" font-weight="600">${fmtLen(d, 2)} ${unitLbl()}  (Δx ${fmtLen(Math.abs(b.x - meas.a.x))} · Δy ${fmtLen(Math.abs(b.y - meas.a.y))})</text>`;
  }
  gOver.innerHTML = s;
}
const segPath = (sg) => sg.curve ? `M${sg.a.x} ${sg.a.y} C${sg.c1.x} ${sg.c1.y} ${sg.c2.x} ${sg.c2.y} ${sg.b.x} ${sg.b.y}` : `M${sg.a.x} ${sg.a.y} L${sg.b.x} ${sg.b.y}`;

function status() {
  if (!statusEl) return;
  const p = pieza();
  const tool = TOOLS.find((t) => t.id === state.ui.tool);
  const hints = { select: 'Clic en pieza o punto · arrastra para mover · Shift = ortogonal', pen: 'Clic para agregar puntos · doble clic o Enter para cerrar · Esc cancela', rect: 'Arrastra para crear un rectángulo', addpt: 'Clic sobre el contorno de la pieza', curve: 'Clic en un punto para alternar curva / esquina', notch: 'Clic sobre el contorno para colocar un piquete', grain: 'Arrastra sobre la pieza para trazar el hilo', measure: 'Clic en dos puntos para medir (se imanta a vértices)', pan: 'Arrastra para mover el lienzo' };
  statusEl.innerHTML = `<span>X <b class="mono">${fmtLen(cursor.x)}</b> Y <b class="mono">${fmtLen(cursor.y)}</b> ${unitLbl()}</span>
    <span>Zoom <b class="mono">${Math.round(vp.k * 100 / 0.6)}%</b></span>
    <span>${tool ? esc(tool.tip.replace(/ \(.+\)/, '')) : ''}</span>
    <span class="muted">${hints[state.ui.tool] || ''}</span>
    <span style="margin-left:auto">${p ? `${esc(p.name)} · talla <b>${esc(T())}</b>` : ''}</span>`;
}

// ---------- Hit testing ----------
function hitPoint(p, w, tol) {
  const pts = gradedPoints(p, T(), B());
  let best = -1, bd = tol;
  pts.forEach((q, i) => { const d = Math.hypot(q.x + p.pos.x - w.x, q.y + p.pos.y - w.y); if (d < bd) { bd = d; best = i; } });
  return best;
}
function hitHandle(p, w, tol) {
  if (!state.ui.selPunto) return null;
  const pts = gradedPoints(p, T(), B());
  const i = pts.findIndex((q) => q.id === state.ui.selPunto);
  if (i < 0) return null;
  const q = pts[i];
  for (const hk of ['h1', 'h2']) {
    if (!q[hk]) continue;
    if (Math.hypot(q.x + q[hk].x + p.pos.x - w.x, q.y + q[hk].y + p.pos.y - w.y) < tol) return { i, hk };
  }
  return null;
}
function hitSeg(p, w, tol) {
  const pts = gradedPoints(p, T(), B());
  const m = { x: w.x - p.pos.x, y: w.y - p.pos.y };
  let best = null;
  segments(pts, true).forEach((s, i) => { const r = projectOnSeg(s, m); if (r.d < tol && (!best || r.d < best.d)) best = { i, t: r.t, d: r.d, p: r.p }; });
  return best;
}
function hitPiece(w) {
  const list = state.p.piezas.filter((p) => p.visible !== false);
  for (let i = list.length - 1; i >= 0; i--) {
    const p = list[i];
    const poly = flatten(gradedPoints(p, T(), B())).pts.map((q) => ({ x: q.x + p.pos.x, y: q.y + p.pos.y }));
    if (pointInPoly(w, poly)) return p;
  }
  // margen de costura cuenta como pieza
  for (let i = list.length - 1; i >= 0; i--) {
    const p = list[i];
    if (hitSeg(p, w, 8 / vp.k)) return p;
  }
  return null;
}
function snapToVertex(w, tol) {
  let best = null, bd = tol;
  for (const p of state.p.piezas) {
    if (p.visible === false) continue;
    gradedPoints(p, T(), B()).forEach((q) => { const d = Math.hypot(q.x + p.pos.x - w.x, q.y + p.pos.y - w.y); if (d < bd) { bd = d; best = { x: q.x + p.pos.x, y: q.y + p.pos.y }; } });
  }
  return best;
}
const snapGrid = (val) => { const s = state.ui.snap || 0; return s ? Math.round(val / s) * s : val; };

// ---------- Eventos ----------
function onDown(e) {
  if (!state.p) return;
  const w = world(e);
  cursor = w;
  if (e.button === 1 || e.button === 2 || spaceDown || state.ui.tool === 'pan') { drag = { type: 'pan', sx: w.sx, sy: w.sy, tx: vp.tx, ty: vp.ty }; stage.classList.add('panning'); return; }
  const tol = 8 / vp.k;
  const tool = state.ui.tool;
  const sel = pieza();

  if (tool === 'select') {
    if (sel && sel.visible !== false) {
      const hh = hitHandle(sel, w, tol);
      if (hh) { drag = { type: 'handle', pid: sel.id, ...hh, moved: false }; return; }
      const pi = hitPoint(sel, w, tol);
      if (pi >= 0) {
        const pts = gradedPoints(sel, T(), B());
        state.ui.selPunto = pts[pi].id; state.ui.selSeg = null;
        drag = { type: 'point', pid: sel.id, i: pi, start: { x: pts[pi].x, y: pts[pi].y }, w0: w, moved: false };
        drawOverlay(); renderInspector(); return;
      }
    }
    const hp = hitPiece(w);
    if (hp) {
      const changed = hp.id !== state.ui.selPieza;
      state.ui.selPieza = hp.id;
      if (changed) state.ui.selPunto = null;
      const hs = hitSeg(hp, w, tol);
      state.ui.selSeg = hs ? hs.i : null;
      if (hs) state.ui.selPunto = null;
      drag = { type: 'piece', pid: hp.id, w0: w, pos0: { ...hp.pos }, moved: false };
      drawPieces(); drawOverlay(); renderInspector(); status(); return;
    }
    state.ui.selPunto = null; state.ui.selSeg = null;
    drag = { type: 'pan', sx: w.sx, sy: w.sy, tx: vp.tx, ty: vp.ty };
    drawOverlay(); renderInspector(); return;
  }
  if (tool === 'pen') {
    const s = snapToVertex(w, tol) || { x: snapGrid(w.x), y: snapGrid(w.y) };
    if (pen.length >= 3 && v.dist(s, pen[0]) < tol) return finishPen();
    pen.push(s); drawOverlay(); return;
  }
  if (tool === 'rect') { const a = { x: snapGrid(w.x), y: snapGrid(w.y) }; rectTmp = { a, b: a }; drag = { type: 'rect' }; return; }
  if (tool === 'measure') {
    const s = snapToVertex(w, tol) || w;
    if (!meas || meas.b) meas = { a: s, b: null }; else meas.b = s;
    drawOverlay(); return;
  }
  const target = (sel && sel.visible !== false && hitSeg(sel, w, tol)) ? sel : hitPiece(w);
  if (!target) return;
  if (target.id !== state.ui.selPieza) { state.ui.selPieza = target.id; state.ui.selPunto = null; drawPieces(); }
  if (tool === 'addpt') {
    const hs = hitSeg(target, w, tol * 1.5);
    if (!hs) return toast('Haz clic justo sobre el contorno', 'warn');
    if (T() !== B()) return toast('Agrega puntos en la talla base', 'warn');
    const ni = insertPoint(target, hs.i, hs.t);
    state.ui.selPunto = target.points[ni].id; commit('Agregar punto'); return;
  }
  if (tool === 'curve') {
    const pi = hitPoint(target, w, tol);
    if (pi < 0) return;
    if (T() !== B()) return toast('Cambia la forma del punto en la talla base', 'warn');
    toggleSmooth(target, pi); state.ui.selPunto = target.points[pi].id; commit('Curva/esquina'); return;
  }
  if (tool === 'notch') {
    const hs = hitSeg(target, w, tol * 1.5);
    if (!hs) return;
    target.notches = target.notches || [];
    target.notches.push({ seg: hs.i, t: Math.max(0.001, Math.min(0.999, hs.t)) });
    commit('Piquete'); return;
  }
  if (tool === 'grain') { drag = { type: 'grain', pid: target.id, a: { x: w.x - target.pos.x, y: w.y - target.pos.y } }; return; }
}

function onMove(e) {
  if (!isOn() || !state.p) return;
  const w = world(e);
  cursor = w;
  if (!drag) {
    if (pen.length || (meas && !meas.b)) drawOverlay();
    status(); return;
  }
  const p = drag.pid ? state.p.piezas.find((x) => x.id === drag.pid) : null;
  if (drag.type === 'pan') { vp.tx = drag.tx + (w.sx - drag.sx); vp.ty = drag.ty + (w.sy - drag.sy); applyVP(); return; }
  if (drag.type === 'piece') {
    const dx = w.x - drag.w0.x, dy = w.y - drag.w0.y;
    if (!drag.moved && Math.hypot(dx, dy) * vp.k < 3) return;
    drag.moved = true;
    p.pos = { x: drag.pos0.x + dx, y: drag.pos0.y + dy };
    drawPieces(); drawOverlay(); return;
  }
  if (drag.type === 'point') {
    let nx = w.x - p.pos.x, ny = w.y - p.pos.y;
    if (!drag.moved && Math.hypot(w.x - drag.w0.x, w.y - drag.w0.y) * vp.k < 3) return;
    drag.moved = true;
    if (e.shiftKey) { if (Math.abs(nx - drag.start.x) > Math.abs(ny - drag.start.y)) ny = drag.start.y; else nx = drag.start.x; }
    const sv = snapToVertexExcept(w, 7 / vp.k, p, drag.i);
    if (sv) { nx = sv.x - p.pos.x; ny = sv.y - p.pos.y; } else { nx = snapGrid(nx); ny = snapGrid(ny); }
    movePoint(p, drag.i, nx, ny);
    drawPieces(); drawOverlay(); return;
  }
  if (drag.type === 'handle') {
    drag.moved = true;
    const pts = gradedPoints(p, T(), B()); const q = pts[drag.i];
    const rel = { x: w.x - p.pos.x - q.x, y: w.y - p.pos.y - q.y };
    moveHandle(p, drag.i, drag.hk, rel, !e.altKey);
    drawPieces(); drawOverlay(); return;
  }
  if (drag.type === 'rect') { rectTmp.b = { x: snapGrid(w.x), y: snapGrid(w.y) }; drawOverlay(); return; }
  if (drag.type === 'grain') { drag.b = { x: w.x - p.pos.x, y: w.y - p.pos.y }; gOver.innerHTML = `<line x1="${drag.a.x + p.pos.x}" y1="${drag.a.y + p.pos.y}" x2="${w.x}" y2="${w.y}" stroke="var(--accent)" stroke-width="2" vector-effect="non-scaling-stroke"/>`; }
}

function onUp() {
  if (!drag) return;
  const d = drag; drag = null;
  stage.classList.remove('panning');
  if (d.type === 'piece' && d.moved) commit('Mover pieza');
  if (d.type === 'point' && d.moved) commit('Mover punto');
  if (d.type === 'handle' && d.moved) commit('Ajustar curva');
  if (d.type === 'rect' && rectTmp) {
    const { a, b } = rectTmp; rectTmp = null;
    if (Math.abs(b.x - a.x) > 5 && Math.abs(b.y - a.y) > 5) {
      const np = newPiece([a, { x: b.x, y: a.y }, b, { x: a.x, y: b.y }], { name: 'Rectángulo', color: PIECE_COLORS[state.p.piezas.length % PIECE_COLORS.length] });
      state.p.piezas.push(np); state.ui.selPieza = np.id; commit('Nueva pieza');
    } else drawOverlay();
  }
  if (d.type === 'grain' && d.b) {
    const p = state.p.piezas.find((x) => x.id === d.pid);
    if (v.dist(d.a, d.b) > 10) {
      let a = d.a, b = d.b;
      if (gradedPoints !== null && T() !== B()) { /* el hilo se define en base */ }
      p.grain = [a, b]; commit('Línea de hilo');
    } else drawOverlay();
  }
}

function snapToVertexExcept(w, tol, piece, idx) {
  let best = null, bd = tol;
  for (const p of state.p.piezas) {
    if (p.visible === false) continue;
    gradedPoints(p, T(), B()).forEach((q, i) => {
      if (p === piece && i === idx) return;
      const d = Math.hypot(q.x + p.pos.x - w.x, q.y + p.pos.y - w.y);
      if (d < bd) { bd = d; best = { x: q.x + p.pos.x, y: q.y + p.pos.y }; }
    });
  }
  return best;
}

// Mover un punto: en base edita geometría; en otra talla edita la regla
function movePoint(p, i, nx, ny) {
  const base = p.points[i];
  if (T() === B()) { base.x = nx; base.y = ny; }
  else setRule(p, T(), base.id, nx - base.x, ny - base.y);
}
function moveHandle(p, i, hk, rel, sym) {
  const base = p.points[i];
  const other = hk === 'h1' ? 'h2' : 'h1';
  if (T() === B()) {
    base[hk] = rel;
    if (sym && base[other]) { const L = v.len(base[other]); base[other] = v.mul(v.norm(rel), -L); }
  } else {
    p.rules[T()] = p.rules[T()] || {};
    const r = p.rules[T()][base.id] || (p.rules[T()][base.id] = { dx: 0, dy: 0 });
    r['d' + hk] = { x: rel.x - base[hk].x, y: rel.y - base[hk].y };
  }
}

function onDbl() { if (state.ui.tool === 'pen' && pen.length >= 3) finishPen(); }
function finishPen() {
  if (pen.length < 3) return;
  const np = newPiece(pen, { name: 'Pieza ' + (state.p.piezas.length + 1), color: PIECE_COLORS[state.p.piezas.length % PIECE_COLORS.length] });
  pen = [];
  state.p.piezas.push(np); state.ui.selPieza = np.id; state.ui.selPunto = null;
  commit('Nueva pieza'); setTool('select');
}

function onKey(e) {
  if (!isOn() || !state.p) return;
  if (e.target.closest('input,textarea,select,[contenteditable]')) return;
  if (e.code === 'Space') { spaceDown = true; stage.classList.add('panning'); e.preventDefault(); return; }
  if (e.ctrlKey || e.metaKey) {
    if (e.key.toLowerCase() === 'd') { e.preventDefault(); action('dup'); }
    return;
  }
  const t = TOOLS.find((x) => x.key === e.key.toLowerCase());
  if (t) { setTool(t.id); return; }
  if (e.key === 'f' || e.key === 'F') return fit();
  if (e.key === 'Escape') { pen = []; rectTmp = null; meas = null; state.ui.selPunto = null; drawOverlay(); renderInspector(); return; }
  if (e.key === 'Enter' && pen.length >= 3) return finishPen();
  if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); return action('del'); }
  const arrows = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
  if (arrows[e.key]) {
    e.preventDefault();
    const p = pieza(); if (!p) return;
    const st = e.shiftKey ? 10 : 1, [dx, dy] = arrows[e.key];
    if (state.ui.selPunto) {
      const i = p.points.findIndex((q) => q.id === state.ui.selPunto);
      const pts = gradedPoints(p, T(), B());
      movePoint(p, i, pts[i].x + dx * st, pts[i].y + dy * st);
    } else p.pos = { x: p.pos.x + dx * st, y: p.pos.y + dy * st };
    commit('Mover');
  }
}

async function action(id) {
  const p = pieza();
  if (!p) return toast('Selecciona una pieza', 'warn');
  if (id === 'flip') { flipPiece(p); commit('Espejo'); }
  if (id === 'rot90') { rotatePiece(p, Math.PI / 2); commit('Girar'); }
  if (id === 'dup') { const c = duplicatePiece(p); state.p.piezas.push(c); state.ui.selPieza = c.id; commit('Duplicar'); }
  if (id === 'del') {
    if (state.ui.selPunto) {
      if (T() !== B()) return toast('Elimina puntos en la talla base', 'warn');
      const i = p.points.findIndex((q) => q.id === state.ui.selPunto);
      if (deletePoint(p, i)) { state.ui.selPunto = null; commit('Eliminar punto'); } else toast('Una pieza necesita al menos 3 puntos', 'warn');
    } else if (await confirmar(`¿Eliminar la pieza <b>${esc(p.name)}</b>?`, { ok: 'Eliminar', danger: true })) {
      state.p.piezas = state.p.piezas.filter((x) => x.id !== p.id);
      state.ui.selPieza = state.p.piezas[0]?.id || null; commit('Eliminar pieza');
    }
  }
}

// ---------- Inspector ----------
function renderInspector() {
  if (!ins || !state.p) return;
  const p = pieza();
  const U = unitLbl();
  let html = `<div class="ins-sec"><h4>Piezas <span class="muted">${state.p.piezas.length}</span></h4><div class="plist">${state.p.piezas.map((x) => `
    <div class="pitem ${x.id === state.ui.selPieza ? 'on' : ''}" data-sel="${x.id}">
      <i class="dot" style="--c:${x.color}"></i><span>${esc(x.name)}</span><span class="q">x${x.qty}${x.fold !== null && x.fold !== undefined ? ' · doblez' : ''}</span>
      <button class="btn icon sm ghost eye" data-eye="${x.id}" title="Mostrar/ocultar">${icon(x.visible === false ? 'eyeOff' : 'eye', 'sm')}</button>
    </div>`).join('')}</div></div>`;
  if (p) {
    const pts = gradedPoints(p, T(), B());
    const segs = segments(pts, true);
    const perim = perimeter(pts), ar = Math.abs(area(flatten(pts).pts)), cutA = Math.abs(area(pieceCut(p, pts)));
    html += `<div class="ins-sec"><h4>Pieza</h4>
      <div class="field"><label>Nombre</label><input class="input" data-f="name" value="${esc(p.name)}"></div>
      <div class="kv" style="margin-top:10px">
        <div class="field"><label>Cantidad</label><input class="input num" type="number" min="1" step="1" data-f="qty" value="${p.qty}"></div>
        <div class="field"><label>Margen (${U})</label><input class="input num" type="number" step="0.1" data-f="seam" value="${fromMM(p.seam ?? 10)}"></div>
        <div class="field"><label>Material</label><select class="select" data-f="material">${['Tela', 'Forro', 'Entretela', 'Contraste'].map((m) => `<option ${m === p.material ? 'selected' : ''}>${m}</option>`).join('')}</select></div>
        <div class="field"><label>Color</label><input class="input" type="color" data-f="color" value="${p.color}" style="padding:2px"></div>
      </div>
      <label class="check" style="margin-top:10px"><input type="checkbox" data-f="pair" ${p.pair ? 'checked' : ''}> Cortar en pares (una pieza en espejo)</label>
      <div class="field" style="margin-top:10px"><label>Al doblez (tramo)</label><select class="select" data-f="fold"><option value="">Sin doblez</option>${segs.map((s, i) => `<option value="${i}" ${p.fold === i ? 'selected' : ''}>${esc(pts[i].name || 'P' + (i + 1))} → ${esc(pts[(i + 1) % pts.length].name || 'P' + (i + 2))} · ${fmtLen(segLength(s))} ${U}</option>`).join('')}</select></div>
      <div class="kv" style="margin-top:12px">
        <div><small class="muted">Perímetro</small><div class="mono">${fmtLen(perim)} ${U}</div></div>
        <div><small class="muted">Área neta / corte</small><div class="mono">${(ar / 100).toFixed(0)} / ${(cutA / 100).toFixed(0)} cm²</div></div>
      </div>
    </div>`;
    if (state.ui.selSeg !== null && state.ui.selSeg !== undefined && segs[state.ui.selSeg]) {
      const i = state.ui.selSeg, s = segs[i];
      html += `<div class="ins-sec"><h4>Tramo ${i + 1} <span class="badge">${s.curve ? 'curva' : 'recta'}</span></h4>
        <table class="tbl"><tr><th>Talla</th><th class="num">Largo (${U})</th></tr>
        ${state.p.tabla.tallas.map((t) => `<tr><td><i class="dot" style="--c:${sizeColor(t)}"></i> ${esc(t)}</td><td class="num">${fmtLen(segLength(segments(gradedPoints(p, t, B()), true)[i]), 2)}</td></tr>`).join('')}</table>
        <div class="kv" style="margin-top:10px">
          <div class="field"><label>Margen del tramo (${U})</label><input class="input num" type="number" step="0.1" data-seg-seam="${i}" value="${p.seamEdges?.[i] !== undefined ? fromMM(p.seamEdges[i]) : ''}" placeholder="${fromMM(p.seam ?? 10)}"></div>
          <div class="field"><label>&nbsp;</label><button class="btn sm" data-seg-fold="${i}">${p.fold === i ? 'Quitar doblez' : 'Marcar doblez'}</button></div>
        </div></div>`;
    }
    const pi = p.points.findIndex((q) => q.id === state.ui.selPunto);
    if (pi >= 0) {
      const q = pts[pi], bq = p.points[pi];
      const rule = p.rules?.[T()]?.[bq.id];
      html += `<div class="ins-sec"><h4>Punto ${pi + 1} <span class="badge">${bq.h1 || bq.h2 ? 'curvo' : 'esquina'}</span></h4>
        <div class="field"><label>Nombre</label><input class="input" data-pf="name" value="${esc(bq.name || '')}"></div>
        <div class="kv" style="margin-top:8px">
          <div class="field"><label>X (${U}) · talla ${esc(T())}</label><input class="input num" type="number" step="0.1" data-pf="x" value="${fromMM(q.x)}"></div>
          <div class="field"><label>Y (${U})</label><input class="input num" type="number" step="0.1" data-pf="y" value="${fromMM(q.y)}"></div>
        </div>
        ${T() !== B() ? `<div class="hint" style="margin-top:8px">Regla de graduación en ${esc(T())}: Δx <b class="mono">${fmtLen(rule?.dx || 0, 2)}</b> · Δy <b class="mono">${fmtLen(rule?.dy || 0, 2)}</b> ${U}</div>` : ''}
        <div class="row" style="margin-top:10px"><button class="btn sm" data-pa="curve">${icon('curve', 'sm')}${bq.h1 || bq.h2 ? 'Hacer esquina' : 'Hacer curva'}</button><button class="btn sm danger" data-pa="del">${icon('trash', 'sm')}Eliminar</button></div>
      </div>`;
    }
  }
  html += `<div class="ins-sec"><h4>Vista</h4>
    <label class="check"><input type="checkbox" data-ui="nest" ${state.ui.nest ? 'checked' : ''}> Mostrar nido de tallas</label><br>
    <label class="check" style="margin-top:8px"><input type="checkbox" data-ui="showSeam" ${state.ui.showSeam ? 'checked' : ''}> Línea de corte (margen)</label><br>
    <label class="check" style="margin-top:8px"><input type="checkbox" data-ui="showLabels" ${state.ui.showLabels ? 'checked' : ''}> Rótulos de pieza</label>
    <div class="field" style="margin-top:10px"><label>Imán de rejilla</label><select class="select" data-ui-snap>${[[0, 'Libre'], [0.5, '0.5 mm'], [1, '1 mm'], [5, '5 mm'], [10, '1 cm']].map(([vv, l]) => `<option value="${vv}" ${state.ui.snap == vv ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
    <p class="hint" style="margin-top:10px">Edita en la talla base para cambiar la forma. En otra talla, mover un punto escribe su regla de graduación.</p>
  </div>`;
  ins.innerHTML = html;
  enhanceSelects(ins);
  bindInspector(p);
}

function bindInspector(p) {
  ins.querySelectorAll('[data-sel]').forEach((x) => x.addEventListener('click', (e) => {
    if (e.target.closest('[data-eye]')) return;
    state.ui.selPieza = x.dataset.sel; state.ui.selPunto = null; state.ui.selSeg = null; renderAll();
  }));
  ins.querySelectorAll('[data-eye]').forEach((b) => b.addEventListener('click', () => {
    const x = state.p.piezas.find((q) => q.id === b.dataset.eye); x.visible = x.visible === false; commit('Visibilidad');
  }));
  ins.querySelectorAll('[data-f]').forEach((inp) => inp.addEventListener('change', () => {
    const f = inp.dataset.f;
    if (f === 'qty') p.qty = Math.max(1, Math.round(+inp.value || 1));
    else if (f === 'seam') p.seam = Math.max(0, toMM(inp.value));
    else if (f === 'pair') p.pair = inp.checked;
    else if (f === 'fold') p.fold = inp.value === '' ? null : +inp.value;
    else p[f] = inp.value;
    commit('Propiedad de pieza');
  }));
  ins.querySelectorAll('[data-seg-seam]').forEach((inp) => inp.addEventListener('change', () => {
    const i = +inp.dataset.segSeam; p.seamEdges = p.seamEdges || {};
    if (inp.value === '') delete p.seamEdges[i]; else p.seamEdges[i] = Math.max(0, toMM(inp.value));
    commit('Margen de tramo');
  }));
  ins.querySelectorAll('[data-seg-fold]').forEach((b) => b.addEventListener('click', () => { const i = +b.dataset.segFold; p.fold = p.fold === i ? null : i; commit('Doblez'); }));
  ins.querySelectorAll('[data-pf]').forEach((inp) => inp.addEventListener('change', () => {
    const i = p.points.findIndex((q) => q.id === state.ui.selPunto);
    const pts = gradedPoints(p, T(), B());
    if (inp.dataset.pf === 'name') p.points[i].name = inp.value;
    else if (inp.dataset.pf === 'x') movePoint(p, i, toMM(inp.value), pts[i].y);
    else movePoint(p, i, pts[i].x, toMM(inp.value));
    commit('Editar punto');
  }));
  ins.querySelectorAll('[data-pa]').forEach((b) => b.addEventListener('click', () => {
    const i = p.points.findIndex((q) => q.id === state.ui.selPunto);
    if (b.dataset.pa === 'curve') { if (T() !== B()) return toast('Hazlo en la talla base', 'warn'); toggleSmooth(p, i); commit('Curva/esquina'); }
    else action('del');
  }));
  ins.querySelectorAll('[data-ui]').forEach((c) => c.addEventListener('change', () => { state.ui[c.dataset.ui] = c.checked; renderAll(); }));
  const sn = ins.querySelector('[data-ui-snap]'); if (sn) sn.addEventListener('change', () => { state.ui.snap = +sn.value; });
}

function renderAll() { drawPieces(); drawOverlay(); renderInspector(); status(); }

function render() {
  if (!isOn() || !state.p) return;
  if (!fitted) { requestAnimationFrame(() => { fit(); renderAll(); }); fitted = true; }
  applyVP();
  renderAll();
}

function onShow() { setTool(state.ui.tool || 'select'); render(); }

export default { id: 'editor', mount, render, onShow };
