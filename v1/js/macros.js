// Macro types and how a sound (engine + 24 knob positions) becomes a full
// 6-operator patch. Knobs 1-20 (rows 1-5) are the engine's own macros;
// knobs 21-24 (row 6, Random) are shared by every engine.
import { ENGINES, isCarrier } from './engines.js';
import { voiceToOps, INIT_VOICE } from './dx7.js';

// Voices loaded from .syx files.
export const library = { voices: [] };

export const METHODS = ['Generate', 'Mutate', 'Harmonic', 'Breed', 'Row'];
export const LOCKS = ['None', 'Tone', 'Shape', 'Space', 'Tone+Shape', 'Shape+Space', 'Tone+Space'];
// Rows 1-2 are Tone, rows 3-4 Shape, row 5 Space (what Lock protects).
export const ROW_GROUPS = ['Tone', 'Tone', 'Shape', 'Shape', 'Space'];
export const ENGINE_KNOBS = 20;

const pick = (list, v) => list[Math.min(list.length - 1, Math.max(0, Math.floor(v * list.length)))];
const lin = ([a, b], v) => a + (b - a) * v;
const expo = ([a, b], v) => (a <= 0 ? lin([a, b], v) : a * Math.pow(b / a, v));
const pct = (v) => `${Math.round(v * 100)}`;
const secs = (s) => (s < 1 ? `${Math.round(s * 1000)} ms` : `${s.toFixed(2)} s`);
// Library offsets: middle = as loaded.
const mult = (v, range) => Math.pow(2, (v - 0.5) * range);
const times = (v, range = 6) => `x${mult(v, range).toFixed(2)}`;
const lfoHz = (v) => 0.1 * Math.pow(2, v * 6);
const cutoffOf = (v) => 150 * Math.pow(2, v * 7.1);
const stepped = (r, v, step) => Math.round(lin(r, v) / step) * step;

// ---------- macro types ----------
// apply(spec, val, k, ctx): val(op) is the knob value as operator `op` sees it
// (per-operator Depth in the knob matrix); val() is the plain knob value.
// op: true marks types that act per operator (their Depth is editable).
// lib: replaces apply in the DX7 engine (offsets around the loaded voice).
const forMods = (spec, fn) => spec.ops.forEach((o, i) => { if (!o.carrier) fn(o, i); });
const forCarriers = (spec, fn) => spec.ops.forEach((o, i) => { if (o.carrier) fn(o, i); });

