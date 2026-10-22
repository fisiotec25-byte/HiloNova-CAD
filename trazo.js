// ============================================================
// HiloNova CAD — Trazo (acomodo automático y consumo de tela)
// ============================================================
import { state, commit, saveSoon } from '../store.js';
import { icon, esc, toast, fmtLen, unitLbl, toMM, fromMM, enhanceSelects } from '../ui.js';
import { SIZE_COLORS } from '../../core/blocks.js';
import { gradedPoints, grainAngle } from '../../core/grading.js';
import { area, polyPathD, bbox, v } from '../../core/geom.js';
import { cutPolyFull } from '../render.js';

let root, worker = null, running = false, progress = null;
const sc = (t) => SIZE_COLORS[state.p.tabla.tallas.indexOf(t) % SIZE_COLORS.length];

// ---------- Construcción de piezas a acomodar ----------
export function materiales(p) { return [...new Set(p.piezas.map((x) => x.material || 'Tela'))]; }

export function buildItems(p) {
  const tz = p.trazo, items = [];
  const sx = 1 + (tz.encL || 0) / 100, sy = 1 + (tz.encA || 0) / 100;
  for (const t of p.tabla.tallas) {
    const n = Math.max(0, Math.round(tz.cantidades[t] || 0));
    for (let k = 0; k < n; k++) {
      for (const pz of p.piezas) {
        if ((pz.material || 'Tela') !== (tz.tela || 'Tela')) continue;
        const pts = gradedPoints(pz, t, p.tabla.base);
        const poly0 = cutPolyFull(pz, pts);
        const th = grainAngle(pz);
        for (let q = 0; q < pz.qty; q++) {
          const flip = pz.pair && q % 2 === 1;
          let poly = flip ? poly0.map((a) => ({ x: -a.x, y: a.y })) : poly0;
          const thq = flip ? Math.PI - th : th;
          // el hilo queda paralelo al largo (eje X); el encogimiento se aplica en ejes de tela
          const base = -thq;
          poly = poly.map((a) => { const r = v.rot(a, base); return { x: r.x * sx, y: r.y * sy }; });
          const ors = tz.sentido === 'uno' ? [0] : tz.sentido === 'libre' ? [0, Math.PI / 2, Math.PI, Math.PI * 1.5] : [0, Math.PI];
          items.push({ id: `${pz.id}|${t}|${k}|${q}`, pid: pz.id, talla: t, poly, area: Math.abs(area(poly)), orients: ors, name: pz.name, flip, color: pz.color });
        }
      }
    }
  }
  return items;
}

export function firma(p) {
  const s = JSON.stringify([p.piezas.map((x) => [x.points, x.rules, x.qty, x.pair, x.seam, x.seamEdges, x.fold, x.grain, x.material]), p.tabla, p.trazo.cantidades, p.trazo.ancho, p.trazo.orilla, p.trazo.separacion, p.trazo.sentido, p.trazo.tela, p.trazo.encL, p.trazo.encA, p.trazo.res]);
  let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return String(h >>> 0);
}

// Polígonos colocados a partir del resultado guardado
export function colocados(p) {
  const r = p.trazo.resultado; if (!r) return [];
  const items = Object.fromEntries(buildItems(p).map((i) => [i.id, i]));
  return r.placements.map((pl) => {
    const it = items[pl.id]; if (!it) return null;
    const c = Math.cos(pl.ang), s = Math.sin(pl.ang);
    return { ...it, pts: it.poly.map((a) => ({ x: a.x * c - a.y * s + pl.tx, y: a.x * s + a.y * c + pl.ty })) };
  }).filter(Boolean);
}

