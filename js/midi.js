// Web MIDI: notes from any input, CCs mapped to the 24 knobs.
// Mapping is learned (turn the PC4 knobs in order) and saved in the browser.
//
// The MIDI bar (see onDiag) shows what the browser reports: permission, the
// input ports it can see, and every message that arrives, so a failure can be
// pinned to "no permission", "no port", or "port seen but silent".
const STORE_KEY = 'fmez.ccmap.v2';

export class Midi {
  constructor({ onNoteOn, onNoteOff, onKnob, onStatus, onLearnStep, onDiag }) {
    Object.assign(this, { onNoteOn, onNoteOff, onKnob, onStatus, onLearnStep, onDiag });
    this.lastHint = -Infinity;
    // Default: the PC4 sends CC 1-24 in grid order (row by row from the top-left,
    // 4 per row) on any channel. A learned map, once saved, replaces it.
    this.map = load();
    this.custom = Object.keys(this.map).length > 0;
    this.learning = null; // { next: index }
    this.access = null;
    this.count = 0;        // messages received (clock and sensing not counted)
    this.last = '';
    this.ports = [];       // { name, state, connection }
    this.problem = '';
    this.permission = '';
  }

  diag(flash = false) {
    this.onDiag({
      problem: this.problem, permission: this.permission, ports: this.ports,
      count: this.count, last: this.last, flash,
      mapping: this.custom ? 'learned' : 'CC 1-24',
    });
  }

  async start() {
    this.problem = '';
    if (!window.isSecureContext) {
      this.problem = 'MIDI needs a secure page (https or localhost). Open the GitHub Pages address, not a file.';
      return this.diag();
    }
    if (!navigator.requestMIDIAccess) {
      this.problem = 'This browser has no Web MIDI (Safari and iOS browsers). Use Chrome, Edge or Opera on a computer.';
      return this.diag();
    }
    try {
      const q = await navigator.permissions.query({ name: 'midi' });
      this.permission = q.state;
      q.onchange = () => { this.permission = q.state; this.diag(); };
    } catch { this.permission = ''; }
    if (this.permission === 'denied') {
      this.problem = 'MIDI is blocked for this site. Click the lock icon in the address bar, set MIDI to Allow, then reload.';
      this.diag();
    } else {
      this.problem = 'Waiting for MIDI permission. If the browser asks, choose Allow.';
      this.diag();
    }
    try {
      // Keep a reference: if the MIDIAccess object is garbage collected,
      // Chrome silently stops delivering messages from every port.
      this.access = await navigator.requestMIDIAccess();
      window.fmezMidiAccess = this.access;
      this.problem = '';
      this.access.onstatechange = () => this.scan();
      this.scan();
    } catch (err) {
      this.problem = err && err.name === 'SecurityError'
        ? 'MIDI is blocked for this site. Click the lock icon in the address bar, set MIDI to Allow, then reload.'
        : `MIDI could not start (${err && err.name ? err.name : 'error'}). Press Connect MIDI to try again.`;
      this.diag();
    }
  }

  scan() {
    this.ports = [];
    for (const input of this.access.inputs.values()) {
      this.ports.push({ name: input.name || input.id, state: input.state, connection: input.connection });
      input.onmidimessage = (e) => this.handle(e.data);
      // Setting onmidimessage opens the port; open() makes failures visible.
      if (input.connection !== 'open' && input.open) input.open().catch(() => {});
    }
    this.diag();
  }

  handle(data) {
    const [status, d1, d2] = data;
    // Clock, active sensing: ignore, they would drown real messages.
    if (status === 0xf8 || status === 0xfe) return;
    this.count++;
    this.last = describe(data);
    this.diag(true);
    const type = status & 0xf0, ch = status & 0x0f;
    if (type === 0x90 && d2 > 0) this.onNoteOn(d1, d2 / 127);
    else if (type === 0x80 || (type === 0x90 && d2 === 0)) this.onNoteOff(d1);
    else if (type === 0xb0) {
      const key = `${ch}:${d1}`;
      if (this.learning) {
        if (!this.learning.seen.has(key)) {
          this.learning.seen.add(key);
          this.map[key] = this.learning.next;
          this.learning.next++;
          if (this.learning.next >= 24) { this.stopLearn(); return; }
          this.onStatus(`Learning: turn knob ${this.learning.next + 1} of 24 (row ${Math.floor(this.learning.next / 4) + 1}, knob ${(this.learning.next % 4) + 1})`);
          this.onLearnStep(this.learning.next);
        }
        return;
      }
      const idx = this.custom ? this.map[key] : (d1 >= 1 && d1 <= 24 ? d1 - 1 : undefined);
      if (idx !== undefined) this.onKnob(idx, d2 / 127);
      else if (performance.now() - this.lastHint > 2000) {
        this.lastHint = performance.now();
        this.onStatus(this.custom
          ? `CC ${d1} on channel ${ch + 1} isn't in your learned map. Click Learn PC4 again, or Use CC 1-24.`
          : `CC ${d1} is outside 1-24, so no knob uses it. Set the PC4 knobs to CC 1-24, or click Learn PC4.`);
      }
    } else if (this.learning && type !== 0xb0) {
      this.onStatus(`Learning needs knob (CC) messages, but got ${this.last}. Check the PC4 is set to send CC.`);
    }
  }

  startLearn() {
    this.map = {};
    this.learning = { next: 0, seen: new Set() };
    this.onStatus('Learning: turn the highlighted knob (row 1, knob 1), then each knob along the row, row by row');
    this.onLearnStep(0);
  }

  stopLearn() {
    this.learning = null;
    this.onLearnStep(-1);
    save(this.map);
    this.custom = true;
    this.onStatus(`Saved ${Object.keys(this.map).length} knob mappings`);
    this.diag();
  }

  useDefault() {
    this.learning = null;
    this.onLearnStep(-1);
    this.map = {};
    this.custom = false;
    try { localStorage.removeItem(STORE_KEY); } catch { /* storage blocked */ }
    this.onStatus('Knobs use CC 1-24 in grid order');
    this.diag();
  }
}

const NOTE = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
function describe(d) {
  const [s, a = 0, b = 0] = d;
  const hex = [...d].slice(0, 6).map((x) => x.toString(16).toUpperCase().padStart(2, '0')).join(' ');
  const t = s & 0xf0, ch = (s & 0x0f) + 1;
  if (s === 0xf0) return `SysEx (${d.length} bytes)`;
  if (t === 0xb0) return `CC ${a} = ${b} on ch ${ch}`;
  if (t === 0x90 && b > 0) return `Note on ${NOTE[a % 12]}${Math.floor(a / 12) - 1} vel ${b} on ch ${ch}`;
  if (t === 0x80 || t === 0x90) return `Note off ${NOTE[a % 12]}${Math.floor(a / 12) - 1} on ch ${ch}`;
  if (t === 0xe0) return `Pitch bend on ch ${ch}`;
  if (t === 0xc0) return `Program ${a} on ch ${ch}`;
  return hex;
}

function load() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; } catch { return {}; }
}
function save(map) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(map)); } catch { /* storage blocked */ }
}
