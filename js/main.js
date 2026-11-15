import { knobInfo, defaultKnobs, buildPatch, opRoles, envAt, pc4ToKnob, G } from './synth.js';
import { Midi } from './midi.js';

// ---------- state ----------
const SAVE_KEY = 'fmez.simple.v1';
let knobs = defaultKnobs();
try {
  const saved = JSON.parse(localStorage.getItem(SAVE_KEY));
  if (Array.isArray(saved) && saved.length === 24) knobs = saved;
} catch { /* nothing saved */ }
const defaults = defaultKnobs();
const knobHw = Array.from({ length: 24 }, () => ({ hw: null, picked: true })); // soft takeover
let audio = null;
let voiceMode = 'poly';

// ---------- audio ----------
let audioStarting = null;
function startAudio() {
  if (audio) { if (audio.ctx.state !== 'running') audio.ctx.resume(); return Promise.resolve(); }
  if (!audioStarting) audioStarting = createAudio();
  return audioStarting;
}
async function createAudio() {
  const ctx = new AudioContext({ latencyHint: 'interactive' });
  await ctx.audioWorklet.addModule('js/fm-processor.js');
  const node = new AudioWorkletNode(ctx, 'fm-processor', { numberOfInputs: 0, outputChannelCount: [2] });
  node.connect(ctx.destination);
  audio = { ctx, node };
  node.port.postMessage({ type: 'mode', mode: voiceMode });
  sendPatch();
  setStatus('Audio on. Play with A W S E D F T G Y H U J K, Z/X for octave.');
  document.body.classList.add('running');
}

let pending = false;
let saveTimer = 0;
function sendPatch() {
  if (pending) return;
  pending = true;
  requestAnimationFrame(() => {
    pending = false;
    if (audio) audio.node.port.postMessage({ type: 'patch', patch: buildPatch(knobs) });
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(knobs)); } catch { /* blocked */ } }, 300);
  });
}
const noteOn = (note, vel) => audio && audio.node.port.postMessage({ type: 'noteOn', note, velocity: vel });
const noteOff = (note) => audio && audio.node.port.postMessage({ type: 'noteOff', note });

// ---------- knobs ----------
const ROW_CLASS = ['pitch', 'env', 'level', 'global'];
const grid = document.getElementById('grid');
const knobEls = Array.from({ length: 24 }, (_, i) => {
  const info = knobInfo(i);
  const el = document.createElement('div');
  el.className = 'knob';
  el.dataset.row = ROW_CLASS[info.row];
  el.innerHTML = `
    <svg viewBox="0 0 60 60" aria-hidden="true">
      <circle class="track" cx="30" cy="30" r="22" />
      <path class="arc" d="" />
      <line class="pointer" x1="30" y1="30" x2="30" y2="10" />
      <circle class="hw" r="3" cx="30" cy="8" />
    </svg>
    ${info.row === 1 ? '<svg class="shape" viewBox="0 0 60 18" aria-hidden="true"><polyline points="" /></svg>' : ''}
    <div class="label">${info.label}</div>
    <div class="value"></div>`;
  el.tabIndex = 0;
  el.title = info.title || info.label;
  grid.appendChild(el);
  attachDrag(el, i);
  return el;
});

const heads = document.getElementById('heads');
const headEls = Array.from({ length: 6 }, (_, op) => {
  const el = document.createElement('div');
  heads.appendChild(el);
  return el;
});

function polar(v, r) {
  const ang = (-135 + v * 270) * (Math.PI / 180);
  return [30 + r * Math.sin(ang), 30 - r * Math.cos(ang)];
}

// Small picture of an envelope: attack, decay to sustain, hold, release.
function shapePoints(env) {
  const t = (s) => Math.log10(1 + s * 20) / Math.log10(1 + 4 * 20); // squash long times
  const W = 60, H = 16, top = 1;
  const a = t(env.a) * 16, d = t(env.d) * 16, hold = 12, r = t(env.r) * 16;
  const y = (lvl) => top + (1 - lvl) * H;
  const pts = [[0, y(0)], [a, y(1)], [a + d, y(env.s)], [a + d + hold, y(env.s)], [a + d + hold + r, y(0)]];
  const span = pts[4][0] || 1;
  return pts.map(([x, yy]) => `${((x / span) * (W - 2) + 1).toFixed(1)},${yy.toFixed(1)}`).join(' ');
}

