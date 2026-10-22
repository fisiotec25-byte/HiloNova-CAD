// ============================================================
// HiloNova CAD — Bases paramétricas (trazo por medidas)
// Todas las medidas de la tabla están en CENTÍMETROS; los generadores trabajan en mm.
// Cada pieza generada usa ids de punto estables para que la graduación
// por regeneración produzca reglas (dx, dy) por punto y talla.
// ============================================================
import { v, clone, uid, segLength, segments, autoHandles, bbox, flatten } from './geom.js';

export const MEDIDAS = {
  busto:      { label: 'Contorno de busto',          grupo: 'Torso' },
  cintura:    { label: 'Contorno de cintura',        grupo: 'Torso' },
  cadera:     { label: 'Contorno de cadera',         grupo: 'Torso' },
  cuello:     { label: 'Contorno de cuello',         grupo: 'Torso' },
  espalda:    { label: 'Ancho de espalda',           grupo: 'Torso' },
  hombro:     { label: 'Largo de hombro',            grupo: 'Torso' },
  talleEsp:   { label: 'Talle espalda',              grupo: 'Torso' },
  talleDel:   { label: 'Talle delantero',            grupo: 'Torso' },
  altBusto:   { label: 'Altura de busto',            grupo: 'Torso' },
  sepBusto:   { label: 'Separación de busto',        grupo: 'Torso' },
  largoBlusa: { label: 'Largo de blusa',             grupo: 'Largos' },
  largoManga: { label: 'Largo de manga',             grupo: 'Brazo' },
  brazo:      { label: 'Contorno de brazo',          grupo: 'Brazo' },
  puno:       { label: 'Contorno de muñeca',         grupo: 'Brazo' },
  altCadera:  { label: 'Altura de cadera',           grupo: 'Largos' },
  largoFalda: { label: 'Largo de falda',             grupo: 'Largos' },
  tiro:       { label: 'Altura de tiro',             grupo: 'Pierna' },
  largoPant:  { label: 'Largo de pantalón',          grupo: 'Pierna' },
  rodilla:    { label: 'Contorno de rodilla',        grupo: 'Pierna' },
  bajo:       { label: 'Contorno de bajo',           grupo: 'Pierna' },
};

// Tabla base mujer (cm). Incrementos típicos de 6 cm en contornos.
export const TABLA_MUJER = {
  tallas: ['S', 'M', 'L', 'XL'],
  base: 'M',
  valores: {
    busto:      [86, 92, 98, 104],
    cintura:    [68, 74, 80, 86],
    cadera:     [94, 100, 106, 112],
    cuello:     [35, 36.5, 38, 39.5],
    espalda:    [35, 36.5, 38, 39.5],
    hombro:     [12, 12.5, 13, 13.5],
    talleEsp:   [39, 40, 41, 42],
    talleDel:   [41.5, 42.5, 43.5, 44.5],
    altBusto:   [24, 25, 26, 27],
    sepBusto:   [18, 19, 20, 21],
    largoBlusa: [62, 63, 64, 65],
    largoManga: [58, 59, 60, 61],
    brazo:      [27, 29, 31, 33],
    puno:       [16, 16.5, 17, 17.5],
    altCadera:  [20, 20.5, 21, 21.5],
    largoFalda: [58, 59, 60, 61],
    tiro:       [26, 27, 28, 29],
    largoPant:  [100, 101, 102, 103],
    rodilla:    [38, 40, 42, 44],
    bajo:       [40, 41, 42, 43],
  },
};

export const SIZE_COLORS = ['#e040fb', '#ffa726', '#26c6da', '#7c4dff', '#66bb6a', '#ef5350', '#ffee58', '#8d6e63', '#29b6f6', '#ec407a'];

const P = (id, x, y, h1, h2, name) => ({ id, name: name || id, x, y, ...(h1 ? { h1 } : {}), ...(h2 ? { h2 } : {}) });
const H = (x, y) => ({ x, y });

// Longitud de tramo entre ids dentro de una lista de puntos
function lenIds(points, fromId, toId) {
  const segs = segments(points, true), n = points.length;
  let i = points.findIndex((p) => p.id === fromId);
  const end = points.findIndex((p) => p.id === toId);
  let L = 0, g = 0;
  while (i !== end && g++ <= n) { L += segLength(segs[i]); i = (i + 1) % n; }
  return L;
}
const edgeOf = (points, id) => points.findIndex((p) => p.id === id);
const mm = (m) => { const o = {}; for (const k in m) o[k] = m[k] * 10; return o; };

