// ============================================================
// HiloNova CAD — Verificación del patrón y checklist de producción
// ============================================================
import { state, commit } from '../store.js';
import { icon, h, esc, modal, fmtLen, unitLbl, toMM, fromMM, enhanceSelects } from '../ui.js';
import { evaluarCostura, gradedPoints } from '../../core/grading.js';
import { flatten, area, v } from '../../core/geom.js';
import { SIZE_COLORS } from '../../core/blocks.js';
import { resumen } from './trazo.js';

const CHECK = [
  ['proto', 'Prototipo cosido en talla base y aprobado en prueba de ajuste'],
  ['medidas', 'Medidas de prenda terminada revisadas contra la tabla'],
  ['piquetes', 'Piquetes de unión coinciden en todas las costuras'],
  ['hilo', 'Sentido del hilo verificado en todas las piezas'],
  ['encog', 'Encogimiento de la tela probado con lavado y aplicado al trazo'],
  ['extremas', 'Tallas extremas cortadas y revisadas'],
  ['trazo', 'Trazo aprobado con eficiencia igual o mayor al objetivo'],
  ['ficha', 'Ficha técnica completa y firmada por producción'],
];

let root;
function mount(el) { root = el; }

function selfIntersects(pts) {
  const n = pts.length;
  const inter = (a, b, c, d) => {
    const d1 = v.cross(v.sub(b, a), v.sub(c, a)), d2 = v.cross(v.sub(b, a), v.sub(d, a));
    const d3 = v.cross(v.sub(d, c), v.sub(a, c)), d4 = v.cross(v.sub(d, c), v.sub(b, c));
    return d1 * d2 < 0 && d3 * d4 < 0;
  };
  for (let i = 0; i < n; i++) for (let j = i + 2; j < n; j++) {
    if (i === 0 && j === n - 1) continue;
    if (inter(pts[i], pts[(i + 1) % n], pts[j], pts[(j + 1) % n])) return true;
  }
  return false;
}

export function auditoria(p) {
  const out = [];
  const add = (nivel, pieza, msg) => out.push({ nivel, pieza, msg });
  if (!p.piezas.length) add('bad', '—', 'El proyecto no tiene piezas.');
  p.piezas.forEach((pz) => {
    if (!pz.grain || pz.grain.length < 2) add('bad', pz.name, 'Sin línea de hilo.');
    if (!pz.qty || pz.qty < 1) add('bad', pz.name, 'Cantidad en cero.');
    if (pz.pair && pz.qty % 2 === 1) add('warn', pz.name, 'Marcada en pares pero la cantidad es impar.');
    if (pz.fold !== null && pz.fold !== undefined && pz.pair) add('warn', pz.name, 'Va al doblez y además en pares: revisa la cantidad.');
    p.tabla.tallas.forEach((t) => {
      const pts = flatten(gradedPoints(pz, t, p.tabla.base), true, 1.5).pts;
      if (Math.abs(area(pts)) < 100) add('bad', pz.name, `Área casi nula en talla ${t}.`);
      else if (selfIntersects(pts)) add('warn', pz.name, `El contorno se cruza en talla ${t}.`);
    });
    const others = p.tabla.tallas.filter((t) => t !== p.tabla.base);
    const sinRegla = others.filter((t) => !pz.rules?.[t] || Object.values(pz.rules[t]).every((r) => !r.dx && !r.dy));
    if (others.length && sinRegla.length === others.length) add('warn', pz.name, 'Sin graduación: todas las tallas son iguales a la base.');
    if (!(pz.notches || []).length && pz.points.length > 4) add('info', pz.name, 'Sin piquetes de unión.');
  });
  const R = resumen(p);
  if (!R) add('info', 'Trazo', 'Aún no hay trazo generado.');
  else if (R.desactualizado) add('warn', 'Trazo', 'El trazo no corresponde al patrón actual.');
  else if (R.eficiencia < 0.7) add('warn', 'Trazo', `Eficiencia baja (${(R.eficiencia * 100).toFixed(1)}%). Prueba más tiempo de búsqueda o combina tallas.`);
  return out;
}

