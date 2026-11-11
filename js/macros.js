// The 24 knobs (4 rows x 6 columns, laid out like the Faderfox PC4) and how
// they turn into a full 6-operator patch.
import { ENGINES, isCarrier } from './engines.js';

export const ROWS = ['Tone', 'Shape', 'Space', 'Random'];

export const METHODS = ['Generate', 'Mutate', 'Harmonic', 'Breed', 'Row'];
export const LOCKS = ['None', 'Tone', 'Shape', 'Space', 'Tone+Shape', 'Shape+Space', 'Tone+Space'];

const pick = (list, v) => list[Math.min(list.length - 1, Math.floor(v * list.length))];
const lin = ([a, b], v) => a + (b - a) * v;
const expo = ([a, b], v) => (a <= 0 ? lin([a, b], v) : a * Math.pow(b / a, v));
const pct = (v) => `${Math.round(v * 100)}`;

export const KNOBS = [
  // Tone
  { id: 'engine', label: 'Engine', def: 1 / 12 + 1 / 6, fmt: (v) => pick(ENGINES, v).name },
  { id: 'algo', label: 'Algorithm', def: 0, fmt: (v, m) => `DX ${pick(engineOf(m).algos, v)}` },
  { id: 'bright', label: 'Brightness', def: 0.45, fmt: pct },
  { id: 'harm', label: 'Harmonics', def: 0, fmt: (v) => `set ${Math.min(4, Math.floor(v * 5)) + 1}` },
  { id: 'feedback', label: 'Feedback', def: 0.2, fmt: pct },
  { id: 'inharm', label: 'Inharmonic', def: 0, fmt: pct },
  // Shape
  { id: 'attack', label: 'Attack', def: 0.05, fmt: (v, m) => secs(expo(engineOf(m).attack, v)) },
  { id: 'decay', label: 'Decay', def: 0.4, fmt: (v, m) => secs(expo(engineOf(m).decay, v)) },
  { id: 'sustain', label: 'Sustain', def: 0.5, fmt: (v, m) => pct(lin(engineOf(m).sustain, v)) },
  { id: 'release', label: 'Release', def: 0.3, fmt: (v, m) => secs(expo(engineOf(m).release, v)) },
  { id: 'modDecay', label: 'Mod decay', def: 0.4, fmt: (v, m) => secs(expo(engineOf(m).modDecay, v)) },
  { id: 'velBright', label: 'Vel > bright', def: 0.5, fmt: pct },
  // Space
  { id: 'width', label: 'Width', def: 0.4, fmt: pct },
  { id: 'spread', label: 'Mod spread', def: 0.3, fmt: pct },
  { id: 'lfoRate', label: 'LFO rate', def: 0.4, fmt: (v) => `${lfoHz(v).toFixed(2)} Hz` },
  { id: 'lfoDepth', label: 'LFO depth', def: 0, fmt: pct },
  { id: 'pitchEnv', label: 'Pitch env', def: 0, fmt: (v, m) => `${(v * engineOf(m).pitchEnv.max).toFixed(1)} st` },
  { id: 'tone', label: 'Tone / drive', def: 0.5, fmt: (v) => (v < 0.5 ? `LP ${Math.round(cutoffOf(v))} Hz` : `drive ${pct((v - 0.5) * 2)}`) },
  // Random
  { id: 'method', label: 'Method', def: 0, fmt: (v) => pick(METHODS, v), perform: true },
  { id: 'amount', label: 'Amount', def: 0.5, fmt: pct, perform: true },
  { id: 'go', label: 'Go', def: 0, fmt: (v) => (v >= 0.5 ? 'fire' : 'turn up'), perform: true },
  { id: 'morph', label: 'Morph A>B', def: 0, fmt: pct, perform: true },
  { id: 'lock', label: 'Lock rows', def: 0, fmt: (v) => pick(LOCKS, v), perform: true },
  { id: 'volume', label: 'Volume', def: 0.6, fmt: pct, perform: true },
];

export const K = Object.fromEntries(KNOBS.map((k, i) => [k.id, i]));

function secs(s) { return s < 1 ? `${Math.round(s * 1000)} ms` : `${s.toFixed(2)} s`; }
function lfoHz(v) { return 0.1 * Math.pow(2, v * 6); }
function cutoffOf(v) { return 150 * Math.pow(2, (v / 0.5) * 7.1); }

export function engineOf(m) { return pick(ENGINES, m[K.engine]); }
export function methodOf(m) { return pick(METHODS, m[K.method]); }
export function locksOf(m) {
  const name = pick(LOCKS, m[K.lock]);
  return new Set(name === 'None' ? [] : name.split('+'));
}

export function defaultMacros() { return KNOBS.map((k) => k.def); }

// Hidden per-sound detail that knobs don't cover; reshuffled by randomising.
export function makeVoicing(rand) {
  return {
    level: Array.from({ length: 6 }, () => 0.55 + 0.45 * rand()),
    inharm: Array.from({ length: 6 }, () => rand() - 0.5),
    detune: Array.from({ length: 6 }, () => (rand() - 0.5) * 6),
  };
}

export function buildPatch(m, voicing) {
  const eng = engineOf(m);
  const algoNum = pick(eng.algos, m[K.algo]);
  const algorithm = algoNum - 1;
  const ratios = pick(eng.ratioSets, m[K.harm]);
  const a = expo(eng.attack, m[K.attack]);
  const d = expo(eng.decay, m[K.decay]);
  const s = lin(eng.sustain, m[K.sustain]);
  const r = expo(eng.release, m[K.release]);
  const md = expo(eng.modDecay, m[K.modDecay]);
  const index = eng.indexMax * Math.pow(m[K.bright], 1.5);
  const inh = m[K.inharm];

  const ops = ratios.map((ratio, i) => {
    const carrier = isCarrier(algorithm, i);
    let rr = ratio;
    if (!carrier || eng.inharmCarriers) rr *= 1 + inh * voicing.inharm[i] * (carrier ? 0.3 : 1);
    return {
      ratio: Math.max(0.05, rr),
      detune: voicing.detune[i],
      level: carrier ? 0.85 + 0.15 * voicing.level[i] : voicing.level[i],
      index,
      env: carrier
        ? { a, d, s, r }
        : { a: a * 0.7, d: md, s: eng.modSus * (0.5 + s * 0.5), r },
    };
  });

  const tone = m[K.tone];
  return {
    engine: eng.name,
    algorithm,
    algoNum,
    ops,
    feedback: m[K.feedback] * eng.fbMax,
    velBright: m[K.velBright],
    stereo: { width: m[K.width], detune: m[K.width] * 10, phase: m[K.width], spread: m[K.spread] },
    lfo: { rate: lfoHz(m[K.lfoRate]), depth: m[K.lfoDepth] * 0.8, pitch: m[K.lfoDepth] * m[K.lfoDepth] * 0.3 },
    pitchEnv: { amount: m[K.pitchEnv] * eng.pitchEnv.max, decay: eng.pitchEnv.decay },
    tone: tone < 0.5 ? { cutoff: cutoffOf(tone), drive: 0 } : { cutoff: 20000, drive: (tone - 0.5) * 2 },
    volume: m[K.volume] * 1.5,
  };
}