// ------------------------------------------------------------
// BLUSA CLÁSICA
// ------------------------------------------------------------
function blusa(mc, hol) {
  const m = mm(mc);
  const eB = hol.busto * 10, eC = hol.cintura * 10, eH = hol.cadera * 10;
  const Wq = (m.busto + eB) / 4, Wb = Wq - 5, Wf = Wq + 5;
  const neckW = m.cuello / 6 + 5;
  const scye = m.busto / 10 + 115;
  const yBust = 20 + scye;
  const yWaist = 20 + m.talleEsp;
  const yHip = yWaist + m.altCadera;
  const yHem = 20 + m.largoBlusa;
  const waistW = (m.cintura + eC) / 4 - 5;
  const hipW = (m.cadera + eH) / 4 - 5;
  const hemW = Math.max(hipW, Wb) + Math.max(0, yHem - yHip) * 0.08;

  // ---- ESPALDA ----
  const dyB = 45, sxB = Math.sqrt(Math.max(1, m.hombro ** 2 - dyB ** 2));
  const SPb = { x: neckW + sxB, y: dyB };
  const uB = v.norm(v.sub(SPb, { x: neckW, y: 0 }));
  const ABb = { x: Math.min(m.espalda / 2, SPb.x - 10), y: dyB + (yBust - dyB) * 0.48 };
  const UAb = { x: Wb, y: yBust };
  const backPts = [
    P('B_CBN', 0, 20, null, H(neckW * 0.55, 0), 'Centro espalda escote'),
    P('B_HPS', neckW, 0, H(-neckW * 0.28, 13), null, 'Punto de cuello'),
    P('B_SP', SPb.x, SPb.y, null, v.mul({ x: -uB.y, y: uB.x }, (ABb.y - SPb.y) * 0.45), 'Punta de hombro'),
    P('B_AB', ABb.x, ABb.y, H(0, -(ABb.y - SPb.y) * 0.4), H(0, (UAb.y - ABb.y) * 0.55), 'Ancho de espalda'),
    P('B_UA', UAb.x, UAb.y, H(-(UAb.x - ABb.x) * 0.62, 0), null, 'Bajo sisa'),
    P('B_WS', waistW, yWaist, H(0, -(yWaist - yBust) * 0.4), H(0, (yHem - yWaist) * 0.4), 'Cintura costado'),
    P('B_HS', hemW, yHem, null, null, 'Bastilla costado'),
    P('B_CBH', 0, yHem, null, null, 'Centro espalda bastilla'),
  ];

  // ---- DELANTERO ----
  const nd = m.cuello / 6 + 25, ext = 20;
  const dyF = 50, sxF = Math.sqrt(Math.max(1, m.hombro ** 2 - dyF ** 2));
  const SPf = { x: neckW + sxF, y: dyF };
  const uF = v.norm(v.sub(SPf, { x: neckW, y: 0 }));
  const AFf = { x: Math.min(m.espalda / 2 - 10, SPf.x - 15), y: dyF + (yBust - dyF) * 0.55 };
  const UAf = { x: Wf, y: yBust };
  const dw = Math.min(45, Math.max(15, m.talleDel - m.talleEsp + 10));
  const yWf = yWaist + dw, yHf = yHem + dw;
  const sideX = (y) => UAf.x + (waistW + 10 - UAf.x) * ((y - yBust) / (yWf - yBust));
  const yD1 = yBust + 50, yD3 = yD1 + dw;
  const BP = { x: m.sepBusto / 2, y: m.altBusto };
  const Dm = { x: sideX(yD1 + dw / 2), y: yD1 + dw / 2 };
  const apex = v.add(BP, v.mul(v.norm(v.sub(Dm, BP)), 25));
  const frontPts = [
    P('F_CFN', 0, nd, null, H(neckW * 0.55, 0), 'Centro delantero escote'),
    P('F_HPS', neckW, 0, H(-4, nd * 0.5), null, 'Punto de cuello'),
    P('F_SP', SPf.x, SPf.y, null, v.mul({ x: -uF.y, y: uF.x }, (AFf.y - SPf.y) * 0.45), 'Punta de hombro'),
    P('F_AF', AFf.x, AFf.y, H(0, -(AFf.y - SPf.y) * 0.4), H(0, (UAf.y - AFf.y) * 0.55), 'Ancho de pecho'),
    P('F_UA', UAf.x, UAf.y, H(-(UAf.x - AFf.x) * 0.65, 0), null, 'Bajo sisa'),
    P('F_D1', sideX(yD1), yD1, null, null, 'Pinza lado superior'),
    P('F_DA', apex.x, apex.y, null, null, 'Vértice de pinza'),
    P('F_D3', sideX(yD3), yD3, null, null, 'Pinza lado inferior'),
    P('F_WS', waistW + 10, yWf, H(0, -(yWf - yD3) * 0.45), H(0, (yHf - yWf) * 0.4), 'Cintura costado'),
    P('F_HS', hemW + 10, yHf, null, null, 'Bastilla costado'),
    P('F_CFH', -ext, yHf, null, null, 'Cruce bastilla'),
    P('F_EXN', -ext, nd, null, null, 'Cruce escote'),
  ];

  // ---- MANGA (alto de copa calculado para holgura de embebido) ----
  const armB = lenIds(backPts, 'B_SP', 'B_UA');
  const armF = lenIds(frontPts, 'F_SP', 'F_UA');
  const capTarget = armB + armF + hol.embebido * 10;
  const sw = m.brazo + 60;
  const Ls = m.largoManga - 60 + 20;
  const wr = m.puno + 50;
  const sleeve = (capH) => {
    const pts = [
      P('M_UL', 0, capH, null, H(sw * 0.13, 0), 'Bajo copa espalda'),
      P('M_BK', sw * 0.24, capH * 0.42, null, null, 'Copa espalda'),
      P('M_TOP', sw / 2 + 8, 0, H(-sw * 0.17, 0), H(sw * 0.15, 0), 'Copa (aplomo hombro)'),
      P('M_FR', sw * 0.79, capH * 0.5, null, null, 'Copa delantera'),
      P('M_UR', sw, capH, H(-sw * 0.11, 0), null, 'Bajo copa delantero'),
      P('M_WR', sw / 2 + wr / 2, Ls, null, null, 'Puño delantero'),
      P('M_WL', sw / 2 - wr / 2, Ls + 8, null, null, 'Puño espalda'),
    ];
    autoHandles(pts, 1, true, 0.3); autoHandles(pts, 3, true, 0.3);
    // los extremos de copa se recalculan sin tocar las manijas fijas
    return pts;
  };
  let lo = 60, hi = Math.max(120, yBust * 0.9), capH = 140;
  for (let it = 0; it < 40; it++) {
    capH = (lo + hi) / 2;
    const L = lenIds(sleeve(capH), 'M_UL', 'M_UR');
    if (L < capTarget) lo = capH; else hi = capH;
  }
  const sleevePts = sleeve(capH);

  // ---- CUELLO ----
  const nB = lenIds(backPts, 'B_CBN', 'B_HPS');
  const nF = lenIds(frontPts, 'F_CFN', 'F_HPS');
  const Lc = 2 * (nB + nF);
  const hc = 70, rise = 15;
  const collarPts = [
    P('C_TL', -12, 6, null, null, 'Punta izquierda'),
    P('C_TC', Lc / 2, 0, H(-Lc * 0.3, 0), H(Lc * 0.3, 0), 'Centro espalda borde'),
    P('C_TR', Lc + 12, 6, null, null, 'Punta derecha'),
    P('C_BR', Lc, hc - rise, null, H(-Lc * 0.15, rise * 0.9), 'Escote derecho'),
    P('C_BC', Lc / 2, hc, H(Lc * 0.25, 0), H(-Lc * 0.25, 0), 'Centro espalda escote'),
    P('C_BL', 0, hc - rise, H(Lc * 0.15, rise * 0.9), null, 'Escote izquierdo'),
  ];

  // ---- PUÑO ----
  const cw = m.puno + 25;
  const cuffPts = [P('PU_TL', 0, 0), P('PU_TR', cw, 0), P('PU_BR', cw, 120), P('PU_BL', 0, 120)];

  // ---- VISTA ----
  const vsh = v.add({ x: neckW, y: 0 }, v.mul(uF, 30));
  const vistaPts = [
    P('V_EXN', -ext, nd),
    P('V_CFN', 0, nd, null, H(neckW * 0.55, 0)),
    P('V_HPS', neckW, 0, H(-4, nd * 0.5), null),
    P('V_SH', vsh.x, vsh.y, null, H(-10, 60)),
    P('V_IN', 70, nd + 110, H(10, -50), null),
    P('V_INB', 70, yHf),
    P('V_EXH', -ext, yHf),
  ];

  const pieces = [
    {
      key: 'espalda', name: 'Espalda', qty: 1, pair: false, color: '#5b8def', points: backPts,
      foldStart: 'B_CBH', seamEdges: { B_HS: 25 },
      grain: [{ x: Wb * 0.42, y: yBust - 40 }, { x: Wb * 0.42, y: yHem - 90 }],
      notches: [{ from: 'B_AB', t: 0.35 }, { from: 'B_AB', t: 0.42 }, { from: 'B_UA', t: 0.999 }],
      internals: [],
    },
    {
      key: 'delantero', name: 'Delantero', qty: 2, pair: true, color: '#47c38f', points: frontPts,
      foldStart: null, seamEdges: { F_HS: 25 },
      grain: [{ x: Wf * 0.5, y: yBust - 40 }, { x: Wf * 0.5, y: yHf - 90 }],
      notches: [{ from: 'F_AF', t: 0.4 }],
      internals: [
        { type: 'linea', label: 'Centro delantero', pts: [{ x: 0, y: nd }, { x: 0, y: yHf }] },
        ...[0, 1, 2, 3, 4, 5].map((k) => ({ type: 'boton', label: 'Botón', pts: [{ x: 0, y: nd + 20 + k * ((yHf - nd - 120) / 5) }] })),
        { type: 'pinza', label: 'Pinza de busto', pts: [{ x: sideX(yD1), y: yD1 }, apex, { x: sideX(yD3), y: yD3 }] },
      ],
    },
    {
      key: 'manga', name: 'Manga', qty: 2, pair: true, color: '#f0a03c', points: sleevePts,
      foldStart: null, seamEdges: {},
      grain: [{ x: sw / 2, y: capH * 0.35 }, { x: sw / 2, y: Ls - 60 }],
      notches: [{ from: 'M_BK', t: 0.25 }, { from: 'M_BK', t: 0.32 }, { from: 'M_TOP', t: 0.001 }, { from: 'M_FR', t: 0.7 }],
      internals: [{ type: 'linea', label: 'Abertura', pts: [{ x: sw / 2 - wr / 4, y: Ls - 100 }, { x: sw / 2 - wr / 4, y: Ls + 4 }] }],
    },
    {
      key: 'cuello', name: 'Cuello', qty: 2, pair: false, color: '#c86dd7', points: collarPts,
      foldStart: null, seamEdges: {},
      grain: [{ x: Lc * 0.3, y: hc * 0.45 }, { x: Lc * 0.7, y: hc * 0.45 }],
      notches: [{ from: 'C_BR', t: 0.999 }],
      internals: [],
    },
    {
      key: 'puno', name: 'Puño', qty: 2, pair: false, color: '#e86a7a', points: cuffPts,
      foldStart: null, seamEdges: {},
      grain: [{ x: cw * 0.25, y: 30 }, { x: cw * 0.75, y: 30 }],
      notches: [{ from: 'PU_TR', t: 0.5 }],
      internals: [{ type: 'linea', label: 'Doblez', pts: [{ x: 0, y: 60 }, { x: cw, y: 60 }] }],
    },
    {
      key: 'vista', name: 'Vista', qty: 2, pair: true, color: '#3fc1c9', points: vistaPts,
      foldStart: null, seamEdges: { V_INB: 25 },
      grain: [{ x: 25, y: nd + 150 }, { x: 25, y: yHf - 80 }],
      notches: [], internals: [],
    },
  ];

  const costuras = [
    { nombre: 'Costado (espalda vs delantero)', a: [{ p: 'espalda', from: 'B_UA', to: 'B_HS' }], b: [{ p: 'delantero', from: 'F_UA', to: 'F_D1' }, { p: 'delantero', from: 'F_D3', to: 'F_HS' }], esperado: 0, tol: 3 },
    { nombre: 'Hombro (espalda vs delantero)', a: [{ p: 'espalda', from: 'B_HPS', to: 'B_SP' }], b: [{ p: 'delantero', from: 'F_HPS', to: 'F_SP' }], esperado: 0, tol: 4 },
    { nombre: 'Copa de manga vs sisa (embebido)', a: [{ p: 'manga', from: 'M_UL', to: 'M_UR' }], b: [{ p: 'espalda', from: 'B_SP', to: 'B_UA' }, { p: 'delantero', from: 'F_SP', to: 'F_UA' }], esperado: hol.embebido * 10, tol: 4 },
    { nombre: 'Costura de manga', a: [{ p: 'manga', from: 'M_UR', to: 'M_WR' }], b: [{ p: 'manga', from: 'M_WL', to: 'M_UL' }], esperado: 0, tol: 10 },
    { nombre: 'Escote vs cuello', a: [{ p: 'cuello', from: 'C_BR', to: 'C_BL' }], b: [{ p: 'espalda', from: 'B_CBN', to: 'B_HPS', k: 2 }, { p: 'delantero', from: 'F_CFN', to: 'F_HPS', k: 2 }], esperado: 0, tol: 6 },
  ];
  return { pieces, costuras };
}

