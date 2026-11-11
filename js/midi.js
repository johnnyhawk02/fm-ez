// Web MIDI: notes from any input, CCs mapped to the 24 knobs.
// Mapping is learned (turn the PC4 knobs in order) and saved in the browser.
const STORE_KEY = 'fmez.ccmap.v2';

export class Midi {
  constructor({ onNoteOn, onNoteOff, onKnob, onStatus, onLearnStep }) {
    Object.assign(this, { onNoteOn, onNoteOff, onKnob, onStatus, onLearnStep });
    this.lastHint = -Infinity;
    this.map = load();
    this.learning = null; // { next: index }
  }

  async start() {
    if (!navigator.requestMIDIAccess) {
      this.onStatus('This browser has no Web MIDI (Safari). Use Chrome or Edge.');
      return;
    }
    try {
      const access = await navigator.requestMIDIAccess();
      const bind = () => {
        const names = [];
        for (const input of access.inputs.values()) {
          input.onmidimessage = (e) => this.handle(e.data);
          names.push(input.name);
        }
        this.onStatus(names.length ? `MIDI: ${names.join(', ')}` : 'MIDI: no inputs found');
      };
      access.onstatechange = bind;
      bind();
    } catch (err) {
      this.onStatus('MIDI access was blocked. Allow MIDI for this site (lock icon in the address bar) and reload.');
    }
  }

  handle([status, d1, d2]) {
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
          this.onStatus(`Learning: turn knob ${this.learning.next + 1} of 24 (row ${Math.floor(this.learning.next / 4) + 1}, knob ${(this.learning.next % 4) + 1})`);
          this.onLearnStep(this.learning.next);
          if (this.learning.next >= 24) this.stopLearn();
        }
        return;
      }
      const idx = this.map[key];
      if (idx !== undefined) this.onKnob(idx, d2 / 127);
      else if (performance.now() - this.lastHint > 2000) {
        this.lastHint = performance.now();
        this.onStatus(`CC ${d1} on channel ${ch + 1} isn't mapped yet. Click Learn PC4 and turn each knob once.`);
      }
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
    this.onStatus(`Saved ${Object.keys(this.map).length} knob mappings`);
  }
}

function load() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; } catch { return {}; }
}
function save(map) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(map)); } catch { /* storage blocked */ }
}