export const TYPES = {
  sound: { label: 'Sound', stepped: true, apply() {} },
  tune: {
    label: 'Tune', range: [-24, 24], step: 1, def: 0.5, stepped: true,
    fmt: (v, k) => { const n = stepped(k.range, v, k.step); return k.step === 12 ? `${n > 0 ? '+' : ''}${n / 12} oct` : `${n > 0 ? '+' : ''}${n} st`; },
    apply: (s, val, k) => { s.transpose += stepped(k.range, val(), k.step); },
  },
  modRatio: {
    label: 'Overtone', list: [0.5, 1, 2, 3], op: true, stepped: true,
    fmt: (v, k) => `x${pick(k.list, v)}`,
    apply: (s, val, k) => forMods(s, (o, i) => { o.ratio *= pick(k.list, val(i)); }),
  },
  inharm: {
    label: 'Inharmonic', range: [0, 1], def: 0, op: true, sparse: true,
    fmt: (v) => pct(v),
    apply: (s, val, k, c) => s.ops.forEach((o, i) => {
      if (o.carrier && !c.eng.inharmCarriers) return;
      o.ratio *= 1 + val(i) * k.range[1] * c.voicing.inharm[i] * (o.carrier ? 0.3 : 1);
    }),
  },
  bright: {
    label: 'Brightness', range: [0, 5], def: 0.45, op: true,
    fmt: (v, k, e) => (e.library ? times(v, 4) : pct(v)),
    apply: (s, val, k) => forMods(s, (o, i) => { o.index = k.range[1] * Math.pow(val(i), 1.5); }),
    lib: (s, val) => forMods(s, (o, i) => { o.index *= mult(val(i), 4); }),
  },
  feedback: {
    label: 'Feedback', range: [0, 1], def: 0.15,
    fmt: (v, k, e) => (e.library ? `x${(v * 2).toFixed(2)}` : pct(v)),
    apply: (s, val, k) => { s.feedback = lin(k.range, val()); },
    lib: (s, val) => { s.feedback = Math.min(1, s.feedback * val() * 2); },
  },
  mix: {
    label: 'Mix', def: 0.5,
    fmt: (v) => `${Math.round((1 - v) * 100)} / ${Math.round(v * 100)}`,
    apply: (s, val) => {
      let n = 0;
      forCarriers(s, (o) => { o.level *= n++ === 0 ? Math.min(1, 2 * (1 - val())) : Math.min(1, 2 * val()); });
    },
  },
  attack: {
    label: 'Attack', range: [0.001, 0.1], def: 0, op: true,
    fmt: (v, k, e) => (e.library ? times(v) : secs(expo(k.range, v))),
    apply: (s, val, k) => s.ops.forEach((o, i) => { o.env.a = expo(k.range, val(i)) * (o.carrier ? 1 : 0.7); }),
    lib: (s, val) => s.ops.forEach((o, i) => { o.env.a *= mult(val(i), 6); }),
  },
  modAttack: {
    label: 'Mod attack', range: [0.001, 4], def: 0, op: true,
    fmt: (v, k) => secs(expo(k.range, v)),
    apply: (s, val, k) => forMods(s, (o, i) => { o.env.a = expo(k.range, val(i)); }),
  },
  decay: {
    label: 'Decay', range: [0.05, 3], def: 0.4, op: true,
    fmt: (v, k, e) => (e.library ? times(v) : secs(expo(k.range, v))),
    apply: (s, val, k) => forCarriers(s, (o, i) => { o.env.d = expo(k.range, val(i)); }),
    lib: (s, val) => s.ops.forEach((o, i) => { o.env.d *= mult(val(i), 6); }),
  },
  sustain: {
    label: 'Sustain', range: [0, 1], def: 0.5, op: true,
    fmt: (v, k, e) => (e.library ? `x${(v * 2).toFixed(2)}` : pct(lin(k.range, v))),
    apply: (s, val, k, c) => s.ops.forEach((o, i) => {
      const lv = lin(k.range, val(i));
      o.env.s = o.carrier ? lv : (c.eng.modEnv.s * (0.5 + 0.5 * lv));
    }),
    lib: (s, val) => s.ops.forEach((o, i) => { o.env.s = Math.min(1, o.env.s * val(i) * 2); }),
  },
  modDecay: {
    label: 'Mod decay', range: [0.02, 2], def: 0.4, op: true,
    fmt: (v, k, e) => (e.library ? times(v) : secs(expo(k.range, v))),
    apply: (s, val, k) => forMods(s, (o, i) => { o.env.d = expo(k.range, val(i)); }),
    lib: (s, val) => forMods(s, (o, i) => { o.env.d *= mult(val(i), 6); }),
  },
  release: {
    label: 'Release', range: [0.02, 2], def: 0.3, op: true,
    fmt: (v, k, e) => (e.library ? times(v) : secs(expo(k.range, v))),
    apply: (s, val, k) => s.ops.forEach((o, i) => { o.env.r = expo(k.range, val(i)); }),
    lib: (s, val) => s.ops.forEach((o, i) => { o.env.r *= mult(val(i), 6); }),
  },
  pitchDrop: {
    label: 'Pitch drop', range: [0, 24], def: 0, sparse: true,
    fmt: (v, k) => `${(v * k.range[1]).toFixed(1)} st`,
    apply: (s, val, k) => { s.pitchEnv.amount = val() * k.range[1]; },
  },
  dropTime: {
    label: 'Drop time', range: [0.005, 0.4], def: 0.3,
    fmt: (v, k) => secs(expo(k.range, v)),
    apply: (s, val, k) => { s.pitchEnv.decay = expo(k.range, val()); },
  },
  detune: {
    label: 'Detune', range: [0, 20], def: 0.2,
    fmt: (v, k) => `${(v * k.range[1]).toFixed(1)} cents`,
    apply: (s, val, k) => { s.stereo.detune = val() * k.range[1]; },
  },
  velBright: { label: 'Vel > bright', def: 0.5, fmt: pct, apply: (s, val) => { s.velBright = val(); } },
  velAmp: { label: 'Vel > level', def: 0.65, fmt: pct, apply: (s, val) => { s.velAmp = val(); } },
  glide: {
    label: 'Glide', range: [0.005, 0.5], def: 0.3,
    fmt: (v, k) => secs(expo(k.range, v)),
    apply: (s, val, k) => { s.glide = expo(k.range, val()); },
  },
  lfoRate: { label: 'LFO rate', def: 0.4, fmt: (v) => `${lfoHz(v).toFixed(2)} Hz`, apply: (s, val) => { s.lfo.rate = lfoHz(val()); } },
  lfoDepth: { label: 'LFO depth', def: 0, sparse: true, fmt: pct, apply: (s, val) => { s.lfo.depth = val() * 0.8; } },
  vibrato: {
    label: 'Vibrato', range: [0, 0.5], def: 0, sparse: true,
    fmt: (v, k) => `${(v * k.range[1]).toFixed(2)} st`,
    apply: (s, val, k) => { s.lfo.pitch = val() * k.range[1]; },
  },
  width: { label: 'Width', def: 0.4, fmt: pct, apply: (s, val) => { s.stereo.width = val(); s.stereo.phase = val(); } },
  spread: { label: 'Mod spread', def: 0.3, fmt: pct, apply: (s, val) => { s.stereo.spread = val(); } },
  drive: { label: 'Drive', def: 0, sparse: true, fmt: pct, apply: (s, val) => { s.tone.drive = val(); } },
  cutoff: {
    label: 'Low-pass', def: 1,
    fmt: (v) => (v > 0.995 ? 'open' : `${Math.round(cutoffOf(v))} Hz`),
    apply: (s, val) => { s.tone.cutoff = cutoffOf(val()); },
  },
};