// ------------------------------------------------------------
// FALDA RECTA
// ------------------------------------------------------------
function falda(mc, hol) {
  const m = mm(mc);
  const H4 = (m.cadera + hol.cadera * 10) / 4, W4 = (m.cintura + hol.cintura * 10) / 4;
  const yh = m.altCadera, L = m.largoFalda;
  // Delantero (al doblez en centro)
  const Hf = H4 + 5, Wf = W4 + 5, dF = Hf - Wf;
  const dartF = Math.min(30, Math.max(10, dF * 0.35)), xdF = Math.max(70, Hf * 0.36);
  const xsF = Hf - (dF - dartF);
  const fr = [
    P('SF_CFW', 0, 0, null, null, 'Centro delantero cintura'),
    P('SF_D1', xdF - dartF / 2, 0, null, null, 'Pinza 1'),
    P('SF_DA', xdF, 90, null, null, 'Vértice pinza'),
    P('SF_D2', xdF + dartF / 2, 0, null, H((xsF - xdF) * 0.4, 0)),
    P('SF_WS', xsF, -10, H(-(xsF - xdF) * 0.3, 2), H(4, yh * 0.35), 'Cintura costado'),
    P('SF_HS', Hf, yh, H(0, -yh * 0.4), null, 'Cadera costado'),
    P('SF_HE', Hf, L, null, null, 'Bastilla costado'),
    P('SF_CFH', 0, L, null, null, 'Centro delantero bastilla'),
  ];
  // Trasero (par, costura en centro con cierre)
  const Hb = H4 - 5, Wb = W4 - 5, dB = Hb - Wb;
  const dartB = Math.min(35, Math.max(15, dB * 0.45)), xdB = Math.max(75, Hb * 0.4);
  const xsB = Hb - (dB - dartB);
  const bk = [
    P('SB_CBW', 0, 10, null, null, 'Centro trasero cintura'),
    P('SB_D1', xdB - dartB / 2, 4, null, null),
    P('SB_DA', xdB, 130, null, null, 'Vértice pinza'),
    P('SB_D2', xdB + dartB / 2, 2, null, H((xsB - xdB) * 0.4, -2)),
    P('SB_WS', xsB, -10, H(-(xsB - xdB) * 0.3, 2), H(4, yh * 0.35), 'Cintura costado'),
    P('SB_HS', Hb, yh, H(0, -yh * 0.4), null, 'Cadera costado'),
    P('SB_HE', Hb, L, null, null, 'Bastilla costado'),
    P('SB_CBH', 0, L, null, null, 'Centro trasero bastilla'),
  ];
  const pw = m.cintura + hol.cintura * 10 + 30;
  const pret = [P('PT_TL', 0, 0), P('PT_TR', pw, 0), P('PT_BR', pw, 80), P('PT_BL', 0, 80)];
  const pieces = [
    { key: 'delantero', name: 'Delantero falda', qty: 1, pair: false, color: '#47c38f', points: fr, foldStart: 'SF_CFH', seamEdges: { SF_HE: 40 }, grain: [{ x: Hf * 0.5, y: yh }, { x: Hf * 0.5, y: L - 80 }], notches: [{ from: 'SF_HS', t: 0.001 }], internals: [] },
    { key: 'trasero', name: 'Trasero falda', qty: 2, pair: true, color: '#5b8def', points: bk, foldStart: null, seamEdges: { SB_HE: 40, SB_CBH: 15 }, grain: [{ x: Hb * 0.5, y: yh }, { x: Hb * 0.5, y: L - 80 }], notches: [{ from: 'SB_HS', t: 0.001 }, { from: 'SB_CBH', t: 0.75 }], internals: [{ type: 'linea', label: 'Cierre', pts: [{ x: 0, y: 10 }, { x: 0, y: 200 }] }] },
    { key: 'pretina', name: 'Pretina', qty: 1, pair: false, color: '#c86dd7', points: pret, foldStart: null, seamEdges: {}, grain: [{ x: pw * 0.3, y: 20 }, { x: pw * 0.7, y: 20 }], notches: [], internals: [{ type: 'linea', label: 'Doblez', pts: [{ x: 0, y: 40 }, { x: pw, y: 40 }] }] },
  ];
  const costuras = [
    { nombre: 'Costado (delantero vs trasero)', a: [{ p: 'delantero', from: 'SF_WS', to: 'SF_HE' }], b: [{ p: 'trasero', from: 'SB_WS', to: 'SB_HE' }], esperado: 0, tol: 3 },
    { nombre: 'Cintura vs pretina (con cruce 3 cm)', a: [{ p: 'pretina', from: 'PT_TL', to: 'PT_TR' }], b: [{ p: 'delantero', from: 'SF_CFW', to: 'SF_D1', k: 2 }, { p: 'delantero', from: 'SF_D2', to: 'SF_WS', k: 2 }, { p: 'trasero', from: 'SB_CBW', to: 'SB_D1', k: 2 }, { p: 'trasero', from: 'SB_D2', to: 'SB_WS', k: 2 }], esperado: 30 + hol.cintura * 0, tol: 12 },
  ];
  return { pieces, costuras };
}