function render() {
  if (!root || !root.classList.contains('on') || !state.p) return;
  const p = state.p, tallas = p.tabla.tallas, U = unitLbl();
  const aud = auditoria(p);
  const cos = (p.costuras || []).map((c) => ({ c, r: tallas.map((t) => evaluarCostura(p, c, t)) }));
  const okC = cos.filter((x) => x.r.every((r) => r.ok)).length;
  const ck = p.checklist || (p.checklist = {});
  const done = CHECK.filter(([k]) => ck[k]).length;
  const bad = aud.filter((a) => a.nivel === 'bad').length, warn = aud.filter((a) => a.nivel === 'warn').length;
  const score = Math.round(((cos.length ? okC / cos.length : 1) * 40) + (Math.max(0, 1 - (bad * 0.25 + warn * 0.06)) * 30) + (done / CHECK.length) * 30);
  root.innerHTML = `<div class="page">
    <div class="page-h"><div><h1>Verificación</h1><p>Revisión automática del patrón, cuadre de costuras por talla y checklist de liberación a producción.</p></div>
      <button class="btn" id="vAdd">${icon('plus', 'sm')}Nueva verificación de costura</button></div>
    <div class="grid4" style="margin-bottom:14px">
      <div class="kpi"><small>Índice de liberación</small><b style="color:${score >= 85 ? 'var(--ok)' : score >= 60 ? 'var(--warn)' : 'var(--bad)'}">${score}<em>/100</em></b></div>
      <div class="kpi"><small>Costuras que cuadran</small><b>${okC}<em>/ ${cos.length}</em></b></div>
      <div class="kpi"><small>Alertas del patrón</small><b>${bad + warn}<em>${bad} críticas</em></b></div>
      <div class="kpi"><small>Checklist</small><b>${done}<em>/ ${CHECK.length}</em></b></div>
    </div>
    <div class="card" style="margin-bottom:14px"><div class="card-h">Cuadre de costuras (${U})</div><div style="overflow:auto"><table class="tbl">
      <tr><th>Costura</th><th class="num">Esperado</th>${tallas.map((t, i) => `<th class="num"><i class="dot" style="--c:${SIZE_COLORS[i % SIZE_COLORS.length]}"></i> ${esc(t)}</th>`).join('')}<th></th></tr>
      ${cos.map(({ c, r }, ci) => `<tr><td>${esc(c.nombre)}</td><td class="num">${fmtLen(c.esperado || 0, 1)} ±${fmtLen(c.tol ?? 3, 1)}</td>
        ${r.map((x) => `<td class="num" title="A ${fmtLen(x.A, 2)} · B ${fmtLen(x.B, 2)}"><span class="badge ${x.ok ? 'ok' : 'bad'}">${x.dif >= 0 ? '+' : ''}${fmtLen(x.dif, 2)}</span></td>`).join('')}
        <td><button class="btn icon sm ghost" data-rmc="${ci}" title="Quitar">${icon('x', 'sm')}</button></td></tr>`).join('') || `<tr><td colspan="${tallas.length + 3}" class="muted">Sin verificaciones. Agrega una para comparar el largo de dos costuras en todas las tallas.</td></tr>`}
    </table></div><div class="hint" style="padding:10px 14px;border-top:1px solid var(--line)">Diferencia = lado A − lado B. En copa de manga contra sisa la diferencia esperada es el embebido.</div></div>
    <div class="grid2" style="align-items:start">
      <div class="card"><div class="card-h">Auditoría del patrón</div><div style="max-height:420px;overflow:auto"><table class="tbl">
        ${aud.length ? aud.map((a) => `<tr><td style="width:30px">${icon(a.nivel === 'bad' ? 'bad' : a.nivel === 'warn' ? 'alert' : 'info', 'sm')}</td><td><b>${esc(a.pieza)}</b></td><td style="white-space:normal">${esc(a.msg)}</td></tr>`).join('').replace(/<svg class="ic sm"/g, (m) => m) : `<tr><td>${icon('ok', 'sm')}</td><td>Sin alertas. El patrón está listo para trazo.</td></tr>`}
      </table></div></div>
      <div class="card"><div class="card-h">Checklist de liberación</div><div class="card-b" style="display:flex;flex-direction:column;gap:10px">
        ${CHECK.map(([k, l]) => `<label class="check"><input type="checkbox" data-ck="${k}" ${ck[k] ? 'checked' : ''}> ${esc(l)}</label>`).join('')}
        <div class="bar" style="margin-top:6px"><i style="width:${(done / CHECK.length) * 100}%"></i></div>
      </div></div>
    </div></div>`;
  root.querySelectorAll('[data-ck]').forEach((c) => c.addEventListener('change', () => { ck[c.dataset.ck] = c.checked; commit('Checklist'); }));
  root.querySelectorAll('[data-rmc]').forEach((b) => b.addEventListener('click', () => { p.costuras.splice(+b.dataset.rmc, 1); commit('Quitar verificación'); }));
  root.querySelector('#vAdd').onclick = nuevaCostura;
  // colores de iconos de auditoría
  root.querySelectorAll('.tbl td:first-child svg').forEach((s) => { const u = s.innerHTML; s.style.color = u.includes('M15 9l-6 6') ? 'var(--bad)' : u.includes('M12 3l10 18') ? 'var(--warn)' : u.includes('M8 12l3 3') ? 'var(--ok)' : 'var(--accent)'; });
}

