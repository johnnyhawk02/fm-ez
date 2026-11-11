import { KNOBS, ROWS, K, defaultMacros, makeVoicing, buildPatch, engineOf, methodOf, library, voiceIndex, neutralise } from './macros.js';
import { ENGINES } from './engines.js';
import { parseSysex } from './dx7.js';
import { isCarrier } from './engines.js';
import { randomise, morph, rng } from './random.js';
import { Midi } from './midi.js';

// ---------- state ----------
const state = {
  macros: defaultMacros(),
  voicing: makeVoicing(rng(1)),
  seed: 1,
  base: null, // DX7 voice in Library mode
};
const knobHw = KNOBS.map(() => ({ hw: null, picked: true })); // soft takeover per knob
const slots = { A: null, B: null };
const history = [];
let future = [];
let audio = null;
let lastGo = 0;

// ---------- audio ----------
async function startAudio() {
  if (audio) { if (audio.ctx.state !== 'running') audio.ctx.resume(); return; }
  const ctx = new AudioContext({ latencyHint: 'interactive' });
  await ctx.audioWorklet.addModule('js/fm-processor.js');
  const node = new AudioWorkletNode(ctx, 'fm-processor', { numberOfInputs: 0, outputChannelCount: [2] });
  node.connect(ctx.destination);
  audio = { ctx, node };
  sendPatch();
  setStatus('Audio on. Play with A W S E D F T G Y H U J K, Z/X for octave.');
  document.body.classList.add('running');
}

let pending = false;
function sendPatch() {
  if (pending) return;
  pending = true;
  requestAnimationFrame(() => {
    pending = false;
    const patch = buildPatch(state.macros, state.voicing, state.base);
    if (audio) audio.node.port.postMessage({ type: 'patch', patch });
    renderInfo(patch);
  });
}

const noteOn = (note, vel) => audio && audio.node.port.postMessage({ type: 'noteOn', note, velocity: vel });
const noteOff = (note) => audio && audio.node.port.postMessage({ type: 'noteOff', note });

// ---------- knobs ----------
const grid = document.getElementById('grid');
const knobEls = KNOBS.map((k, i) => {
  const el = document.createElement('div');
  el.className = 'knob';
  el.dataset.row = ROWS[Math.floor(i / 6)].toLowerCase();
  el.innerHTML = `
    <svg viewBox="0 0 60 60" aria-hidden="true">
      <circle class="track" cx="30" cy="30" r="22" />
      <path class="arc" d="" />
      <line class="pointer" x1="30" y1="30" x2="30" y2="10" />
      <circle class="hw" r="3" cx="30" cy="8" />
    </svg>
    <div class="label">${k.label}</div>
    <div class="value"></div>`;
  el.tabIndex = 0;
  grid.appendChild(el);
  attachDrag(el, i);
  return el;
});

function polar(v, r) {
  const ang = (-135 + v * 270) * (Math.PI / 180);
  return [30 + r * Math.sin(ang), 30 - r * Math.cos(ang)];
}

function renderKnob(i) {
  const el = knobEls[i];
  const v = state.macros[i];
  const [x0, y0] = polar(0, 22);
  const [x1, y1] = polar(v, 22);
  const large = v * 270 > 180 ? 1 : 0;
  el.querySelector('.arc').setAttribute('d', v > 0.001 ? `M ${x0} ${y0} A 22 22 0 ${large} 1 ${x1} ${y1}` : '');
  const [px, py] = polar(v, 16);
  const ptr = el.querySelector('.pointer');
  ptr.setAttribute('x2', px); ptr.setAttribute('y2', py);
  const hw = knobHw[i];
  const dot = el.querySelector('.hw');
  if (hw.hw !== null && !hw.picked) {
    const [hx, hy] = polar(hw.hw, 27);
    dot.setAttribute('cx', hx); dot.setAttribute('cy', hy);
    el.classList.add('waiting');
  } else {
    el.classList.remove('waiting');
  }
  el.querySelector('.value').textContent = KNOBS[i].fmt(v, state.macros);
}
const renderAll = () => KNOBS.forEach((_, i) => renderKnob(i));

