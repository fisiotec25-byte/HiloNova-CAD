// ============================================================
// HiloNova CAD — Graduación (nido de tallas + tabla de reglas)
// ============================================================
import { state, commit, pieza } from '../store.js';
import { icon, h, esc, toast, modal, fmtLen, unitLbl, toMM, fromMM, enhanceSelects } from '../ui.js';
import { SIZE_COLORS } from '../../core/blocks.js';
import { gradedPoints, setRule, copyRule, reglaProporcional } from '../../core/grading.js';
import { pathD, flatten, bbox, perimeter } from '../../core/geom.js';
import { pieceSVG } from '../render.js';

let root; const selRows = new Set();
const sc = (t) => SIZE_COLORS[state.p.tabla.tallas.indexOf(t) % SIZE_COLORS.length];

function mount(el) { root = el; }

function render() {
  if (!root || !root.classList.contains('on') || !state.p) return;
  const p = state.p, tab = p.tabla, pz = pieza() || p.piezas[0];
  if (!pz) { root.innerHTML = `<div class="page"><div class="empty">${icon('grade')}<div>No hay piezas para graduar. Crea o genera piezas primero.</div></div></div>`; return; }
  state.ui.selPieza = pz.id;
  const others = tab.tallas.filter((t) => t !== tab.base);
  const U = unitLbl();
  root.innerHTML = `<div class="page" style="display:flex;flex-direction:column;gap:14px;padding-bottom:20px">
    <div class="page-h" style="margin:0"><div><h1>Graduación</h1><p>Nido de tallas y reglas por punto (Δx, Δy) respecto a la talla base <b>${esc(tab.base)}</b>.</p></div>
      <div class="row wrap">${p.piezas.map((x) => `<button class="btn sm ${x.id === pz.id ? 'pri' : ''}" data-pz="${x.id}">${esc(x.name)}</button>`).join('')}</div></div>
    <div style="display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,1fr);gap:14px;min-height:0;flex:1">
      <div class="card" style="display:flex;flex-direction:column;min-height:520px">
        <div class="card-h"><span>Nido · ${esc(pz.name)}</span><span class="row" style="gap:8px">${tab.tallas.map((t) => `<label class="check" style="font-weight:500"><input type="checkbox" data-show="${esc(t)}" ${state.ui.showSizes[t] !== false ? 'checked' : ''}><i class="dot" style="--c:${sc(t)}"></i>${esc(t)}</label>`).join('')}</span></div>
        <div style="flex:1;position:relative;background:var(--canvas);border-radius:0 0 12px 12px"><svg class="cv" id="gSvg" style="position:absolute;inset:0;width:100%;height:100%"></svg></div>
        <div style="padding:10px 14px;border-top:1px solid var(--line)"><table class="tbl"><tr><th>Talla</th>${tab.tallas.map((t) => `<th class="num">${esc(t)}</th>`).join('')}</tr>
          <tr><td>Perímetro (${U})</td>${tab.tallas.map((t) => `<td class="num">${fmtLen(perimeter(gradedPoints(pz, t, tab.base)))}</td>`).join('')}</tr>
          <tr><td>Ancho × alto (${U})</td>${tab.tallas.map((t) => { const b = bbox(flatten(gradedPoints(pz, t, tab.base)).pts); return `<td class="num">${fmtLen(b.w)} × ${fmtLen(b.h)}</td>`; }).join('')}</tr></table></div>
      </div>
      <div class="card" style="display:flex;flex-direction:column;min-height:0">
        <div class="card-h"><span>Tabla de reglas (${U})</span>
          <span class="row" style="gap:6px">
            <button class="btn sm" id="gProp" title="Graduación proporcional">${icon('wand', 'sm')}Proporcional</button>
            <button class="btn sm" id="gCopy" title="Copiar la regla del primer punto seleccionado a los demás">${icon('copy', 'sm')}Copiar regla</button>
            <button class="btn sm" id="gZero" title="Poner en cero las reglas seleccionadas">${icon('x', 'sm')}Cero</button>
          </span></div>
        <div style="overflow:auto;flex:1"><table class="tbl" id="gTbl"><thead><tr><th style="width:28px"></th><th>Punto</th>${others.map((t) => `<th class="num" colspan="2"><span class="row" style="gap:5px;justify-content:center"><i class="dot" style="--c:${sc(t)}"></i>${esc(t)}</span></th>`).join('')}</tr>
          <tr><th></th><th></th>${others.map(() => '<th class="num">Δx</th><th class="num">Δy</th>').join('')}</tr></thead>
          <tbody>${pz.points.map((q, i) => `<tr class="${selRows.has(q.id) ? 'sel' : ''}" data-row="${q.id}"><td><input type="checkbox" data-ck="${q.id}" ${selRows.has(q.id) ? 'checked' : ''} style="accent-color:var(--accent)"></td>
            <td><b class="mono">${i + 1}</b> <span class="muted">${esc(q.name || '')}</span></td>
            ${others.map((t) => { const r = pz.rules?.[t]?.[q.id] || { dx: 0, dy: 0 }; return `<td style="width:84px;min-width:84px"><input class="input num" type="number" step="0.05" data-r="${q.id}" data-t="${esc(t)}" data-ax="dx" value="${fromMM(r.dx || 0)}"></td><td style="width:84px;min-width:84px"><input class="input num" type="number" step="0.05" data-r="${q.id}" data-t="${esc(t)}" data-ax="dy" value="${fromMM(r.dy || 0)}"></td>`; }).join('')}
          </tr>`).join('')}</tbody></table></div>
        <div class="hint" style="padding:10px 14px;border-top:1px solid var(--line)">Selecciona filas con la casilla. <b>Copiar regla</b> toma la primera fila seleccionada como origen. Los valores positivos van a la derecha (Δx) y hacia abajo (Δy).</div>
      </div>
    </div></div>`;
  drawNest(pz);
  root.querySelectorAll('[data-pz]').forEach((b) => b.addEventListener('click', () => { state.ui.selPieza = b.dataset.pz; selRows.clear(); render(); }));
  root.querySelectorAll('[data-show]').forEach((c) => c.addEventListener('change', () => { state.ui.showSizes[c.dataset.show] = c.checked; drawNest(pz); }));
  root.querySelectorAll('[data-ck]').forEach((c) => c.addEventListener('change', () => { c.checked ? selRows.add(c.dataset.ck) : selRows.delete(c.dataset.ck); c.closest('tr').classList.toggle('sel', c.checked); drawNest(pz); }));
  root.querySelectorAll('[data-r]').forEach((inp) => inp.addEventListener('change', () => {
    const r = pz.rules?.[inp.dataset.t]?.[inp.dataset.r] || { dx: 0, dy: 0 };
    const val = toMM(inp.value);
    setRule(pz, inp.dataset.t, inp.dataset.r, inp.dataset.ax === 'dx' ? val : r.dx || 0, inp.dataset.ax === 'dy' ? val : r.dy || 0);
    commit('Regla');
  }));
  root.querySelector('#gZero').onclick = () => {
    if (!selRows.size) return toast('Selecciona puntos en la tabla', 'warn');
    others.forEach((t) => selRows.forEach((id) => { setRule(pz, t, id, 0, 0); if (pz.rules[t][id]) { delete pz.rules[t][id].dh1; delete pz.rules[t][id].dh2; } }));
    commit('Reglas en cero');
  };
  root.querySelector('#gCopy').onclick = () => {
    const ids = pz.points.map((q) => q.id).filter((id) => selRows.has(id));
    if (ids.length < 2) return toast('Selecciona el punto origen y al menos un destino', 'warn');
    const body = h(`<div><p style="margin:0 0 12px">Copiar la regla del punto <b>${pz.points.findIndex((q) => q.id === ids[0]) + 1}</b> a ${ids.length - 1} punto(s).</p>
      <label class="check"><input type="checkbox" id="fx"> Invertir Δx (espejo horizontal)</label><br><label class="check" style="margin-top:8px"><input type="checkbox" id="fy"> Invertir Δy</label></div>`);
    modal({ title: 'Copiar regla', body, actions: [{ label: 'Cancelar', cls: 'ghost' }, { label: 'Copiar', cls: 'pri', onClick: () => { copyRule(pz, others, ids[0], ids.slice(1), { flipX: body.querySelector('#fx').checked, flipY: body.querySelector('#fy').checked }); commit('Copiar regla'); } }] });
  };
  root.querySelector('#gProp').onclick = () => {
    const body = h(`<div style="display:flex;flex-direction:column;gap:12px">
      <p class="hint" style="margin:0">Reparte un incremento total por talla según la distancia de cada punto al punto ancla. Útil para piezas dibujadas a mano.</p>
      <div class="field"><label>Punto ancla (no se mueve)</label><select class="select" id="pa">${pz.points.map((q, i) => `<option value="${q.id}">${i + 1} · ${esc(q.name || '')}</option>`).join('')}</select></div>
      <div class="grid2"><div class="field"><label>Incremento ancho por talla (${U})</label><input class="input num" type="number" step="0.1" id="ix" value="1.5"></div>
      <div class="field"><label>Incremento alto por talla (${U})</label><input class="input num" type="number" step="0.1" id="iy" value="1"></div></div>
      <p class="hint" style="margin:0;color:var(--warn)">Reemplaza todas las reglas de esta pieza.</p></div>`);
    modal({ title: 'Graduación proporcional', body, actions: [{ label: 'Cancelar', cls: 'ghost' }, { label: 'Aplicar', cls: 'pri', onClick: () => { reglaProporcional(pz, tab, { anclaId: body.querySelector('#pa').value, incX: toMM(body.querySelector('#ix').value), incY: toMM(body.querySelector('#iy').value) }); commit('Graduación proporcional'); } }] });
  };
  enhanceSelects(root);
}

