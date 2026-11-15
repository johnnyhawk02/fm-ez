// The simplified FM EZ: 24 knobs straight onto the 6-operator engine.
//
// Screen: 6 columns (OP1-OP6) by 4 rows.
//   Row 1  Pitch     ratio of each operator
//   Row 2  Envelope  one knob per operator, morphing through envelope shapes
//   Row 3  Level     output level (carriers) or modulation depth (modulators)
//   Row 4  Global    Algorithm, Feedback, Stereo, Mod spread, Glide, Volume
//
// Knob index = row * 6 + column.
import { isCarrier, targets } from './algorithms.js';

export const RATIOS = [0.5, 1, 1.5, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];

// Envelope shapes the Envelope knob morphs through, left to right.
// Times in seconds, sustain 0..1.
export const SHAPES = [
  { name: 'Click', a: 0.001, d: 0.06, s: 0, r: 0.04 },
  { name: 'Pluck', a: 0.001, d: 0.35, s: 0, r: 0.15 },
  { name: 'Long decay', a: 0.002, d: 1.8, s: 0, r: 0.5 },
  { name: 'Sustained', a: 0.005, d: 0.2, s: 1, r: 0.08 },
  { name: 'Long release', a: 0.01, d: 0.6, s: 0.85, r: 1.8 },
  { name: 'Slow attack', a: 0.6, d: 1, s: 0.9, r: 2 },
  { name: 'Swell', a: 2.5, d: 2, s: 1, r: 4 },
];

export function envAt(v) {
  const x = Math.min(1, Math.max(0, v)) * (SHAPES.length - 1);
  const i = Math.min(SHAPES.length - 2, Math.floor(x));
  const t = x - i;
  const A = SHAPES[i], B = SHAPES[i + 1];
  const lg = (a, b) => Math.exp(Math.log(a) + (Math.log(b) - Math.log(a)) * t);
  return { a: lg(A.a, B.a), d: lg(A.d, B.d), s: A.s + (B.s - A.s) * t, r: lg(A.r, B.r) };
}
export function envName(v) {
  const x = Math.min(1, Math.max(0, v)) * (SHAPES.length - 1);
  const i = Math.round(x);
  if (Math.abs(x - i) < 0.15) return SHAPES[i].name;
  const lo = Math.floor(x);
  return `${SHAPES[lo].name} > ${SHAPES[lo + 1].name}`;
}

const stepIndex = (v, n) => Math.min(n - 1, Math.floor(v * n));
const stepPos = (i, n) => (i + 0.5) / n;
export const ratioOf = (v) => RATIOS[stepIndex(v, RATIOS.length)];
export const algoOf = (v) => stepIndex(v, 32); // 0-based

export const ROWS = ['Pitch', 'Envelope', 'Level', 'Global'];
export const GLOBALS = ['Algorithm', 'Feedback', 'Stereo', 'Mod spread', 'Glide', 'Volume'];
export const G = { algo: 18, feedback: 19, stereo: 20, spread: 21, glide: 22, volume: 23 };

const ms = (s) => (s < 1 ? `${Math.round(s * 1000)} ms` : `${s.toFixed(1)} s`);
const glideTime = (v) => 0.005 * Math.pow(200, v); // 5 ms .. 1 s

// Knob descriptions: { label, def, fmt(v) }
export function knobInfo(i) {
  const row = Math.floor(i / 6), col = i % 6;
  if (row === 0) return { row, label: "Pitch", title: `OP${col + 1} pitch`, stepped: RATIOS.length, fmt: (v) => `x${ratioOf(v)}` };
  if (row === 1) return { row, label: "Envelope", title: `OP${col + 1} envelope`, fmt: envName };
  if (row === 2) return { row, label: "Level", title: `OP${col + 1} level`, fmt: (v) => `${Math.round(v * 100)}` };
  const fmts = [
    (v) => `DX7 ${algoOf(v) + 1}`,
    (v) => `${Math.round(v * 100)}`,
    (v) => `${Math.round(v * 100)}`,
    (v) => `${Math.round(v * 100)}`,
    (v) => ms(glideTime(v)),
    (v) => `${Math.round(v * 100)}`,
  ];
  return { row, label: GLOBALS[col], stepped: col === 0 ? 32 : 0, fmt: fmts[col] };
}

// Starting sound: algorithm 5 (three pairs), a soft electric-piano-like patch.
export function defaultKnobs() {
  const k = new Array(24).fill(0);
  const ratio = (r) => stepPos(RATIOS.indexOf(r), RATIOS.length);
  [1, 1, 1, 14, 1, 1].forEach((r, op) => { k[op] = ratio(r); });
  const env = (n) => SHAPES.findIndex((s) => s.name === n) / (SHAPES.length - 1);
  ['Long decay', 'Long decay', 'Long release', 'Click', 'Long release', 'Pluck'].forEach((n, op) => { k[6 + op] = env(n); });
  [0.85, 0.45, 0.6, 0.35, 0.5, 0.3].forEach((l, op) => { k[12 + op] = l; });
  k[G.algo] = stepPos(4, 32);
  k[G.feedback] = 0;
  k[G.stereo] = 0.4;
  k[G.spread] = 0.3;
  k[G.glide] = 0.35;
  k[G.volume] = 0.6;
  return k;
}

export function opRoles(k) {
  const alg = algoOf(k[G.algo]);
  const to = targets(alg);
  return [0, 1, 2, 3, 4, 5].map((op) => ({ carrier: isCarrier(alg, op), to: to[op] }));
}

export function buildPatch(k) {
  const alg = algoOf(k[G.algo]);
  const ops = [0, 1, 2, 3, 4, 5].map((op) => {
    const lvl = k[12 + op];
    return {
      ratio: ratioOf(k[op]),
      fixed: 0,
      detune: 0,
      level: lvl * lvl,
      index: 6, // modulators: full knob = 6 radians of modulation
      env: envAt(k[6 + op]),
    };
  });
  const st = k[G.stereo];
  return {
    algorithm: alg,
    algoNum: alg + 1,
    ops,
    feedback: k[G.feedback],
    stereo: { width: st, detune: st * 8, phase: st, spread: k[G.spread] },
    glide: glideTime(k[G.glide]),
    volume: k[G.volume] * 1.5,
    lfo: { rate: 5, depth: 0, pitch: 0 },
    pitchEnv: { amount: 0, decay: 0.1 },
    tone: { cutoff: 20000, drive: 0 },
    velBright: 0.5,
    velAmp: 0.65,
    transpose: 0,
  };
}

// The PC4 is 4 across by 6 down: each PC4 row is one operator
// (Pitch, Envelope, Level) plus one Global knob in the 4th column.
// So the PC4 is the screen turned on its side.
export function pc4ToKnob(n) {
  const row = Math.floor(n / 4), col = n % 4; // PC4 row = operator
  return col * 6 + row;
}
