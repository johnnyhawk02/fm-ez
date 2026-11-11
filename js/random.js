// Randomisation methods. Each takes the current sound and returns a new one
// { engine, macros, voicing, base, method }. The Random row (knobs 21-24) and
// locked rows are never touched.
import { knobsFor, makeVoicing, locksOf, methodOf, library, voiceIndexOf, ENGINE_KNOBS, SHARED } from './macros.js';
import { ENGINES, isCarrier } from './engines.js';
import { mutateVoice, rerollRatios, breedVoices, morphVoices } from './dx7.js';

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (v) => Math.min(1, Math.max(0, v));
const gauss = (rand) => {
  const u = Math.max(1e-9, rand()), v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};

// Knob indices (0-19) a method may change, given the locked rows.
function editable(sound, lock) {
  const locks = locksOf(lock);
  const knobs = knobsFor(sound.engine);
  const out = [];
  for (let i = 0; i < ENGINE_KNOBS; i++) if (!locks.has(knobs[i].group)) out.push(i);
  return out;
}

function mixVoicing(a, b, t) {
  const mix = (x, y) => x.map((v, i) => v + (y[i] - v) * t);
  return { level: mix(a.level, b.level), inharm: mix(a.inharm, b.inharm), detune: mix(a.detune, b.detune) };
}

// sound = { engine, macros, voicing, base }; lock = on-screen Lock rows choice.
export function randomise(sound, slots, seed, lock) {
  if (ENGINES[sound.engine].library) return randomiseLibrary(sound, slots, seed, lock);
  const rand = rng(seed);
  const m = sound.macros.slice();
  const knobs = knobsFor(sound.engine);
  const amount = m[SHARED.amount];
  const keys = editable(sound, lock);
  const method = methodOf(m);
  let voicing = sound.voicing;

  if (method === 'Generate') {
    // Fresh sound in this engine; Amount widens the range around each knob's default.
    const spread = 0.35 + 0.65 * amount;
    for (const i of keys) {
      const k = knobs[i];
      if (k.stepped) m[i] = rand();
      else if (k.sparse) m[i] = rand() < 0.6 ? k.def : rand() * amount;
      else m[i] = clamp(k.def + (rand() - 0.5) * 2 * spread);
    }
    voicing = makeVoicing(rand);
  } else if (method === 'Mutate') {
    for (const i of keys) if (!knobs[i].stepped) m[i] = clamp(m[i] + gauss(rand) * amount * 0.15);
    voicing = mixVoicing(voicing, makeVoicing(rand), amount * 0.4);
  } else if (method === 'Harmonic') {
    // Re-roll only the pitch relationships.
    for (const i of keys) {
      const t = knobs[i].type;
      if (t === 'modRatio' || t === 'mix') m[i] = rand();
      if (t === 'inharm') m[i] = rand() < 0.5 ? 0 : rand() * amount;
    }
    const fresh = makeVoicing(rand);
    voicing = { ...voicing, inharm: fresh.inharm, detune: fresh.detune };
  } else if (method === 'Breed') {
    const A = slots.A, B = slots.B;
    if (A && B && A.engine === sound.engine && B.engine === sound.engine) {
      for (const i of keys) {
        const base = rand() < 0.5 ? A.macros[i] : B.macros[i];
        m[i] = knobs[i].stepped ? base : clamp(base + gauss(rand) * amount * 0.08);
      }
      voicing = mixVoicing(A.voicing, B.voicing, rand());
    } else {
      // A and B not both stored in this engine: behave like Mutate.
      for (const i of keys) if (!knobs[i].stepped) m[i] = clamp(m[i] + gauss(rand) * amount * 0.15);
    }
  } else if (method === 'Row') {
    const rows = [...new Set(keys.map((i) => Math.floor(i / 4)))];
    if (rows.length) {
      const row = rows[Math.floor(rand() * rows.length)];
      for (const i of keys) if (Math.floor(i / 4) === row) m[i] = rand();
    }
  }
  return { engine: sound.engine, macros: m, voicing, method, base: null };
}

// DX7 engine: methods work on the loaded voice's own DX7 parameters.
function randomiseLibrary(sound, slots, seed, lock) {
  const rand = rng(seed);
  const m = sound.macros.slice();
  const knobs = knobsFor(sound.engine);
  const amount = m[SHARED.amount];
  const locks = locksOf(lock);
  const method = methodOf(m);
  let base = sound.base;
  let label = method;
  if (method === 'Generate' && library.voices.length) {
    // Another voice from the loaded banks.
    m[0] = (Math.floor(rand() * library.voices.length) + 0.5) / library.voices.length;
    base = structuredClone(library.voices[voiceIndexOf(m[0])]);
    label = 'Library pick';
  } else if (method === 'Mutate' && base) {
    base = mutateVoice(base, rand, amount, { ratios: !locks.has('Tone'), levels: !locks.has('Tone'), envs: !locks.has('Shape') });
  } else if (method === 'Harmonic' && base && !locks.has('Tone')) {
    base = rerollRatios(base, rand, isCarrier);
  } else if (method === 'Breed' && slots.A?.base && slots.B?.base) {
    base = breedVoices(slots.A.base, slots.B.base, rand);
  } else if (method === 'Row') {
    // Offsets around the loaded voice; knob 1 stays on the voice.
    const keys = editable(sound, lock).filter((i) => i !== 0);
    const rows = [...new Set(keys.map((i) => Math.floor(i / 4)))];
    if (rows.length) {
      const row = rows[Math.floor(rand() * rows.length)];
      for (const i of keys) {
        if (Math.floor(i / 4) !== row) continue;
        const k = knobs[i];
        m[i] = k.sparse ? rand() * amount * 0.5 : clamp(k.def + (rand() - 0.5) * amount);
      }
    }
  } else if (base) {
    base = mutateVoice(base, rand, amount);
    label = 'Mutate';
  }
  return { engine: sound.engine, macros: m, voicing: sound.voicing, method: label, base };
}

// Morph between stored A and B. Different engines: switch halfway.
export function morph(sound, slots, t) {
  const A = slots.A, B = slots.B;
  if (!A || !B) return null;
  if (A.engine !== B.engine) {
    const S = t < 0.5 ? A : B;
    return { engine: S.engine, macros: S.macros.slice(), voicing: S.voicing, base: S.base };
  }
  if (A.base && B.base) {
    return { engine: A.engine, macros: sound.macros.slice(), voicing: sound.voicing, base: morphVoices(A.base, B.base, t) };
  }
  const knobs = knobsFor(A.engine);
  const m = sound.macros.slice();
  for (let i = 0; i < ENGINE_KNOBS; i++) {
    m[i] = knobs[i].stepped ? (t < 0.5 ? A.macros[i] : B.macros[i]) : A.macros[i] + (B.macros[i] - A.macros[i]) * t;
  }
  return { engine: A.engine, macros: m, voicing: mixVoicing(A.voicing, B.voicing, t), base: null };
}