function renderKnob(i) {
  const el = knobEls[i];
  const v = knobs[i];
  const [x0, y0] = polar(0, 22);
  const [x1, y1] = polar(v, 22);
  const large = v * 270 > 180 ? 1 : 0;
  el.querySelector('.arc').setAttribute('d', v > 0.001 ? `M ${x0} ${y0} A 22 22 0 ${large} 1 ${x1} ${y1}` : '');
  const [px, py] = polar(v, 16);
  const ptr = el.querySelector('.pointer');
  ptr.setAttribute('x2', px); ptr.setAttribute('y2', py);
  const hw = knobHw[i];
  if (hw.hw !== null && !hw.picked) {
    const [hx, hy] = polar(hw.hw, 27);
    const dot = el.querySelector('.hw');
    dot.setAttribute('cx', hx); dot.setAttribute('cy', hy);
    el.classList.add('waiting');
  } else el.classList.remove('waiting');
  el.querySelector('.value').textContent = knobInfo(i).fmt(v);
  if (i >= 6 && i < 12) el.querySelector('.shape polyline').setAttribute('points', shapePoints(envAt(v)));
  if (i === G.algo) renderHeads();
}

function renderHeads() {
  const roles = opRoles(knobs);
  roles.forEach((r, op) => {
    headEls[op].className = `head ${r.carrier ? 'carrier' : 'mod'}`;
    headEls[op].innerHTML = `<b>OP${op + 1}</b><small>${r.carrier ? 'out' : `mod > OP${r.to.join(', ')}`}</small>`;
    // Level means output volume for a carrier, modulation depth for a modulator.
    knobEls[12 + op].querySelector('.label').textContent = r.carrier ? "Level" : "Depth";
    knobEls[12 + op].classList.toggle('carrier', r.carrier);
  });
}
function renderAll() { knobEls.forEach((_, i) => renderKnob(i)); renderHeads(); }

function attachDrag(el, i) {
  let startY = 0, startV = 0;
  el.addEventListener('pointerdown', (e) => {
    startAudio();
    el.setPointerCapture(e.pointerId);
    startY = e.clientY; startV = knobs[i];
    el.classList.add('active');
  });
  el.addEventListener('pointermove', (e) => {
    if (!el.hasPointerCapture(e.pointerId)) return;
    const fine = e.shiftKey ? 0.2 : 1;
    setKnob(i, startV + ((startY - e.clientY) / 200) * fine);
  });
  const end = (e) => { el.classList.remove('active'); if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId); };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
  el.addEventListener('dblclick', () => setKnob(i, defaults[i]));
  el.addEventListener('wheel', (e) => {
    e.preventDefault();
    const steps = knobInfo(i).stepped;
    setKnob(i, knobs[i] - Math.sign(e.deltaY) * (steps ? 1 / steps : 0.02));
  }, { passive: false });
}

function setKnob(i, v) {
  knobs[i] = Math.min(1, Math.max(0, v));
  renderKnob(i);
  sendPatch();
}

// MIDI CC with soft takeover: a knob only follows the hardware once the
// hardware passes the current setting, so nothing jumps.
function hwKnob(pc4Index, v) {
  const i = pc4ToKnob(pc4Index);
  const h = knobHw[i];
  const cur = knobs[i];
  const prev = h.hw;
  h.hw = v;
  if (!h.picked) {
    const crossed = prev !== null && (prev - cur) * (v - cur) <= 0;
    if (crossed || Math.abs(v - cur) < 0.03) h.picked = true;
  }
  if (h.picked) setKnob(i, v);
  else renderKnob(i);
}