export function resumen(p) {
  const r = p.trazo.resultado; if (!r) return null;
  const items = buildItems(p);
  const sumA = items.reduce((s, i) => s + i.area, 0);
  const prendas = p.tabla.tallas.reduce((s, t) => s + Math.max(0, Math.round(p.trazo.cantidades[t] || 0)), 0);
  const largoTot = r.largo + 2 * (p.trazo.margenExtremo ?? 10);
  const ef = sumA / (p.trazo.ancho * r.largo);
  // consumo por prenda de cada talla, proporcional a su área neta (la suma reproduce el largo total)
  const porTalla = {};
  p.tabla.tallas.forEach((t) => {
    const n = Math.round(p.trazo.cantidades[t] || 0); if (!n) return;
    const a = items.filter((i) => i.talla === t).reduce((s, i) => s + i.area, 0) / n;
    porTalla[t] = { area: a, consumo: sumA ? (largoTot * a) / sumA : 0 };
  });
  return { largo: largoTot, eficiencia: ef, piezas: items.length, prendas, consumoProm: prendas ? largoTot / prendas : 0, areaTela: p.trazo.ancho * largoTot, areaPiezas: sumA, porTalla, iter: r.iter, desactualizado: r.firma !== firma(p) };
}

function mount(el) { root = el; }

