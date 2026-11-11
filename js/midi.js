// Web MIDI: notes from any input, CCs mapped to the 24 knobs.
// Mapping is learned (turn the PC4 knobs in order) and saved in the browser.
const STORE_KEY = 'fmez.ccmap.v2';

export class Midi {
  constructor({ onNoteOn, onNoteOff, onKnob, onStatus }) {
    Object.assign(this, { onNoteOn, onNoteOff, onKnob, onStatus });
    this.map = load();
    this.learning = null; // { next: index }
  }

  async start() {
    if (!navigator.requestMIDIAccess) {
      this.onStatus('No Web MIDI in this browser (use Chrome or Edge)');
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
      this.onStatus('MIDI access was refused');
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
          this.onStatus(`Learning: turn knob ${this.learning.next + 1} of 24`);
          if (this.learning.next >= 24) this.stopLearn();
        }
        return;
      }
      const idx = this.map[key];
      if (idx !== undefined) this.onKnob(idx, d2 / 127);
    }
  }

  startLearn() {
    this.map = {};
    this.learning = { next: 0, seen: new Set() };
    this.onStatus('Learning: turn knob 1 of 24 (top-left), then along each row of 4, row by row');
  }

  stopLearn() {
    this.learning = null;
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