// ------------------------------------------------------------
// PANTALÓN BÁSICO
// ------------------------------------------------------------
function pantalon(mc, hol) {
  const m = mm(mc);
  const H4 = (m.cadera + hol.cadera * 10) / 4, W4 = (m.cintura + hol.cintura * 10) / 4;
  const yh = m.altCadera, yc = m.tiro, L = m.largoPant, yk = (yc + L) / 2 - 50;
  // Delantero
  const forkF = m.cadera / 16 + 5, Hf = H4 - 5;
  const xsF = -(Hf + forkF) / 2, xcf = xsF + Hf, xfF = xcf + forkF;
  const dartF = 15, cfw = xcf - 10, swF = cfw - (W4 - 5 + dartF);
  const kF = m.rodilla / 4 - 10, bF = m.bajo / 4 - 10, xdF = 0;
  const fr = [
    P('PF_SW', swF, -5, H(-(swF - xsF) * 0.45, yh * 0.35), H((xdF - swF) * 0.4, 0), 'Cintura costado'),
    P('PF_D1', xdF - dartF / 2, 0), P('PF_DA', xdF, 80, null, null, 'Vértice pinza'), P('PF_D2', xdF + dartF / 2, 0),
    P('PF_CFW', cfw, 0, null, null, 'Centro delantero cintura'),
    P('PF_CFH', xcf, yh, null, H(0, (yc - yh) * 0.6), 'Centro delantero cadera'),
    P('PF_FK', xfF, yc, H(-forkF * 0.62, 0), H(-(xfF - kF) * 0.35, (yk - yc) * 0.2), 'Punta de tiro'),
    P('PF_KI', kF, yk, H(0, -(yk - yc) * 0.42), null, 'Rodilla interior'),
    P('PF_HI', bF, L, null, null, 'Bajo interior'),
    P('PF_HO', -bF, L, null, null, 'Bajo exterior'),
    P('PF_KO', -kF, yk, null, H(0, -(yk - yh) * 0.4), 'Rodilla exterior'),
    P('PF_SH', xsF, yh, H(0, (yk - yh) * 0.3), null, 'Cadera costado'),
  ];
  autoHandles(fr, 11, true, 0.3);
  // Trasero
  const forkB = m.cadera / 10 + 20, Hb = H4 + 5;
  const xsB = -(Hb + forkB) / 2 + 10, xcb = xsB + Hb, xfB = xcb + forkB;
  const dartB = 25, cbw = { x: xcb - 35, y: -30 }, swB = cbw.x - (W4 + 5 + dartB);
  const kB = m.rodilla / 4 + 10, bB = m.bajo / 4 + 10, xdB = (swB + cbw.x) / 2;
  const cbDir = v.norm(v.sub({ x: xcb, y: yh }, cbw));
  const bk = [
    P('PT_SW', swB, -10, H(-(swB - xsB) * 0.45, yh * 0.35), H((xdB - swB) * 0.4, -3), 'Cintura costado'),
    P('PT_D1', xdB - dartB / 2, -8), P('PT_DA', xdB, 120, null, null, 'Vértice pinza'), P('PT_D2', xdB + dartB / 2, -12),
    P('PT_CBW', cbw.x, cbw.y, null, null, 'Centro trasero cintura'),
    P('PT_CBH', xcb, yh, null, v.mul(cbDir, (yc - yh) * 0.55), 'Centro trasero cadera'),
    P('PT_FK', xfB, yc + 12, H(-forkB * 0.6, 0), H(-(xfB - kB) * 0.35, (yk - yc) * 0.2), 'Punta de tiro'),
    P('PT_KI', kB, yk, H(0, -(yk - yc) * 0.42), null, 'Rodilla interior'),
    P('PT_HI', bB, L, null, null, 'Bajo interior'),
    P('PT_HO', -bB, L, null, null, 'Bajo exterior'),
    P('PT_KO', -kB, yk, null, H(0, -(yk - yh) * 0.4), 'Rodilla exterior'),
    P('PT_SH', xsB, yh, H(0, (yk - yh) * 0.3), null, 'Cadera costado'),
  ];
  autoHandles(bk, 11, true, 0.3);
  const pw = m.cintura + hol.cintura * 10 + 40;
  const pret = [P('PR_TL', 0, 0), P('PR_TR', pw, 0), P('PR_BR', pw, 80), P('PR_BL', 0, 80)];
  const pieces = [
    { key: 'delantero', name: 'Delantero pantalón', qty: 2, pair: true, color: '#47c38f', points: fr, foldStart: null, seamEdges: { PF_HI: 40 }, grain: [{ x: 0, y: yh }, { x: 0, y: L - 80 }], notches: [{ from: 'PF_KO', t: 0.001 }, { from: 'PF_KI', t: 0.999 }], internals: [{ type: 'linea', label: 'Línea de plancha', pts: [{ x: 0, y: 80 }, { x: 0, y: L }] }] },
    { key: 'trasero', name: 'Trasero pantalón', qty: 2, pair: true, color: '#5b8def', points: bk, foldStart: null, seamEdges: { PT_HI: 40, PT_CBW: 20 }, grain: [{ x: 0, y: yh }, { x: 0, y: L - 80 }], notches: [{ from: 'PT_KO', t: 0.001 }, { from: 'PT_KI', t: 0.999 }, { from: 'PT_CBH', t: 0.3 }, { from: 'PT_CBH', t: 0.36 }], internals: [{ type: 'linea', label: 'Línea de plancha', pts: [{ x: 0, y: 140 }, { x: 0, y: L }] }] },
    { key: 'pretina', name: 'Pretina', qty: 1, pair: false, color: '#c86dd7', points: pret, foldStart: null, seamEdges: {}, grain: [{ x: pw * 0.3, y: 20 }, { x: pw * 0.7, y: 20 }], notches: [], internals: [{ type: 'linea', label: 'Doblez', pts: [{ x: 0, y: 40 }, { x: pw, y: 40 }] }] },
  ];
  const costuras = [
    { nombre: 'Costado exterior', a: [{ p: 'delantero', from: 'PF_HO', to: 'PF_SW' }], b: [{ p: 'trasero', from: 'PT_HO', to: 'PT_SW' }], esperado: 0, tol: 6 },
    { nombre: 'Entrepierna', a: [{ p: 'delantero', from: 'PF_FK', to: 'PF_HI' }], b: [{ p: 'trasero', from: 'PT_FK', to: 'PT_HI' }], esperado: 0, tol: 10 },
  ];
  return { pieces, costuras };
}