function attachDrag(el, i) {
  let startY = 0, startV = 0;
  el.addEventListener('pointerdown', (e) => {
    startAudio();
    el.setPointerCapture(e.pointerId);
    startY = e.clientY; startV = state.macros[i];
    el.classList.add('active');
  });
  el.addEventListener('pointermove', (e) => {
    if (!el.hasPointerCapture(e.pointerId)) return;
    const fine = e.shiftKey ? 0.2 : 1;
    setKnob(i, startV + ((startY - e.clientY) / 200) * fine, 'ui');
  });
  const end = (e) => { el.classList.remove('active'); if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId); };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
  el.addEventListener('dblclick', () => setKnob(i, KNOBS[i].def, 'ui'));
  el.addEventListener('wheel', (e) => { e.preventDefault(); setKnob(i, state.macros[i] - Math.sign(e.deltaY) * 0.02, 'ui'); }, { passive: false });
}

function setKnob(i, v, source) {
  v = Math.min(1, Math.max(0, v));
  const prev = state.macros[i];
  const wasLib = engineOf(state.macros).library;
  const prevVoice = voiceIndex(state.macros);
  state.macros[i] = v;
  const isLib = engineOf(state.macros).library;
  if (i === K.engine && isLib !== wasLib) {
    if (isLib) { neutralise(state.macros); selectVoice(); } else state.base = null;
  } else if (i === K.algo && isLib && voiceIndex(state.macros) !== prevVoice) {
    selectVoice();
  }
  if (i === K.go) {
    if (prev < 0.5 && v >= 0.5) fire();
  } else if (i === K.morph) {
    const r = morph(state, slots, v);
    if (r) applySound(r, false);
  }
  // Labels like "DX 5" or ms values depend on the engine.
  if (i === K.engine || i === K.algo) renderAll(); else renderKnob(i);
  sendPatch();
}

// MIDI CC with soft takeover: a knob only grabs the value once the hardware
// passes the current setting, so randomising never causes jumps.
function hwKnob(i, v) {
  const h = knobHw[i];
  const cur = state.macros[i];
  const prev = h.hw;
  h.hw = v;
  if (KNOBS[i].perform) h.picked = true;
  if (!h.picked) {
    const crossed = prev !== null && (prev - cur) * (v - cur) <= 0;
    if (crossed || Math.abs(v - cur) < 0.03) h.picked = true;
  }
  if (h.picked) setKnob(i, v, 'hw');
  else renderKnob(i);
}

function unpickChanged(oldM, newM) {
  newM.forEach((v, i) => { if (Math.abs(v - oldM[i]) > 1e-6 && !KNOBS[i].perform) knobHw[i].picked = false; });
}

// ---------- sounds, history ----------
function snapshot() {
  return { macros: state.macros.slice(), voicing: structuredClone(state.voicing), seed: state.seed, base: state.base && structuredClone(state.base) };
}

function selectVoice() {
  const idx = voiceIndex(state.macros);
  state.base = idx >= 0 ? structuredClone(library.voices[idx]) : null;
}

function applySound(s, record = true) {
  if (record) { history.push(snapshot()); if (history.length > 32) history.shift(); future = []; }
  const old = state.macros.slice();
  // Keep the Random row as the performer has it.
  for (let i = 0; i < 18; i++) state.macros[i] = s.macros[i];
  state.voicing = structuredClone(s.voicing);
  state.base = s.base ? structuredClone(s.base) : null;
  if (s.seed !== undefined) state.seed = s.seed;
  unpickChanged(old, state.macros);
  renderAll();
  sendPatch();
  updateButtons();
}

function fire() {
  const seed = (Math.random() * 2 ** 32) >>> 0;
  const r = randomise(state, slots, seed);
  applySound({ ...r, seed });
  setStatus(`${r.method} · seed ${seed.toString(16)}`);
}

function undo() {
  if (!history.length) return;
  future.push(snapshot());
  applySound(history.pop(), false);
}
function redo() {
  if (!future.length) return;
  history.push(snapshot());
  applySound(future.pop(), false);
}

