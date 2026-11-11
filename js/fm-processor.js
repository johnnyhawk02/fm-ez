// FM EZ audio engine: 6-operator FM in an AudioWorklet.
// Stereo model: every carrier is rendered twice (L and R, detuned and panned),
// every modulator is rendered once and written to separate L/R buses with
// per-side depth weights ("mono panned modulators").
//
// The algorithm routing table is ported from msfa's fm_core.cc
// (Copyright 2012 Google Inc., Apache License 2.0), as used by Dexed.

// Index 0 = OP6 ... index 5 = OP1 (render order).
// Flags: bits 0-1 out bus (0 = audio out), 0x04 add to out bus,
// bits 4-5 in bus, 0xc0 = op has self feedback.
const ALGORITHMS = [
  [0xc1, 0x11, 0x11, 0x14, 0x01, 0x14], // 1
  [0x01, 0x11, 0x11, 0x14, 0xc1, 0x14], // 2
  [0xc1, 0x11, 0x14, 0x01, 0x11, 0x14], // 3
  [0xc1, 0x11, 0x94, 0x01, 0x11, 0x14], // 4
  [0xc1, 0x14, 0x01, 0x14, 0x01, 0x14], // 5
  [0xc1, 0x94, 0x01, 0x14, 0x01, 0x14], // 6
  [0xc1, 0x11, 0x05, 0x14, 0x01, 0x14], // 7
  [0x01, 0x11, 0xc5, 0x14, 0x01, 0x14], // 8
  [0x01, 0x11, 0x05, 0x14, 0xc1, 0x14], // 9
  [0x01, 0x05, 0x14, 0xc1, 0x11, 0x14], // 10
  [0xc1, 0x05, 0x14, 0x01, 0x11, 0x14], // 11
  [0x01, 0x05, 0x05, 0x14, 0xc1, 0x14], // 12
  [0xc1, 0x05, 0x05, 0x14, 0x01, 0x14], // 13
  [0xc1, 0x05, 0x11, 0x14, 0x01, 0x14], // 14
  [0x01, 0x05, 0x11, 0x14, 0xc1, 0x14], // 15
  [0xc1, 0x11, 0x02, 0x25, 0x05, 0x14], // 16
  [0x01, 0x11, 0x02, 0x25, 0xc5, 0x14], // 17
  [0x01, 0x11, 0x11, 0xc5, 0x05, 0x14], // 18
  [0xc1, 0x14, 0x14, 0x01, 0x11, 0x14], // 19
  [0x01, 0x05, 0x14, 0xc1, 0x14, 0x14], // 20
  [0x01, 0x14, 0x14, 0xc1, 0x14, 0x14], // 21
  [0xc1, 0x14, 0x14, 0x14, 0x01, 0x14], // 22
  [0xc1, 0x14, 0x14, 0x01, 0x14, 0x04], // 23
  [0xc1, 0x14, 0x14, 0x14, 0x04, 0x04], // 24
  [0xc1, 0x14, 0x14, 0x04, 0x04, 0x04], // 25
  [0xc1, 0x05, 0x14, 0x01, 0x14, 0x04], // 26
  [0x01, 0x05, 0x14, 0xc1, 0x14, 0x04], // 27
  [0x04, 0xc1, 0x11, 0x14, 0x01, 0x14], // 28
  [0xc1, 0x14, 0x01, 0x14, 0x04, 0x04], // 29
  [0x04, 0xc1, 0x11, 0x14, 0x04, 0x04], // 30
  [0xc1, 0x14, 0x04, 0x04, 0x04, 0x04], // 31
  [0xc4, 0x04, 0x04, 0x04, 0x04, 0x04], // 32
];

const TABLE_SIZE = 4096;
const SINE = new Float32Array(TABLE_SIZE + 1);
for (let i = 0; i <= TABLE_SIZE; i++) SINE[i] = Math.sin((i / TABLE_SIZE) * Math.PI * 2);

function sin01(phase) {
  // phase in cycles, any real value
  let p = phase - Math.floor(phase);
  const x = p * TABLE_SIZE;
  const i = x | 0;
  const f = x - i;
  return SINE[i] + (SINE[i + 1] - SINE[i]) * f;
}

const TWO_PI = Math.PI * 2;
const MAX_VOICES = 8;

