// The 24 knobs (4 rows x 6 columns, laid out like the Faderfox PC4) and how
// they turn into a full 6-operator patch.
import { ENGINES, isCarrier } from './engines.js';
import { voiceToOps, INIT_VOICE } from './dx7.js';

// Voices loaded from .syx files.
export const library = { voices: [] };

export const ROWS = ['Tone', 'Shape', 'Space', 'Random'];

export const METHODS = ['Generate', 'Mutate', 'Harmonic', 'Breed', 'Row'];
export const LOCKS = ['None', 'Tone', 'Shape', 'Space', 'Tone+Shape', 'Shape+Space', 'Tone+Space'];

const pick = (list, v) => list[Math.min(list.length - 1, Math.floor(v * list.length))];
const lin = ([a, b], v) => a + (b - a) * v;
const expo = ([a, b], v) => (a <= 0 ? lin([a, b], v) : a * Math.pow(b / a, v));
const pct = (v) => `${Math.round(v * 100)}`;
// Library mode: knobs are offsets, middle = the voice as loaded.
const mult = (v, range) => Math.pow(2, (v - 0.5) * range);
const times = (v) => `x${mult(v, 6).toFixed(2)}`;
const isLib = (m) => !!engineOf(m).library;
export const octaveOf = (v) => Math.round((v - 0.5) * 4);
export function voiceIndex(m) {
  const n = library.voices.length;
  return n ? Math.min(n - 1, Math.floor(m[K.algo] * n)) : -1;
}

export const KNOBS = [
  // Tone
  { id: 'engine', label: 'Engine', def: 1 / 12 + 1 / 6, fmt: (v) => pick(ENGINES, v).name },
  { id: 'algo', label: 'Algorithm', def: 0, fmt: (v, m) => (isLib(m) ? (voiceIndex(m) < 0 ? 'load .syx' : `${voiceIndex(m) + 1} ${library.voices[voiceIndex(m)].name}`) : `DX ${pick(engineOf(m).algos, v)}`) },
  { id: 'bright', label: 'Brightness', def: 0.45, fmt: (v, m) => (isLib(m) ? `x${mult(v, 4).toFixed(2)}` : pct(v)) },
  { id: 'harm', label: 'Harmonics', def: 0, fmt: (v, m) => (isLib(m) ? `${octaveOf(v) > 0 ? '+' : ''}${octaveOf(v)} oct` : `set ${Math.min(4, Math.floor(v * 5)) + 1}`) },
  { id: 'feedback', label: 'Feedback', def: 0.2, fmt: (v, m) => (isLib(m) ? `x${(v * 2).toFixed(2)}` : pct(v)) },
  { id: 'inharm', label: 'Inharmonic', def: 0, fmt: pct },
  // Shape
  { id: 'attack', label: 'Attack', def: 0.05, fmt: (v, m) => (isLib(m) ? times(v) : secs(expo(engineOf(m).attack, v))) },
  { id: 'decay', label: 'Decay', def: 0.4, fmt: (v, m) => (isLib(m) ? times(v) : secs(expo(engineOf(m).decay, v))) },
  { id: 'sustain', label: 'Sustain', def: 0.5, fmt: (v, m) => (isLib(m) ? `x${(v * 2).toFixed(2)}` : pct(lin(engineOf(m).sustain, v))) },
  { id: 'release', label: 'Release', def: 0.3, fmt: (v, m) => (isLib(m) ? times(v) : secs(expo(engineOf(m).release, v))) },
  { id: 'modDecay', label: 'Mod decay', def: 0.4, fmt: (v, m) => (isLib(m) ? times(v) : secs(expo(engineOf(m).modDecay, v))) },
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

// Knobs set to "as loaded" when a DX7 voice comes in.
export const NEUTRAL = ['bright', 'harm', 'feedback', 'attack', 'decay', 'sustain', 'release', 'modDecay'];
export function neutralise(m) {
  for (const id of NEUTRAL) m[K[id]] = 0.5;
  m[K.inharm] = 0;
  m[K.pitchEnv] = 0;
}

export function buildPatch(m, voicing, base) {
  const eng = engineOf(m);
  if (eng.library) return buildLibraryPatch(m, voicing, base || INIT_VOICE);
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

  return finish(m, eng, {
    engine: eng.name,
    algorithm,
    algoNum,
    ops,
    feedback: m[K.feedback] * eng.fbMax,
    transpose: 0,
  });
}

function buildLibraryPatch(m, voicing, voice) {
  const eng = engineOf(m);
  const algorithm = voice.algorithm;
  const bright = mult(m[K.bright], 4);
  const tA = mult(m[K.attack], 6), tD = mult(m[K.decay], 6), tR = mult(m[K.release], 6);
  const tMD = mult(m[K.modDecay], 6), sMul = m[K.sustain] * 2;
  const inh = m[K.inharm];
  const ops = voiceToOps(voice).map((op, i) => {
    const carrier = isCarrier(algorithm, i);
    const ratio = carrier ? op.ratio : op.ratio * (1 + inh * voicing.inharm[i]);
    return {
      ratio: Math.max(0.05, ratio),
      fixed: op.fixed,
      detune: op.detune,
      level: op.amp,
      index: carrier ? 1 : 4 * Math.PI * bright,
      env: {
        a: op.env.a * tA,
        d: op.env.d * tD * (carrier ? 1 : tMD),
        s: Math.min(1, op.env.s * sMul),
        r: op.env.r * tR,
      },
    };
  });
  return finish(m, eng, {
    engine: `DX7: ${voice.name}`,
    algorithm,
    algoNum: algorithm + 1,
    ops,
    feedback: Math.min(1, (voice.feedback / 7) * m[K.feedback] * 2),
    transpose: voice.transpose - 24 + 12 * octaveOf(m[K.harm]),
  });
}

function finish(m, eng, p) {
  const tone = m[K.tone];
  return {
    ...p,
    velBright: m[K.velBright],
    stereo: { width: m[K.width], detune: m[K.width] * 10, phase: m[K.width], spread: m[K.spread] },
    lfo: { rate: lfoHz(m[K.lfoRate]), depth: m[K.lfoDepth] * 0.8, pitch: m[K.lfoDepth] * m[K.lfoDepth] * 0.3 },
    pitchEnv: { amount: m[K.pitchEnv] * eng.pitchEnv.max, decay: eng.pitchEnv.decay },
    tone: tone < 0.5 ? { cutoff: cutoffOf(tone), drive: 0 } : { cutoff: 20000, drive: (tone - 0.5) * 2 },
    volume: m[K.volume] * 1.5,
  };
}