function render() {
  if (!root || !root.classList.contains('on') || !state.p) return;
  const p = state.p, tz = p.trazo, U = unitLbl();
  tz.encL = tz.encL ?? 0; tz.encA = tz.encA ?? 0;
  const mats = materiales(p);
  if (!mats.includes(tz.tela)) tz.tela = mats[0] || 'Tela';
  const R = resumen(p);
  root.innerHTML = `<div class="marker-wrap">
    <div class="marker-side">
      <div class="ins-sec"><h4>Tela</h4>
        <div class="kv"><div class="field"><label>Ancho útil (${U})</label><input class="input num" type="number" step="1" data-t="ancho" value="${fromMM(tz.ancho, 1)}"></div>
        <div class="field"><label>Orilla (${U})</label><input class="input num" type="number" step="0.1" data-t="orilla" value="${fromMM(tz.orilla, 1)}"></div>
        <div class="field"><label>Separación (mm)</label><input class="input num" type="number" step="0.5" data-t="separacion" value="${tz.separacion}"></div>
        <div class="field"><label>Material</label><select class="select" data-t="tela">${mats.map((m) => `<option ${m === tz.tela ? 'selected' : ''}>${esc(m)}</option>`).join('')}</select></div></div>
        <div class="field" style="margin-top:10px"><label>Sentido de la tela</label><div class="seg" id="tSent">${[['dos', 'Dos sentidos'], ['uno', 'Un sentido (pelo)'], ['libre', 'Libre 90°']].map(([k, l]) => `<button class="${tz.sentido === k ? 'on' : ''}" data-s="${k}">${l}</button>`).join('')}</div></div>
        <div class="kv" style="margin-top:10px"><div class="field"><label>Encogimiento largo %</label><input class="input num" type="number" step="0.5" data-t="encL" value="${tz.encL}"></div>
        <div class="field"><label>Encogimiento ancho %</label><input class="input num" type="number" step="0.5" data-t="encA" value="${tz.encA}"></div></div>
      </div>
      <div class="ins-sec"><h4>Prendas por talla</h4>
        <div class="grid2" style="gap:8px">${p.tabla.tallas.map((t) => `<div class="field"><label><i class="dot" style="--c:${sc(t)}"></i> ${esc(t)}</label><input class="input num" type="number" min="0" step="1" data-q="${esc(t)}" value="${tz.cantidades[t] ?? 0}"></div>`).join('')}</div>
      </div>
      <div class="ins-sec"><h4>Optimización</h4>
        <div class="kv"><div class="field"><label>Precisión</label><select class="select" data-t="res">${[[10, 'Rápida (10 mm)'], [5, 'Normal (5 mm)'], [2.5, 'Fina (2.5 mm)']].map(([vv, l]) => `<option value="${vv}" ${tz.res == vv ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
        <div class="field"><label>Búsqueda (seg)</label><input class="input num" type="number" min="1" max="120" step="1" data-t="tiempo" value="${tz.tiempo}"></div></div>
        <button class="btn pri" id="tRun" style="width:100%;margin-top:12px;height:38px">${running ? icon('stop', 'sm') + 'Detener' : icon('play', 'sm') + 'Generar trazo'}</button>
        <div class="progress" style="margin-top:10px"><i id="tProg"></i></div>
        <div class="hint" id="tMsg" style="margin-top:8px">${running ? 'Optimizando…' : R ? (R.desactualizado ? '<span style="color:var(--warn)">El patrón o la configuración cambiaron. Vuelve a generar el trazo.</span>' : `Mejor resultado tras ${R.iter} combinaciones.`) : 'El sistema prueba cientos de órdenes y giros y conserva el trazo más corto.'}</div>
      </div>
      ${R ? `<div class="ins-sec"><h4>Consumo por talla</h4><table class="tbl">${Object.entries(R.porTalla).map(([t, x]) => `<tr><td><i class="dot" style="--c:${sc(t)}"></i> ${esc(t)}</td><td class="num">${(x.consumo / 1000).toFixed(3)} m</td><td style="width:40%"><div class="bar"><i style="width:${Math.min(100, (x.consumo / Math.max(...Object.values(R.porTalla).map((y) => y.consumo))) * 100)}%"></i></div></td></tr>`).join('')}</table></div>` : ''}
    </div>
    <div class="marker-main">
      <div class="marker-stage" id="tStage">${R ? '' : `<div class="empty" style="height:100%">${icon('marker')}<div>Configura la tela y las cantidades, luego presiona <b>Generar trazo</b>.</div></div>`}</div>
      <div class="marker-stats">
        <div class="kpi"><small>Largo del trazo</small><b>${R ? (R.largo / 1000).toFixed(3) : '—'}<em>m</em></b></div>
        <div class="kpi"><small>Eficiencia</small><b style="color:${R ? (R.eficiencia >= 0.8 ? 'var(--ok)' : R.eficiencia >= 0.7 ? 'var(--warn)' : 'var(--bad)') : 'inherit'}">${R ? (R.eficiencia * 100).toFixed(1) : '—'}<em>%</em></b></div>
        <div class="kpi"><small>Consumo por prenda</small><b>${R ? (R.consumoProm / 1000).toFixed(3) : '—'}<em>m</em></b></div>
        <div class="kpi"><small>Piezas / prendas</small><b>${R ? R.piezas : '—'}<em>/ ${R ? R.prendas : ''}</em></b></div>
        <div class="kpi"><small>Desperdicio</small><b>${R ? ((R.areaTela - R.areaPiezas) / 1e6).toFixed(2) : '—'}<em>m²</em></b></div>
      </div>
    </div></div>`;
  enhanceSelects(root);
  if (R) drawMarker();
  root.querySelectorAll('[data-t]').forEach((inp) => inp.addEventListener('change', () => {
    const k = inp.dataset.t;
    if (k === 'ancho' || k === 'orilla') tz[k] = toMM(inp.value);
    else if (k === 'tela') tz.tela = inp.value;
    else tz[k] = +inp.value;
    commit('Configurar trazo');
  }));
  root.querySelectorAll('[data-q]').forEach((inp) => inp.addEventListener('change', () => { tz.cantidades[inp.dataset.q] = Math.max(0, Math.round(+inp.value || 0)); commit('Cantidades'); }));
  root.querySelectorAll('#tSent [data-s]').forEach((b) => b.addEventListener('click', () => { tz.sentido = b.dataset.s; commit('Sentido'); }));
  root.querySelector('#tRun').onclick = () => (running ? stop() : run());
}

function drawMarker() {
  const p = state.p, st = root.querySelector('#tStage'); if (!st) return;
  const r = p.trazo.resultado, W = p.trazo.ancho;
  const L = Math.max(r.largo, 100);
  const H = Math.max(260, st.clientHeight - 60);
  const k = H / W;
  const placed = colocados(p);
  let s = `<svg class="cv" width="${(L + 40) * k + 40}" height="${H + 50}" viewBox="${-60 / k} ${-30 / k} ${L + 40 / k + 100 / k} ${W + 80 / k}" style="position:static;display:block">`;
  s += `<rect x="0" y="0" width="${L}" height="${W}" fill="var(--panel2)" stroke="var(--line2)" vector-effect="non-scaling-stroke"/>`;
  s += `<rect x="0" y="0" width="${L}" height="${p.trazo.orilla}" fill="rgba(251,191,36,.08)"/><rect x="0" y="${W - p.trazo.orilla}" width="${L}" height="${p.trazo.orilla}" fill="rgba(251,191,36,.08)"/>`;
  for (let x = 0; x <= L; x += 100) {
    const big = x % 500 === 0;
    s += `<line x1="${x}" y1="${-6 / k}" x2="${x}" y2="${big ? -16 / k : -10 / k}" stroke="var(--muted)" vector-effect="non-scaling-stroke"/>`;
    if (big) s += `<text x="${x}" y="${-20 / k}" font-size="${11 / k}" fill="var(--muted)" text-anchor="middle">${(x / 1000).toFixed(1)} m</text>`;
  }
  s += `<text x="${-12 / k}" y="${W / 2}" font-size="${11 / k}" fill="var(--muted)" text-anchor="middle" transform="rotate(-90 ${-12 / k} ${W / 2})">${fmtLen(W, 0)} ${unitLbl()}</text>`;
  placed.forEach((it) => {
    const col = sc(it.talla);
    const bb = bbox(it.pts);
    s += `<path d="${polyPathD(it.pts)}" fill="${col}" fill-opacity=".22" stroke="${col}" stroke-width="1.2" vector-effect="non-scaling-stroke" fill-rule="nonzero"><title>${esc(it.name)} · ${esc(it.talla)}${it.flip ? ' (espejo)' : ''}</title></path>`;
    const fs = Math.min(bb.h * 0.22, bb.w * 0.16, 40);
    if (fs * k > 6) s += `<text x="${bb.x + bb.w / 2}" y="${bb.y + bb.h / 2}" font-size="${fs}" fill="${col}" text-anchor="middle" dominant-baseline="middle" font-weight="600">${esc(it.talla)}</text>`;
  });
  s += `<line x1="${r.largo}" y1="${-4 / k}" x2="${r.largo}" y2="${W + 4 / k}" stroke="var(--accent)" stroke-width="1.5" stroke-dasharray="6 4" vector-effect="non-scaling-stroke"/>`;
  s += '</svg>';
  st.innerHTML = s;
}

function run() {
  const p = state.p, tz = p.trazo;
  const items = buildItems(p);
  if (!items.length) return toast('No hay piezas de ese material o cantidades en cero', 'warn');
  running = true; render();
  const t0 = Date.now(), ms = tz.tiempo * 1000;
  try { worker = new Worker(new URL('../nest.worker.js', import.meta.url)); }
  catch (e) { running = false; render(); return toast('Tu navegador no permite el optimizador: ' + e.message, 'bad'); }
  const prog = () => { const el = root.querySelector('#tProg'); if (el) el.style.width = Math.min(100, ((Date.now() - t0) / ms) * 100) + '%'; };
  progress = setInterval(prog, 200);
  worker.onmessage = (e) => {
    const d = e.data;
    if (d.type === 'progress') { const m = root.querySelector('#tMsg'); if (m) m.innerHTML = `Optimizando… ${d.p.iter} combinaciones · mejor largo <b class="mono">${(d.p.len / 1000).toFixed(3)} m</b>`; return; }
    finish();
    if (d.out.error) return toast(d.out.error, 'bad', 6000);
    tz.resultado = { placements: d.out.placements, largo: d.out.largo, iter: d.out.iter, fecha: Date.now(), firma: firma(p) };
    commit('Generar trazo'); saveSoon();
    const R = resumen(p);
    toast(`Trazo listo: ${(R.largo / 1000).toFixed(2)} m · eficiencia ${(R.eficiencia * 100).toFixed(1)}%`, 'ok');
  };
  worker.onerror = (e) => { finish(); toast('Error en el optimizador: ' + e.message, 'bad'); };
  worker.postMessage({ items: items.map((i) => ({ id: i.id, poly: i.poly, area: i.area, orients: i.orients })), W: tz.ancho, res: tz.res, gap: tz.separacion, orilla: tz.orilla, timeMs: ms, seed: Date.now() % 100000 });
}
function finish() { running = false; clearInterval(progress); if (worker) { worker.terminate(); worker = null; } render(); }
function stop() { finish(); toast('Optimización detenida', 'info'); }

export default { id: 'trazo', mount, render, onShow: render };
