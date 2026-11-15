// DX7 SysEx loading, conversion to FM EZ operators, and mutation in DX7
// parameter space (so a mutated voice is still a valid DX7 voice).
//
import { isCarrier } from './engines.js';

// Voice object: { name, algorithm (0-31), feedback (0-7), transpose (0-48, 24 = none),
//   ops: [OP1..OP6] each { rates[4], levels[4], ol, mode, coarse, fine, detune, vel } }

export function parseSysex(bytes) {
  const voices = [];
  for (let i = 0; i < bytes.length - 5; i++) {
    if (bytes[i] !== 0xf0 || bytes[i + 1] !== 0x43) continue;
    const fmt = bytes[i + 3];
    if (fmt === 0x09 && i + 6 + 4096 <= bytes.length) {
      for (let v = 0; v < 32; v++) voices.push(unpackBulk(bytes, i + 6 + v * 128));
      i += 4096;
    } else if (fmt === 0x00 && i + 6 + 155 <= bytes.length) {
      voices.push(unpackSingle(bytes, i + 6));
      i += 155;
    }
  }
  // Headerless 32-voice dump.
  if (!voices.length && bytes.length === 4096) {
    for (let v = 0; v < 32; v++) voices.push(unpackBulk(bytes, v * 128));
  }
  return voices.filter(Boolean);
}

const c = (v, max) => Math.max(0, Math.min(max, v | 0));
const name = (b, o) => String.fromCharCode(...b.slice(o, o + 10)).replace(/[^\x20-\x7e]/g, ' ').trim();

function unpackBulk(b, o) {
  const ops = [];
  for (let k = 0; k < 6; k++) {
    const p = o + k * 17; // first block is OP6
    ops[5 - k] = {
      rates: [b[p], b[p + 1], b[p + 2], b[p + 3]].map((x) => c(x, 99)),
      levels: [b[p + 4], b[p + 5], b[p + 6], b[p + 7]].map((x) => c(x, 99)),
      detune: c(b[p + 12] >> 3, 14),
      vel: c(b[p + 13] >> 2, 7),
      ol: c(b[p + 14], 99),
      mode: b[p + 15] & 1,
      coarse: c(b[p + 15] >> 1, 31),
      fine: c(b[p + 16], 99),
    };
  }
  return {
    name: name(b, o + 118),
    algorithm: b[o + 110] & 31,
    feedback: b[o + 111] & 7,
    transpose: c(b[o + 117], 48),
    ops,
  };
}

function unpackSingle(b, o) {
  const ops = [];
  for (let k = 0; k < 6; k++) {
    const p = o + k * 21;
    ops[5 - k] = {
      rates: [b[p], b[p + 1], b[p + 2], b[p + 3]].map((x) => c(x, 99)),
      levels: [b[p + 4], b[p + 5], b[p + 6], b[p + 7]].map((x) => c(x, 99)),
      vel: c(b[p + 15], 7),
      ol: c(b[p + 16], 99),
      mode: b[p + 17] & 1,
      coarse: c(b[p + 18], 31),
      fine: c(b[p + 19], 99),
      detune: c(b[p + 20], 14),
    };
  }
  return {
    name: name(b, o + 145),
    algorithm: b[o + 134] & 31,
    feedback: b[o + 135] & 7,
    transpose: c(b[o + 144], 48),
    ops,
  };
}

// ---------- conversion ----------
const egTime = (rate) => 40 * Math.pow(2, -rate / 7); // seconds for a full sweep
const lvlAmp = (l) => (l <= 0 ? 0 : Math.pow(2, (l - 99) / 8));

export function opRatio(op) {
  if (op.mode === 1) return null;
  return (op.coarse === 0 ? 0.5 : op.coarse) * (1 + op.fine / 100);
}
export function opFixedHz(op) {
  return op.mode === 1 ? Math.pow(10, (op.coarse & 3) + op.fine / 100) : 0;
}