// Apply order (attack before modAttack, ratios before inharmonic...).
const ORDER = ['tune', 'modRatio', 'inharm', 'bright', 'feedback', 'mix', 'attack', 'modAttack', 'decay',
  'sustain', 'modDecay', 'release', 'pitchDrop', 'dropTime', 'detune', 'velBright', 'velAmp', 'glide',
  'lfoRate', 'lfoDepth', 'vibrato', 'width', 'spread', 'drive', 'cutoff'];

// Shared Random row (knobs 21-24).
export const SHARED_KNOBS = [
  { type: 'method', label: 'Method', def: 0, perform: true, fmt: (v) => pick(METHODS, v) },
  { type: 'amount', label: 'Amount', def: 0.5, perform: true, fmt: pct },
  { type: 'go', label: 'Go', def: 0, perform: true, fmt: (v) => (v >= 0.5 ? 'fire' : 'turn up') },
  { type: 'morph', label: 'Morph A>B', def: 0, perform: true, fmt: pct },
];
export const SHARED = { method: 20, amount: 21, go: 22, morph: 23 };

// The 24 resolved knobs for an engine: { type, label, def, range, list, step, group, op, fmt(v) }.
const cache = new Map();
export function knobsFor(engineIndex) {
  if (cache.has(engineIndex)) return cache.get(engineIndex);
  const eng = ENGINES[engineIndex];
  const own = eng.knobs.map((k, i) => {
    const t = TYPES[k.type];
    const r = { ...t, ...k, group: ROW_GROUPS[Math.floor(i / 4)] };
    r.label = k.label || t.label;
    // Stepped lists default to their x1 entry.
    const listDef = r.list && r.list.includes(1) ? (r.list.indexOf(1) + 0.5) / r.list.length : 0;
    r.def = k.def ?? t.def ?? listDef;
    const fmt = t.fmt || pct;
    r.fmt = (v) => fmt(v, r, eng);
    return r;
  });
  // Sound / voice label needs the engine's presets or the library.
  own[0].fmt = (v) => {
    if (eng.library) { const i = voiceIndexOf(v); return i < 0 ? 'load .syx' : `${i + 1} ${library.voices[i].name}`; }
    return pick(eng.presets, v).name;
  };
  const all = [...own, ...SHARED_KNOBS.map((k) => ({ ...k, group: 'Random' }))];
  cache.set(engineIndex, all);
  return all;
}