function drawNest(pz) {
  const svg = root.querySelector('#gSvg'); if (!svg) return;
  const tab = state.p.tabla;
  let all = [];
  tab.tallas.forEach((t) => { all = all.concat(flatten(gradedPoints(pz, t, tab.base)).pts); });
  const bb = bbox(all), m = Math.max(bb.w, bb.h) * 0.08;
  svg.setAttribute('viewBox', `${bb.x - m} ${bb.y - m} ${bb.w + 2 * m} ${bb.h + 2 * m}`);
  const fs = Math.max(bb.w, bb.h) / 48;
  let s = '';
  tab.tallas.forEach((t) => {
    if (state.ui.showSizes[t] === false) return;
    s += `<g style="color:${sc(t)}">${pieceSVG(pz, { talla: t, base: tab.base, color: sc(t), fill: t === tab.base, seam: false, notches: false, internals: false, grain: t === tab.base, fold: false })}</g>`;
  });
  // flechas de regla (base -> talla extrema) y etiquetas de punto
  const ext = tab.tallas[tab.tallas.length - 1] === tab.base ? tab.tallas[0] : tab.tallas[tab.tallas.length - 1];
  const bp = pz.points, ep = gradedPoints(pz, ext, tab.base);
  bp.forEach((q, i) => {
    const e = ep[i], on = selRows.has(q.id);
    if (Math.hypot(e.x - q.x, e.y - q.y) > 0.5) s += `<line x1="${q.x}" y1="${q.y}" x2="${e.x}" y2="${e.y}" stroke="${on ? '#fbbf24' : 'var(--muted)'}" stroke-width="${on ? 2 : 1}" vector-effect="non-scaling-stroke" stroke-dasharray="${on ? '' : '3 3'}"/>`;
    s += `<circle cx="${q.x}" cy="${q.y}" r="${fs * 0.28}" fill="${on ? '#fbbf24' : 'var(--canvas)'}" stroke="${on ? '#fbbf24' : 'var(--accent)'}" stroke-width="1.4" vector-effect="non-scaling-stroke" data-pt="${q.id}" style="cursor:pointer"/>`;
    s += `<text x="${q.x + fs * 0.45}" y="${q.y - fs * 0.35}" font-size="${fs}" fill="${on ? '#fbbf24' : 'var(--text)'}" font-weight="600">${i + 1}</text>`;
  });
  svg.innerHTML = s;
  svg.querySelectorAll('[data-pt]').forEach((c) => c.addEventListener('click', () => {
    const id = c.dataset.pt; selRows.has(id) ? selRows.delete(id) : selRows.add(id);
    const ck = root.querySelector(`[data-ck="${id}"]`); if (ck) { ck.checked = selRows.has(id); ck.closest('tr').classList.toggle('sel', ck.checked); ck.closest('tr').scrollIntoView({ block: 'nearest' }); }
    drawNest(pz);
  }));
}

export default { id: 'graduacion', mount, render, onShow: render };
void pathD;