// Returns FM EZ ops (OP1..OP6) before any macro offsets.
export function voiceToOps(voice) {
  return voice.ops.map((op) => {
    const [r1, r2, r3, r4] = op.rates;
    const [l1, l2, l3] = op.levels;
    const peak = Math.max(l1, l2, 1);
    return {
      ratio: opRatio(op) ?? 1,
      fixed: opFixedHz(op),
      detune: (op.detune - 7) * 1.2,
      amp: lvlAmp(op.ol),
      vel: op.vel / 7,
      env: {
        a: Math.max(0.001, egTime(r1) * (l1 / 99)),
        d: egTime(r2) * 0.5 + egTime(r3),
        s: Math.min(1, lvlAmp(l3) / lvlAmp(peak)),
        r: Math.max(0.01, egTime(r4)),
      },
    };
  });
}

// ---------- mutation ----------
export function mutateVoice(voice, rand, amount, { ratios = true, envs = true, levels = true } = {}) {
  const v = structuredClone(voice);
  const jit = (x, max, spread) => c(Math.round(x + (rand() - 0.5) * 2 * spread * amount), max);
  v.ops.forEach((op, i) => {
    const carrier = isCarrier(v.algorithm, i);
    // Carriers keep their level and pitch so the voice stays playable.
    if (levels && !carrier) op.ol = jit(op.ol, 99, 12);
    if (envs) {
      op.rates = op.rates.map((r) => jit(r, 99, 15));
      op.levels = op.levels.map((l, i) => (i === 3 ? l : jit(l, 99, 10)));
    }
    if (ratios && !carrier && op.mode === 0 && rand() < amount * 0.35) {
      op.coarse = c(op.coarse + (rand() < 0.5 ? -1 : 1), 31);
      if (rand() < 0.3) op.fine = jit(op.fine, 99, 30);
    }
    op.detune = jit(op.detune, 14, 2);
  });
  if (rand() < amount * 0.3) v.feedback = jit(v.feedback, 7, 2);
  return v;
}

// New ratios for modulators only, integer or not depending on chance.
export function rerollRatios(voice, rand, isCarrier) {
  const v = structuredClone(voice);
  v.ops.forEach((op, i) => {
    if (isCarrier(v.algorithm, i) || op.mode === 1) return;
    op.coarse = Math.floor(rand() * 8) + (rand() < 0.15 ? 0 : 1);
    op.fine = rand() < 0.6 ? 0 : Math.floor(rand() * 99);
  });
  return v;
}

// Child voice: each operator taken from A or B; algorithm from one parent.
export function breedVoices(a, b, rand) {
  const v = structuredClone(rand() < 0.5 ? a : b);
  v.ops = a.ops.map((op, i) => structuredClone(rand() < 0.5 ? op : b.ops[i]));
  v.name = `${a.name.slice(0, 5)}${b.name.slice(0, 5)}`;
  return v;
}

export const INIT_VOICE = {
  name: 'INIT VOICE',
  algorithm: 0,
  feedback: 0,
  transpose: 24,
  ops: Array.from({ length: 6 }, (_, i) => ({
    rates: [99, 99, 99, 99], levels: [99, 99, 99, 0], ol: i === 0 ? 99 : 0,
    mode: 0, coarse: 1, fine: 0, detune: 7, vel: 0,
  })),
};

// Blend two voices: numbers interpolate, switches flip halfway.
export function morphVoices(a, b, t) {
  const mix = (x, y) => Math.round(x + (y - x) * t);
  const pickAB = (x, y) => (t < 0.5 ? x : y);
  return {
    name: pickAB(a.name, b.name),
    algorithm: pickAB(a.algorithm, b.algorithm),
    feedback: mix(a.feedback, b.feedback),
    transpose: pickAB(a.transpose, b.transpose),
    ops: a.ops.map((oa, i) => {
      const ob = b.ops[i];
      return {
        rates: oa.rates.map((r, k) => mix(r, ob.rates[k])),
        levels: oa.levels.map((l, k) => mix(l, ob.levels[k])),
        ol: mix(oa.ol, ob.ol),
        mode: pickAB(oa.mode, ob.mode),
        coarse: pickAB(oa.coarse, ob.coarse),
        fine: mix(oa.fine, ob.fine),
        detune: mix(oa.detune, ob.detune),
        vel: mix(oa.vel, ob.vel),
      };
    }),
  };
}