export const PRENDAS = {
  blusa: { nombre: 'Blusa clásica', desc: 'Delantero con cruce y pinza de busto, espalda al doblez, manga con copa calculada, cuello, puño y vista.', holguras: { busto: 8, cintura: 10, cadera: 6, embebido: 1.5 }, generar: blusa },
  falda: { nombre: 'Falda recta', desc: 'Delantero al doblez, trasero con cierre, pinzas de cintura y pretina.', holguras: { busto: 0, cintura: 2, cadera: 4, embebido: 0 }, generar: falda },
  pantalon: { nombre: 'Pantalón básico', desc: 'Delantero y trasero con tiro, pinzas, línea de plancha y pretina.', holguras: { busto: 0, cintura: 2, cadera: 4, embebido: 0 }, generar: pantalon },
};

// Medidas de una talla (cm) desde el proyecto
export function medidasTalla(tabla, talla) {
  const i = tabla.tallas.indexOf(talla);
  const o = {};
  for (const k in tabla.valores) o[k] = +tabla.valores[k][i];
  return o;
}

// Construye piezas con reglas de graduación a partir de la tabla
export function construirPrenda(prendaKey, tabla, holguras) {
  const def = PRENDAS[prendaKey];
  const hol = { ...def.holguras, ...(holguras || {}) };
  const base = def.generar(medidasTalla(tabla, tabla.base), hol);
  const porTalla = {};
  for (const t of tabla.tallas) porTalla[t] = t === tabla.base ? base : def.generar(medidasTalla(tabla, t), hol);

  const pieces = base.pieces.map((bp) => {
    const piece = normalizarPieza(bp);
    piece.rules = {};
    for (const t of tabla.tallas) {
      if (t === tabla.base) continue;
      const sp = porTalla[t].pieces.find((x) => x.key === bp.key);
      const r = {};
      bp.points.forEach((p, i) => {
        const q = sp.points[i];
        r[p.id] = {
          dx: q.x - p.x, dy: q.y - p.y,
          ...(p.h1 && q.h1 ? { dh1: { x: q.h1.x - p.h1.x, y: q.h1.y - p.h1.y } } : {}),
          ...(p.h2 && q.h2 ? { dh2: { x: q.h2.x - p.h2.x, y: q.h2.y - p.h2.y } } : {}),
        };
      });
      piece.rules[t] = r;
    }
    return piece;
  });
  layoutPieces(pieces);
  return { pieces, costuras: base.costuras };
}