function store(slot) {
  slots[slot] = snapshot();
  updateButtons();
  setStatus(`Stored ${slot}${slots.A && slots.B ? ' · Morph and Breed now use A and B' : ''}`);
}

function updateButtons() {
  document.getElementById('undo').disabled = !history.length;
  document.getElementById('redo').disabled = !future.length;
  document.getElementById('storeA').classList.toggle('filled', !!slots.A);
  document.getElementById('storeB').classList.toggle('filled', !!slots.B);
}

// ---------- info ----------
function renderInfo(p) {
  const carriers = [0, 1, 2, 3, 4, 5].filter((i) => isCarrier(p.algorithm, i)).map((i) => i + 1);
  const ratios = p.ops.map((o, i) => `${carriers.includes(i + 1) ? '<b>' : ''}${o.ratio.toFixed(2)}${carriers.includes(i + 1) ? '</b>' : ''}`).join(' · ');
  document.getElementById('info').innerHTML =
    `<span>${p.engine}</span><span>DX7 algorithm ${p.algoNum}</span>` +
    `<span>carriers OP${carriers.join(', OP')}</span><span>ratios OP1-6: ${ratios}</span>` +
    `<span>method: ${methodOf(state.macros)}</span>` +
    (library.voices.length ? `<span>library: ${library.voices.length} DX7 voices</span>` : '');
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

// ---------- buttons, midi ----------
const midi = new Midi({
  onNoteOn: (n, v) => { startAudio(); noteOn(n, v); },
  onNoteOff: noteOff,
  onKnob: hwKnob,
  onStatus: setStatus,
});

document.getElementById('start').addEventListener('click', () => startAudio().then(() => midi.start()));
document.getElementById('go').addEventListener('click', () => { startAudio(); fire(); });
document.getElementById('undo').addEventListener('click', undo);
document.getElementById('redo').addEventListener('click', redo);
document.getElementById('storeA').addEventListener('click', () => store('A'));
document.getElementById('storeB').addEventListener('click', () => store('B'));
document.getElementById('learn').addEventListener('click', () => {
  if (midi.learning) midi.stopLearn(); else midi.startLearn();
});

// ---------- DX7 banks ----------
const LIB_KEY = 'fmez.library.v1';
async function loadFiles(files) {
  let added = 0;
  for (const f of files) {
    const voices = parseSysex(new Uint8Array(await f.arrayBuffer()));
    library.voices.push(...voices);
    added += voices.length;
  }
  if (!added) { setStatus('No DX7 voices found in that file'); return; }
  library.voices = library.voices.slice(-1024);
  try { localStorage.setItem(LIB_KEY, JSON.stringify(library.voices)); } catch { /* too big or blocked */ }
  const first = library.voices.length - added;
  const libIdx = ENGINES.findIndex((e) => e.library);
  history.push(snapshot()); future = [];
  const old = state.macros.slice();
  state.macros[K.engine] = (libIdx + 0.5) / ENGINES.length;
  state.macros[K.algo] = (first + 0.5) / library.voices.length;
  neutralise(state.macros);
  selectVoice();
  unpickChanged(old, state.macros);
  renderAll(); sendPatch(); updateButtons();
  setStatus(`Loaded ${added} DX7 voices. Algorithm knob picks the voice; Go mutates it.`);
}
try { library.voices = JSON.parse(localStorage.getItem(LIB_KEY)) || []; } catch { /* none saved */ }

const fileInput = document.getElementById('file');
document.getElementById('load').addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', () => { loadFiles([...fileInput.files]); fileInput.value = ''; });
window.addEventListener('dragover', (e) => { e.preventDefault(); document.body.classList.add('drop'); });
window.addEventListener('dragleave', () => document.body.classList.remove('drop'));
window.addEventListener('drop', (e) => { e.preventDefault(); document.body.classList.remove('drop'); loadFiles([...e.dataTransfer.files]); });

renderAll();
updateButtons();
sendPatch();