class Env {
  constructor() { this.stage = 0; this.value = 0; }
  set(p, sr) {
    this.atkInc = 1 / Math.max(1, p.a * sr);
    this.decCoef = Math.exp(-1 / Math.max(1, p.d * sr / 4.6));
    this.relCoef = Math.exp(-1 / Math.max(1, p.r * sr / 4.6));
    this.sus = p.s;
  }
  gate(on) { this.stage = on ? 1 : 4; }
  next() {
    switch (this.stage) {
      case 1:
        this.value += this.atkInc;
        if (this.value >= 1) { this.value = 1; this.stage = 2; }
        break;
      case 2:
        this.value = this.sus + (this.value - this.sus) * this.decCoef;
        if (this.sus === 0 && this.value < 1e-5) { this.value = 0; this.stage = 0; }
        break;
      case 4:
        this.value *= this.relCoef;
        if (this.value < 1e-5) { this.value = 0; this.stage = 0; }
        break;
    }
    return this.value;
  }
}

class Voice {
  constructor() {
    this.note = -1;
    this.active = false;
    this.env = [0, 1, 2, 3, 4, 5].map(() => new Env());
    this.phase = new Float64Array(6);   // mono / mid phase per op
    this.phaseR = new Float64Array(6);  // second phase for carrier pairs
    this.fb = new Float32Array(2);
    this.pitchEnv = 0;
    this.glide = 0;
    this.age = 0;
  }
}

class FmProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.voices = Array.from({ length: MAX_VOICES }, () => new Voice());
    this.patch = null;
    this.lfoPhase = 0;
    this.lpL = 0; this.lpR = 0;
    this.counter = 0;
    this.mode = 'poly'; // poly | mono (legato) | duo
    this.held = [];     // held notes, newest last: { note, velocity }
    this.port.onmessage = (e) => this.onMessage(e.data);
  }

  onMessage(msg) {
    if (msg.type === 'patch') this.setPatch(msg.patch);
    else if (msg.type === 'noteOn') this.noteOn(msg.note, msg.velocity);
    else if (msg.type === 'noteOff') this.noteOff(msg.note);
    else if (msg.type === 'allOff') this.allOff();
    else if (msg.type === 'debug') this.port.postMessage(this.voices.filter((v) => v.active).map((v) => ({ note: v.note, released: v.released, glide: +v.glide.toFixed(2) })));
    else if (msg.type === 'mode') { this.mode = msg.mode; this.allOff(); }
  }

  allOff() {
    this.held = [];
    for (const v of this.voices) { v.released = true; v.env.forEach((e) => e.gate(false)); }
  }

  setPatch(p) {
    const alg = ALGORITHMS[p.algorithm] || ALGORITHMS[0];
    // Precompute per-render-slot data. Slot i drives OP(6 - i).
    const slots = alg.map((flags, i) => {
      const op = p.ops[5 - i];
      const outbus = flags & 3;
      return {
        op,
        inbus: (flags >> 4) & 3,
        outbus,
        add: (flags & 0x04) !== 0,
        feedback: (flags & 0xc0) === 0xc0,
        carrier: outbus === 0,
      };
    });
    const carriers = slots.filter((s) => s.carrier);
    const nCarr = carriers.length || 1;
    // Spread carrier pairs across the stereo field.
    carriers.forEach((s, k) => {
      const pos = nCarr === 1 ? 0 : (k / (nCarr - 1)) * 2 - 1; // -1..1
      const pan = pos * p.stereo.width * 0.8;
      const ang = (pan + 1) * Math.PI / 4;
      s.gainL = Math.cos(ang) * Math.SQRT2;
      s.gainR = Math.sin(ang) * Math.SQRT2;
      // L/R detune in cents (alternating sign so pairs don't all beat together)
      s.detL = -p.stereo.detune * (k % 2 ? 0.7 : 1);
      s.detR = p.stereo.detune * (k % 2 ? 0.7 : 1);
    });
    // Modulators: alternate their pan across the field by spread.
    let m = 0;
    slots.forEach((s) => {
      if (s.carrier) return;
      const side = (m++ % 2 ? 1 : -1) * p.stereo.spread;
      s.wL = 1 - side * 0.6;
      s.wR = 1 + side * 0.6;
    });
    this.carrierNorm = 0.7 / Math.sqrt(nCarr);
    this.slots = slots;
    this.patch = p;
    // Update envelopes of sounding voices.
    for (const v of this.voices) if (v.active) this.applyEnv(v);
  }

  applyEnv(v) {
    const sr = sampleRate;
    for (let i = 0; i < 6; i++) v.env[i].set(this.patch.ops[i].env, sr);
  }

  noteOn(note, velocity) {
    if (!this.patch) return;
    this.held = this.held.filter((h) => h.note !== note);
    this.held.push({ note, velocity });
    if (this.mode === 'mono') {
      const v = this.voices[0];
      if (v.active && !v.released && this.held.length > 1) return this.legato(v, note);
      return this.trigger(v, note, velocity);
    }
    // Poly uses all voices; duophonic only the first two.
    const pool = this.mode === 'duo' ? this.voices.slice(0, 2) : this.voices;
    let v = pool.find((x) => x.note === note && x.active);
    if (!v) v = pool.find((x) => !x.active);
    if (!v) v = pool.find((x) => x.released);
    if (!v) v = pool.reduce((a, b) => (a.age < b.age ? a : b));
    this.trigger(v, note, velocity);
  }

  // Change pitch without restarting envelopes, with a short glide.
  legato(v, note) {
    v.glide += v.note - note;
    v.note = note;
  }

  trigger(v, note, velocity) {
    v.glide = 0;
    v.note = note;
    v.velocity = velocity;
    v.active = true;
    v.age = ++this.counter;
    v.released = false;
    this.applyEnv(v);
    for (let i = 0; i < 6; i++) {
      v.env[i].value = 0;
      v.env[i].gate(true);
      v.phase[i] = 0;
      v.phaseR[i] = this.patch.stereo.phase * 0.04 * ((i % 2) ? 1 : -1);
    }
    v.fb[0] = v.fb[1] = 0;
    v.pitchEnv = 1;
  }

  noteOff(note) {
    this.held = this.held.filter((h) => h.note !== note);
    if (this.mode === 'mono') {
      const v = this.voices[0];
      if (v.note !== note || v.released) return;
      // Fall back to the last key still held, legato.
      if (this.held.length) return this.legato(v, this.held[this.held.length - 1].note);
      v.released = true;
      v.env.forEach((e) => e.gate(false));
      return;
    }
    if (this.mode === 'duo') {
      // A freed voice picks up a held note that lost its voice.
      const v = this.voices.slice(0, 2).find((x) => x.active && x.note === note && !x.released);
      const sounding = new Set(this.voices.slice(0, 2).filter((x) => x.active && !x.released).map((x) => x.note));
      const waiting = [...this.held].reverse().find((h) => !sounding.has(h.note));
      if (v && waiting) return this.legato(v, waiting.note);
    }
    for (const v of this.voices) {
      if (v.active && v.note === note && !v.released) {
        v.released = true;
        v.env.forEach((e) => e.gate(false));
      }
    }
  }

  process(inputs, outputs) {
    const out = outputs[0];
    const L = out[0], R = out[1] || out[0];
    const n = L.length;
    L.fill(0); if (R !== L) R.fill(0);
    const p = this.patch;
    if (!p) return true;

    const sr = sampleRate;
    this.glideCoef = Math.exp(-128 / (0.05 * sr)); // ~50 ms legato glide per block
    const lfoInc = p.lfo.rate / sr;
    const pitchDecay = Math.exp(-1 / Math.max(1, p.pitchEnv.decay * sr / 4.6));
    const slots = this.slots;
    const fbAmt = p.feedback * Math.PI; // radians of self-modulation
    const busL = new Float32Array(3), busR = new Float32Array(3);

    for (const v of this.voices) {
      if (!v.active) continue;
      const base = 440 * Math.pow(2, (v.note - 69 + v.glide + (p.transpose || 0)) / 12);
      v.glide *= this.glideCoef || 0;
      if (Math.abs(v.glide) < 0.001) v.glide = 0;
      const vel = v.velocity;
      const brightVel = 1 - p.velBright + p.velBright * vel;
      const ampVel = 0.35 + 0.65 * vel;
      // Per-slot frequency increments (cycles per sample), computed per block.
      const incM = new Float64Array(6), incL = new Float64Array(6), incR = new Float64Array(6);
      const pe = v.pitchEnv;
      const pitchMul = Math.pow(2, (p.pitchEnv.amount * pe + p.lfo.pitch * sin01(this.lfoPhase)) / 12);
      for (let i = 0; i < 6; i++) {
        const s = slots[i];
        const op = s.op;
        const f = (op.fixed ? op.fixed : base * op.ratio) * Math.pow(2, op.detune / 1200) * pitchMul;
        incM[i] = f / sr;
        if (s.carrier) {
          incL[i] = incM[i] * Math.pow(2, s.detL / 1200);
          incR[i] = incM[i] * Math.pow(2, s.detR / 1200);
        }
      }
      for (let j = 0; j < n; j++) {
        const lfo = sin01(this.lfoPhase + j * lfoInc);
        const modDepth = brightVel * (1 + p.lfo.depth * lfo);
        busL[1] = busL[2] = busR[1] = busR[2] = 0;
        let outL = 0, outR = 0;
        let alive = false;
        for (let i = 0; i < 6; i++) {
          const s = slots[i];
          const e = v.env[5 - i].next();
          if (v.env[5 - i].stage !== 0) alive = alive || s.carrier;
          const lvl = s.op.level * e;
          if (s.carrier) {
            let inL = 0, inR = 0;
            if (s.feedback) { inL = inR = fbAmt * (v.fb[0] + v.fb[1]) * 0.5; }
            else if (s.inbus) { inL = busL[s.inbus]; inR = busR[s.inbus]; }
            const yL = sin01(v.phase[i] + inL / TWO_PI) * lvl;
            const yR = sin01(v.phaseR[i] + inR / TWO_PI) * lvl;
            if (s.feedback) { v.fb[1] = v.fb[0]; v.fb[0] = (yL + yR) * 0.5; }
            outL += yL * s.gainL;
            outR += yR * s.gainR;
            v.phase[i] += incL[i];
            v.phaseR[i] += incR[i];
          } else {
            let inp = 0;
            if (s.feedback) inp = fbAmt * (v.fb[0] + v.fb[1]) * 0.5;
            else if (s.inbus) inp = (busL[s.inbus] + busR[s.inbus]) * 0.5;
            const y = sin01(v.phase[i] + inp / TWO_PI) * lvl * modDepth * s.op.index;
            if (s.feedback) { v.fb[1] = v.fb[0]; v.fb[0] = y / Math.max(0.001, modDepth * s.op.index); }
            const b = s.outbus;
            if (s.add) { busL[b] += y * s.wL; busR[b] += y * s.wR; }
            else { busL[b] = y * s.wL; busR[b] = y * s.wR; }
            v.phase[i] += incM[i];
          }
        }
        L[j] += outL * this.carrierNorm * ampVel;
        R[j] += outR * this.carrierNorm * ampVel;
        if (!alive) { v.active = false; v.note = -1; break; }
      }
      v.pitchEnv *= Math.pow(pitchDecay, n);
      for (let i = 0; i < 6; i++) {
        v.phase[i] -= Math.floor(v.phase[i]);
        v.phaseR[i] -= Math.floor(v.phaseR[i]);
      }
    }
    this.lfoPhase = (this.lfoPhase + lfoInc * n) % 1;

    // Output stage: tone (one-pole low-pass) and drive, then volume.
    const cutoff = p.tone.cutoff;
    const a = 1 - Math.exp(-TWO_PI * cutoff / sr);
    const drive = p.tone.drive;
    const vol = p.volume;
    const dn = drive > 0 ? Math.tanh(1 + drive * 4) : 1;
    for (let j = 0; j < n; j++) {
      this.lpL += (L[j] - this.lpL) * a;
      this.lpR += (R[j] - this.lpR) * a;
      let l = this.lpL, r = this.lpR;
      if (drive > 0) { l = Math.tanh(l * (1 + drive * 4)) / dn; r = Math.tanh(r * (1 + drive * 4)) / dn; }
      L[j] = Math.tanh(l * vol);
      if (R !== L) R[j] = Math.tanh(r * vol);
    }
    return true;
  }
}

registerProcessor('fm-processor', FmProcessor);