function initSound() {
  knobs = defaultKnobs();
  knobHw.forEach((h) => { h.picked = h.hw === null; });
  renderAll(); sendPatch();
  setStatus('Init sound');
}

const statusEl = document.getElementById('status');
function setStatus(t) { statusEl.textContent = t; }

// ---------- computer keyboard ----------
const KEYMAP = 'awsedftgyhujkolp;'.split('');
let octave = 4;
const held = new Map();
window.addEventListener('keydown', (e) => {
  if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
  const k = e.key.toLowerCase();
  if (k === 'z') { octave = Math.max(1, octave - 1); setStatus(`Octave ${octave}`); return; }
  if (k === 'x') { octave = Math.min(7, octave + 1); setStatus(`Octave ${octave}`); return; }
  const idx = KEYMAP.indexOf(k);
  if (idx < 0) return;
  startAudio().then(() => {
    const note = 12 * (octave + 1) + idx;
    held.set(k, note);
    noteOn(note, 0.8);
  });
});
window.addEventListener('keyup', (e) => {
  const k = e.key.toLowerCase();
  if (held.has(k)) { noteOff(held.get(k)); held.delete(k); }
});

// ---------- MIDI ----------
const midi = new Midi({
  onNoteOn: (n, v) => {
    if (!audio || audio.ctx.state !== 'running') setStatus('MIDI note received. Click the page once to turn on audio.');
    else noteOn(n, v);
  },
  onNoteOff: noteOff,
  onKnob: hwKnob,
  onStatus: setStatus,
  onLearnStep: (n) => knobEls.forEach((el, k) => el.classList.toggle('learn', n >= 0 && k === pc4ToKnob(n))),
  onProgram: () => {},
  onDiag: renderMidiBar,
});

const midiBar = document.getElementById('midibar');
const midiDot = document.getElementById('mididot');
let flashTimer = 0;
function renderMidiBar(d) {
  const ports = d.ports.map((p) => `${p.name}${p.state === 'connected' ? '' : ` (${p.state})`}`);
  let text;
  if (d.problem) text = d.problem;
  else if (!ports.length) text = 'MIDI is on but the browser sees no input ports. Plug in the PC4 and check it is not used by another app (a DAW can hold it).';
  else text = `MIDI inputs: ${ports.join(', ')}`;
  document.getElementById('midiports').textContent = text;
  midiBar.classList.toggle('problem', !!d.problem || !ports.length);
  document.getElementById('midimap').textContent = `Knobs: ${d.mapping}`;
  document.getElementById('midilast').textContent = d.count ? `Last: ${d.last} (${d.count} messages)` : (ports.length && !d.problem ? 'No messages yet: turn a knob or press a key' : '');
  midiDot.className = `dot ${d.problem || !ports.length ? 'bad' : 'ok'}`;
  if (d.flash) {
    midiDot.classList.add('flash');
    clearTimeout(flashTimer);
    flashTimer = setTimeout(() => midiDot.classList.remove('flash'), 120);
  }
}
document.getElementById('midiconnect').addEventListener('click', () => midi.start());
document.getElementById('midireset').addEventListener('click', () => midi.useDefault());
midi.start();

// ---------- buttons ----------
document.getElementById('start').addEventListener('click', () => startAudio());
window.addEventListener('pointerdown', () => startAudio(), { once: true });
window.addEventListener('keydown', () => startAudio(), { once: true });
document.getElementById('init').addEventListener('click', initSound);
document.getElementById('learn').addEventListener('click', () => {
  if (midi.learning) midi.stopLearn(); else midi.startLearn();
});
document.querySelectorAll('#modes button').forEach((btn) => btn.addEventListener('click', () => {
  voiceMode = btn.dataset.mode;
  document.querySelectorAll('#modes button').forEach((b) => b.classList.toggle('on', b === btn));
  if (audio) audio.node.port.postMessage({ type: 'mode', mode: voiceMode });
  setStatus(`Voice mode: ${btn.textContent}`);
}));

renderAll();