export function normalizarPieza(bp) {
  const pts = clone(bp.points);
  const idx = (id) => pts.findIndex((p) => p.id === id);
  const seam = {};
  for (const k in bp.seamEdges || {}) { const i = idx(k); if (i >= 0) seam[i] = bp.seamEdges[k]; }
  return {
    id: uid('pz'), key: bp.key, name: bp.name, qty: bp.qty, pair: !!bp.pair, color: bp.color,
    material: bp.material || 'Tela', seam: 10, seamEdges: seam,
    fold: bp.foldStart ? idx(bp.foldStart) : null,
    points: pts,
    grain: clone(bp.grain || []),
    notches: (bp.notches || []).map((n) => ({ seg: n.seg ?? idx(n.from), t: n.t })).filter((n) => n.seg >= 0),
    internals: clone(bp.internals || []),
    pos: { x: 0, y: 0 }, rules: {}, visible: true,
  };
}

export function layoutPieces(pieces, gap = 60) {
  let x = 0, y = 0, rowH = 0;
  const boxes = pieces.map((p) => bbox(flatten(p.points).pts));
  const sumA = boxes.reduce((s, b) => s + (b.w + gap) * (b.h + gap), 0);
  const maxW = Math.max(...boxes.map((b) => b.w + gap), Math.sqrt(sumA * 2.1));
  for (const p of pieces) {
    const bb = bbox(flatten(p.points).pts);
    if (x > 0 && x + bb.w > maxW) { x = 0; y += rowH + gap; rowH = 0; }
    p.pos = { x: x - bb.x, y: y - bb.y };
    x += bb.w + gap + 30; rowH = Math.max(rowH, bb.h);
  }
}

// Interpola/extrapola una talla nueva en la tabla
export function agregarTalla(tabla, nombre, posicion = 'fin') {
  const n = tabla.tallas.length;
  const at = posicion === 'inicio' ? 0 : n;
  for (const k in tabla.valores) {
    const arr = tabla.valores[k];
    let val;
    if (n >= 2) {
      val = at === 0 ? arr[0] - (arr[1] - arr[0]) : arr[n - 1] + (arr[n - 1] - arr[n - 2]);
    } else val = arr[0] || 0;
    arr.splice(at, 0, Math.round(val * 10) / 10);
  }
  tabla.tallas.splice(at, 0, nombre);
}