function nuevaCostura() {
  const p = state.p;
  const pieceOpts = p.piezas.map((x) => `<option value="${x.id}">${esc(x.name)}</option>`).join('');
  const side = (s) => `<div class="card" style="padding:12px"><b>Lado ${s}</b><div class="grid3" style="margin-top:10px">
    <div class="field"><label>Pieza</label><select class="select" data-s="${s}" data-k="p">${pieceOpts}</select></div>
    <div class="field"><label>Desde punto</label><select class="select" data-s="${s}" data-k="from"></select></div>
    <div class="field"><label>Hasta punto</label><select class="select" data-s="${s}" data-k="to"></select></div></div></div>`;
  const body = h(`<div style="display:flex;flex-direction:column;gap:12px">
    <div class="field"><label>Nombre</label><input class="input" id="cn" value="Costura ${(p.costuras || []).length + 1}"></div>
    ${side('A')}${side('B')}
    <div class="grid2"><div class="field"><label>Diferencia esperada A−B (${unitLbl()})</label><input class="input num" type="number" step="0.1" id="ce" value="0"></div>
    <div class="field"><label>Tolerancia ± (${unitLbl()})</label><input class="input num" type="number" step="0.1" id="ct" value="${fromMM(3)}"></div></div>
    <p class="hint" style="margin:0">El tramo se mide recorriendo el contorno desde el primer punto hasta el segundo en el sentido de la pieza.</p></div>`);
  const fill = (s) => {
    const pz = p.piezas.find((x) => x.id === body.querySelector(`[data-s="${s}"][data-k="p"]`).value);
    const opts = pz.points.map((q, i) => `<option value="${q.id}">${i + 1} · ${esc(q.name || '')}</option>`).join('');
    ['from', 'to'].forEach((k, j) => { const sel = body.querySelector(`[data-s="${s}"][data-k="${k}"]`); sel.innerHTML = opts; sel.selectedIndex = Math.min(j, pz.points.length - 1); sel._sync && sel._sync(); });
  };
  modal({ title: 'Nueva verificación de costura', body, wide: true, actions: [
    { label: 'Cancelar', cls: 'ghost' },
    { label: 'Agregar', cls: 'pri', onClick: () => {
      const g = (s, k) => body.querySelector(`[data-s="${s}"][data-k="${k}"]`).value;
      const pk = (id) => p.piezas.find((x) => x.id === id).id;
      p.costuras = p.costuras || [];
      p.costuras.push({ nombre: body.querySelector('#cn').value, a: [{ p: pk(g('A', 'p')), from: g('A', 'from'), to: g('A', 'to') }], b: [{ p: pk(g('B', 'p')), from: g('B', 'from'), to: g('B', 'to') }], esperado: toMM(body.querySelector('#ce').value), tol: toMM(body.querySelector('#ct').value) });
      commit('Nueva verificación');
    } },
  ] });
  ['A', 'B'].forEach((s) => { fill(s); body.querySelector(`[data-s="${s}"][data-k="p"]`).addEventListener('change', () => fill(s)); });
  enhanceSelects(body);
}

export default { id: 'verificacion', mount, render, onShow: render };
