// Randomisation methods. Each returns a new { macros, voicing } and never
// touches the Random row (the performance controls) or locked rows.
import { K, KNOBS, makeVoicing, locksOf, methodOf, engineOf, library, voiceIndex } from './macros.js';
import { isCarrier } from './engines.js';
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

// Knob indices that a method may change, given locks. Engine stays put:
// randomising works inside the current engine.
function editable(macros) {
  const locks = locksOf(macros);
  const out = [];
  for (let i = 0; i < KNOBS.length; i++) {
    if (KNOBS[i].perform || i === K.engine) continue;
    if (locks.has(KNOBS[i].group)) continue;
    out.push(i);
  }
  return out;
}

function mixVoicing(a, b, t) {
  const mix = (x, y) => x.map((v, i) => v + (y[i] - v) * t);
  return { level: mix(a.level, b.level), inharm: mix(a.inharm, b.inharm), detune: mix(a.detune, b.detune) };
}

export function randomise(state, slots, seed) {
  if (engineOf(state.macros).library) return randomiseLibrary(state, slots, seed);
  const rand = rng(seed);
  const m = state.macros.slice();
  const amount = m[K.amount];
  const keys = editable(m);
  const method = methodOf(m);
  let voicing = state.voicing;

  if (method === 'Generate') {
    // Fresh sound; Amount widens the range away from the middle.
    const spread = 0.35 + 0.65 * amount;
    for (const i of keys) m[i] = clamp(0.5 + (rand() - 0.5) * 2 * spread);
    // Mostly harmonic sounds; inharmonic ones get rarer as Amount drops.
    if (keys.includes(K.inharm)) m[K.inharm] = rand() < 0.6 ? 0 : rand() * amount;
    // Pitch env sweeps only now and then.
    if (keys.includes(K.pitchEnv)) m[K.pitchEnv] = rand() < 0.7 ? 0 : rand() * amount;
    voicing = makeVoicing(rand);
  } else if (method === 'Mutate') {
    for (const i of keys) m[i] = clamp(m[i] + gauss(rand) * amount * 0.15);
    voicing = mixVoicing(voicing, makeVoicing(rand), amount * 0.4);
  } else if (method === 'Harmonic') {
    // Re-roll only the pitch relationships.
    for (const i of [K.algo, K.harm]) if (keys.includes(i)) m[i] = rand();
    if (keys.includes(K.inharm)) m[K.inharm] = rand() < 0.5 ? 0 : rand() * amount;
    const fresh = makeVoicing(rand);
    voicing = { ...voicing, inharm: fresh.inharm, detune: fresh.detune };
  } else if (method === 'Breed') {
    const A = slots.A, B = slots.B;
    if (A && B) {
      for (const i of keys) {
        const t = rand() < 0.5 ? 0 : 1;
        const base = t ? B.macros[i] : A.macros[i];
        m[i] = clamp(base + gauss(rand) * amount * 0.08);
      }
      voicing = mixVoicing(A.voicing, B.voicing, rand());
    } else {
      // Nothing stored yet: behave like Mutate.
      for (const i of keys) m[i] = clamp(m[i] + gauss(rand) * amount * 0.15);
    }
  } else if (method === 'Row') {
    const groups = [...new Set(keys.map((i) => KNOBS[i].group))];
    if (groups.length) {
      const g = groups[Math.floor(rand() * groups.length)];
      for (const i of keys) if (KNOBS[i].group === g) m[i] = rand();
    }
  }
  return { macros: m, voicing, method, base: null };
}

// DX7 Library mode: methods work on the loaded voice's own DX7 parameters.
function randomiseLibrary(state, slots, seed) {
  const rand = rng(seed);
  const m = state.macros.slice();
  const amount = m[K.amount];
  const locks = locksOf(m);
  const method = methodOf(m);
  let base = state.base;
  let label = method;
  if (method === 'Generate' && library.voices.length) {
    // Another voice from the loaded banks.
    m[K.algo] = (Math.floor(rand() * library.voices.length) + 0.5) / library.voices.length;
    base = structuredClone(library.voices[voiceIndex(m)]);
    label = 'Library pick';
  } else if (method === 'Mutate' && base) {
    base = mutateVoice(base, rand, amount, { ratios: !locks.has('Tone'), levels: !locks.has('Tone'), envs: !locks.has('Shape') });
  } else if (method === 'Harmonic' && base && !locks.has('Tone')) {
    base = rerollRatios(base, rand, isCarrier);
  } else if (method === 'Breed' && slots.A?.base && slots.B?.base) {
    base = breedVoices(slots.A.base, slots.B.base, rand);
  } else if (method === 'Row') {
    // Offsets around the loaded voice (middle = as loaded); Algorithm stays on the voice.
    const keys = editable(m).filter((i) => i !== K.algo);
    const groups = [...new Set(keys.map((i) => KNOBS[i].group))];
    if (groups.length) {
      const g = groups[Math.floor(rand() * groups.length)];
      for (const i of keys) {
        if (KNOBS[i].group !== g) continue;
        // Offset knobs (middle = as loaded) except Space and the LFO, which are absolute.
        const absolute = g === 'Space' || i === K.lfoRate || i === K.lfoDepth || i === K.velBright || i === K.tone;
        const fromZero = i === K.pitchEnv || i === K.inharm; // 0 = off
        m[i] = fromZero ? rand() * amount * 0.3 : absolute ? rand() : clamp(0.5 + (rand() - 0.5) * amount);
      }
    }
  } else if (base) {
    base = mutateVoice(base, rand, amount);
    label = 'Mutate';
  }
  return { macros: m, voicing: state.voicing, method: label, base };
}

// Morph between stored A and B (all sound knobs; Random row untouched).
export function morph(state, slots, t) {
  const A = slots.A, B = slots.B;
  if (!A || !B) return null;
  const m = state.macros.slice();
  if (A.base && B.base) {
    return { macros: m, voicing: state.voicing, base: morphVoices(A.base, B.base, t) };
  }
  for (let i = 0; i < KNOBS.length; i++) {
    if (KNOBS[i].perform) continue;
    // Engine is discrete: switch halfway.
    m[i] = i === K.engine ? (t < 0.5 ? A.macros[i] : B.macros[i]) : A.macros[i] + (B.macros[i] - A.macros[i]) * t;
  }
  return { macros: m, voicing: mixVoicing(A.voicing, B.voicing, t), base: null };
}

export const KNOB_COUNT = KNOBS.length;
