// ============================================================
// HiloNova CAD — Tabla de medidas y holguras
// ============================================================
import { state, commit, regenerar, mutate } from '../store.js';
import { icon, esc, toast, confirmar, prompt, enhanceSelects } from '../ui.js';
import { MEDIDAS, PRENDAS, SIZE_COLORS, agregarTalla } from '../../core/blocks.js';

const USADAS = {
  blusa: ['busto', 'cintura', 'cadera', 'cuello', 'espalda', 'hombro', 'talleEsp', 'talleDel', 'altBusto', 'sepBusto', 'largoBlusa', 'largoManga', 'brazo', 'puno', 'altCadera'],
  falda: ['cintura', 'cadera', 'altCadera', 'largoFalda'],
  pantalon: ['cintura', 'cadera', 'altCadera', 'tiro', 'largoPant', 'rodilla', 'bajo'],
};
const HOL = { busto: 'Holgura de busto', cintura: 'Holgura de cintura', cadera: 'Holgura de cadera', embebido: 'Embebido de manga' };

let root, dirty = false;
function mount(el) { root = el; }

function render() {
  if (!root || !root.classList.contains('on') || !state.p) return;
  const p = state.p, t = p.tabla;
  const keys = USADAS[p.prenda] || Object.keys(MEDIDAS);
  const bi = t.tallas.indexOf(t.base);
  const step = (k) => { const a = t.valores[k]; if (a.length < 2) return 0; return (a[a.length - 1] - a[0]) / (a.length - 1); };
  const holKeys = p.prenda === 'blusa' ? ['busto', 'cintura', 'cadera', 'embebido'] : ['cintura', 'cadera'];
  root.innerHTML = `<div class="page">
    <div class="page-h"><div><h1>Tabla de medidas</h1><p>Medidas corporales en centímetros. Al regenerar, las piezas se trazan por talla y las reglas de graduación se calculan solas.</p></div>
      <div class="row">
        <button class="btn" id="mAddI">${icon('plus', 'sm')}Talla al inicio</button>
        <button class="btn" id="mAddF">${icon('plus', 'sm')}Talla al final</button>
        ${PRENDAS[p.prenda] ? `<button class="btn pri" id="mRegen">${icon('wand', 'sm')}Regenerar patrones</button>` : ''}
      </div></div>
    ${dirty && PRENDAS[p.prenda] ? `<div class="card" style="padding:12px 14px;margin-bottom:14px;border-color:rgba(251,191,36,.45);display:flex;gap:10px;align-items:center">${icon('alert')}<span>Cambiaste medidas u holguras. Regenera para aplicarlas a las piezas.</span></div>` : ''}
    <div class="grid3" style="grid-template-columns:minmax(0,2.2fr) minmax(0,1fr);align-items:start">
      <div class="card"><div class="card-h"><span>Medidas por talla</span><span class="row" style="gap:8px"><span class="muted" style="font-weight:400">Talla base</span><div style="width:110px"><select class="select" id="mBase">${t.tallas.map((s) => `<option ${s === t.base ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select></div></span></div>
        <div style="overflow:auto"><table class="tbl"><thead><tr><th>Medida</th>${t.tallas.map((s, i) => `<th class="num"><span class="row" style="gap:6px;justify-content:flex-end"><i class="dot" style="--c:${SIZE_COLORS[i % SIZE_COLORS.length]}"></i>${esc(s)}${s === t.base ? ' ·base' : ''}<button class="btn icon sm ghost" data-rm="${i}" title="Quitar talla">${icon('x', 'sm')}</button></span></th>`).join('')}<th class="num">Incremento</th></tr></thead>
        <tbody>${keys.map((k) => `<tr><td>${esc(MEDIDAS[k].label)}</td>${t.tallas.map((s, i) => `<td class="num" style="width:90px"><input class="input num" type="number" step="0.1" data-k="${k}" data-i="${i}" value="${t.valores[k][i]}" ${i === bi ? 'style="border-color:rgba(58,168,255,.5)"' : ''}></td>`).join('')}
          <td class="num" style="width:100px"><input class="input num" type="number" step="0.1" data-step="${k}" value="${Math.round(step(k) * 100) / 100}" title="Aplica el mismo incremento entre tallas a partir de la base"></td></tr>`).join('')}</tbody></table></div></div>
      <div style="display:flex;flex-direction:column;gap:14px">
        <div class="card"><div class="card-h">Holguras (cm)</div><div class="card-b" style="display:flex;flex-direction:column;gap:10px">
          ${holKeys.map((k) => `<div class="field"><label>${HOL[k]}</label><input class="input num" type="number" step="0.5" data-h="${k}" value="${p.holguras[k] ?? 0}"></div>`).join('')}
          <p class="hint" style="margin:0">La holgura de embebido define cuánto más larga es la copa de manga que la sisa. El sistema calcula el alto de copa para cumplirla en todas las tallas.</p>
        </div></div>
        <div class="card"><div class="card-h">Cómo se gradúa</div><div class="card-b hint">
          Cada talla se traza con sus propias medidas. La diferencia de cada punto contra la talla base se guarda como regla (Δx, Δy), igual que en una tabla de reglas industrial. Después puedes ajustar cualquier regla a mano en <b>Graduación</b>.
        </div></div>
      </div>
    </div></div>`;
  enhanceSelects(root);
  root.querySelectorAll('[data-k]').forEach((inp) => inp.addEventListener('change', () => {
    t.valores[inp.dataset.k][+inp.dataset.i] = +inp.value; dirty = true; commit('Medida');
  }));
  root.querySelectorAll('[data-step]').forEach((inp) => inp.addEventListener('change', () => {
    const k = inp.dataset.step, d = +inp.value, a = t.valores[k], b = a[bi];
    t.tallas.forEach((_, i) => { a[i] = Math.round((b + (i - bi) * d) * 10) / 10; });
    dirty = true; commit('Incremento');
  }));
  root.querySelectorAll('[data-h]').forEach((inp) => inp.addEventListener('change', () => { p.holguras[inp.dataset.h] = +inp.value; dirty = true; commit('Holgura'); }));
  root.querySelector('#mBase').addEventListener('change', async (e) => {
    const nb = e.target.value;
    if (!PRENDAS[p.prenda]) { mutate('Talla base', () => { t.base = nb; }); return; }
    t.base = nb; state.ui.talla = nb; regenerar(p); dirty = false; commit('Talla base'); toast('Talla base cambiada y patrones regenerados', 'ok');
  });
  root.querySelectorAll('[data-rm]').forEach((b) => b.addEventListener('click', async () => {
    const i = +b.dataset.rm, name = t.tallas[i];
    if (t.tallas.length <= 2) return toast('Se necesitan al menos 2 tallas', 'warn');
    if (name === t.base) return toast('No puedes quitar la talla base', 'warn');
    if (!(await confirmar(`¿Quitar la talla <b>${esc(name)}</b>?`, { ok: 'Quitar', danger: true }))) return;
    t.tallas.splice(i, 1); for (const k in t.valores) t.valores[k].splice(i, 1);
    delete p.trazo.cantidades[name];
    p.piezas.forEach((pz) => { if (pz.rules) delete pz.rules[name]; });
    if (state.ui.talla === name) state.ui.talla = t.base;
    commit('Quitar talla');
  }));
  const add = async (pos) => {
    const n = await prompt('Nombre de la nueva talla', pos === 'inicio' ? 'XS' : 'XXL');
    if (!n || t.tallas.includes(n.trim())) return;
    agregarTalla(t, n.trim(), pos);
    p.trazo.cantidades[n.trim()] = 1;
    if (PRENDAS[p.prenda]) regenerar(p); else p.piezas.forEach((pz) => { pz.rules = pz.rules || {}; pz.rules[n.trim()] = {}; });
    state.ui.showSizes[n.trim()] = true;
    commit('Agregar talla'); toast(`Talla ${esc(n)} agregada${PRENDAS[p.prenda] ? ' y graduada' : ''}`, 'ok');
  };
  root.querySelector('#mAddI').onclick = () => add('inicio');
  root.querySelector('#mAddF').onclick = () => add('fin');
  const rg = root.querySelector('#mRegen');
  if (rg) rg.onclick = async () => {
    if (!(await confirmar('Se volverán a trazar todas las piezas desde la tabla. Los cambios manuales a la forma y a las reglas se reemplazan. ¿Continuar?', { ok: 'Regenerar' }))) return;
    regenerar(p); dirty = false; commit('Regenerar'); toast('Patrones regenerados y graduados', 'ok');
  };
}

export default { id: 'medidas', mount, render, onShow: render };