export function voiceIndexOf(v) {
  const n = library.voices.length;
  return n ? Math.min(n - 1, Math.floor(v * n)) : -1;
}

export function defaultMacros(engineIndex) { return knobsFor(engineIndex).map((k) => k.def); }
export function methodOf(m) { return pick(METHODS, m[SHARED.method]); }
export function locksOf(lock) { return new Set(!lock || lock === 'None' ? [] : lock.split('+')); }

// Hidden per-sound detail that knobs don't cover; reshuffled by randomising.
export function makeVoicing(rand) {
  return {
    level: Array.from({ length: 6 }, () => 0.55 + 0.45 * rand()),
    inharm: Array.from({ length: 6 }, () => rand() - 0.5),
    detune: Array.from({ length: 6 }, () => (rand() - 0.5) * 6),
  };
}

// Per-operator routing, edited in the knob matrix: routing["Engine:type"][op]
// scales how far that knob moves that operator away from the knob's default
// (1 = normal, 0 = ignores the knob, -1 = opposite way). Missing = all 1.
export const routing = {};
export const routingKey = (engineIndex, type) => `${ENGINES[engineIndex].name}:${type}`;

// sound = { engine, macros, voicing, base, volume }
export function buildPatch(sound) {
  const { engine, macros: m, voicing } = sound;
  const eng = ENGINES[engine];
  const knobs = knobsFor(engine);
  let spec;
  if (eng.library) {
    spec = specFromVoice(sound.base || INIT_VOICE, eng);
  } else {
    const preset = pick(eng.presets, m[0]);
    const algorithm = preset.algo - 1;
    spec = baseSpec(eng, `${eng.name}: ${preset.name}`, algorithm);
    spec.ops = preset.ratios.map((ratio, i) => {
      const carrier = isCarrier(algorithm, i);
      return {
        carrier,
        ratio,
        fixed: 0,
        detune: voicing.detune[i],
        level: carrier ? 0.85 + 0.15 * voicing.level[i] : voicing.level[i],
        index: 2,
        env: { ...(carrier ? eng.env : eng.modEnv) },
      };
    });
  }
  const ctx = { eng, voicing };
  for (const type of ORDER) {
    knobs.forEach((k, idx) => {
      if (k.type !== type || idx >= ENGINE_KNOBS) return;
      const w = routing[routingKey(engine, type)];
      const val = (op) => {
        const v = m[idx];
        if (op === undefined || !w || w[op] === 1) return v;
        return Math.min(1, Math.max(0, k.def + (v - k.def) * w[op]));
      };
      const t = TYPES[type];
      (eng.library && t.lib ? t.lib : t.apply)(spec, val, k, ctx);
    });
  }
  spec.volume = (sound.volume ?? 0.6) * 1.5;
  return spec;
}

function baseSpec(eng, name, algorithm) {
  return {
    engine: name,
    algorithm,
    algoNum: algorithm + 1,
    ops: [],
    feedback: 0,
    transpose: 0,
    velBright: 0.5,
    velAmp: 0.65,
    glide: 0.05,
    stereo: { width: 0.4, detune: 4, phase: 0.4, spread: 0.3 },
    lfo: { rate: eng.lfoRate || 1, depth: 0, pitch: 0 },
    pitchEnv: { amount: 0, decay: 0.05 },
    tone: { cutoff: 20000, drive: 0 },
    volume: 0.9,
  };
}

function specFromVoice(voice, eng) {
  const spec = baseSpec(eng, `DX7: ${voice.name}`, voice.algorithm);
  spec.feedback = voice.feedback / 7;
  spec.transpose = voice.transpose - 24;
  spec.ops = voiceToOps(voice).map((op, i) => {
    const carrier = isCarrier(voice.algorithm, i);
    return {
      carrier,
      ratio: op.ratio,
      fixed: op.fixed,
      detune: op.detune,
      level: op.amp,
      index: carrier ? 1 : 4 * Math.PI,
      env: { ...op.env },
    };
  });
  return spec;
}
