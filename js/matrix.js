// "What does this knob do?" matrix. Works for every knob and engine by
// building the patch with the knob at minimum, current and maximum, and
// showing every operator and global parameter that moves.
import { KNOBS, buildPatch, ROUTABLE, routing } from './macros.js';
import { isCarrier } from './engines.js';

const ms = (s) => (s < 1 ? `${Math.round(s * 1000)}ms` : `${s.toFixed(1)}s`);
const OP_PARAMS = [
  { key: 'ratio', label: 'Ratio', get: (o) => (o.fixed ? o.fixed : o.ratio), fmt: (v, o) => (o.fixed ? `${Math.round(v)}Hz` : v.toFixed(2)) },
  { key: 'level', label: 'Level', get: (o) => o.level, fmt: (v) => `${Math.round(v * 100)}%` },
  { key: 'index', label: 'Mod depth', get: (o) => o.level * o.index, fmt: (v) => `${v.toFixed(2)} rad`, modOnly: true },
  { key: 'a', label: 'Attack', get: (o) => o.env.a, fmt: ms },
  { key: 'd', label: 'Decay', get: (o) => o.env.d, fmt: ms },
  { key: 's', label: 'Sustain', get: (o) => o.env.s, fmt: (v) => `${Math.round(v * 100)}%` },
  { key: 'r', label: 'Release', get: (o) => o.env.r, fmt: ms },
];
const GLOBALS = [
  { label: 'Algorithm', get: (p) => p.algoNum, fmt: (v) => `DX7 ${v}` },
  { label: 'Sound', get: (p) => p.engine, fmt: (v) => v },
  { label: 'Feedback', get: (p) => p.feedback, fmt: (v) => `${Math.round(v * 100)}%` },
  { label: 'Transpose', get: (p) => p.transpose, fmt: (v) => `${v > 0 ? '+' : ''}${v} st` },
  { label: 'Carrier pan width', get: (p) => p.stereo.width, fmt: (v) => `${Math.round(v * 80)}%` },
  { label: 'Carrier L/R detune', get: (p) => p.stereo.detune, fmt: (v) => `±${v.toFixed(1)} cents` },
  { label: 'Modulator pan spread', get: (p) => p.stereo.spread, fmt: (v) => `${Math.round(v * 60)}% depth L/R` },
  { label: 'LFO rate', get: (p) => p.lfo.rate, fmt: (v) => `${v.toFixed(2)} Hz` },
  { label: 'LFO to mod depth', get: (p) => p.lfo.depth, fmt: (v) => `${Math.round(v * 100)}%` },
  { label: 'LFO to pitch', get: (p) => p.lfo.pitch, fmt: (v) => `${v.toFixed(2)} st` },
  { label: 'Pitch env', get: (p) => p.pitchEnv.amount, fmt: (v) => `${v.toFixed(1)} st` },
  { label: 'Low-pass', get: (p) => p.tone.cutoff, fmt: (v) => `${Math.round(v)} Hz` },
  { label: 'Drive', get: (p) => p.tone.drive, fmt: (v) => `${Math.round(v * 100)}%` },
  { label: 'Velocity to mod depth', get: (p) => p.velBright, fmt: (v) => `${Math.round(v * 100)}%` },
  { label: 'Output', get: (p) => p.volume, fmt: (v) => `${Math.round((v / 1.5) * 100)}%` },
];

const PERFORM_HELP = {
  method: 'Picks what Go does: Generate (new sound, or another DX7 voice in Library), Mutate (nudge the current sound), Harmonic (new ratios), Breed (mix stored A and B), Row (re-roll one row).',
  amount: 'How far Go moves the sound. Low = small variations, high = wild.',
  go: 'Turn past halfway to fire the chosen Method. Turn back down to re-arm.',
  morph: 'Blends between the sounds stored in A and B (all sound knobs, or the DX7 voices themselves in Library mode).',
  lock: 'Protects rows from Go: Tone = rows 1-2, Shape = Envelope and Motion rows, Space = Width and Mod spread.',
};

const differs = (a, b) => (typeof a === 'number' ? Math.abs(a - b) > 1e-6 * Math.max(1, Math.abs(a)) : a !== b);

export function knobMatrixHTML(i, state) {
  const knob = KNOBS[i];
  const head = `<h2>${knob.label} <span>${knob.fmt(state.macros[i], state.macros)}</span></h2>`;
  if (knob.perform) {
    const help = PERFORM_HELP[knob.id] || 'Master output level after the drive stage.';
    return `${head}<p class="help">${help}</p>`;
  }
  const at = (v) => {
    const m = state.macros.slice(); m[i] = v;
    return buildPatch(m, state.voicing, state.base);
  };
  const lo = at(0), hi = at(1), cur = at(state.macros[i]);
  // Sample a few points too, so stepped knobs (engine, algorithm) are caught.
  const samples = [0, 0.2, 0.4, 0.6, 0.8, 1].map(at);
  const moves = (get) => samples.some((p) => differs(get(p), get(cur)));

  const cols = OP_PARAMS.filter((c) => [0, 1, 2, 3, 4, 5].some((k) => moves((p) => c.get(p.ops[k]))));
  const editable = ROUTABLE.includes(knob.id);
  let html = head;
  if (cols.length || editable) {
    html += '<table><thead><tr><th>Op</th>' + (editable ? '<th>Depth</th>' : '') + cols.map((c) => `<th>${c.label}</th>`).join('') + '</tr></thead><tbody>';
    for (let k = 0; k < 6; k++) {
      const carrier = isCarrier(cur.algorithm, k);
      html += `<tr><th>OP${k + 1} <small>${carrier ? 'carrier' : 'mod'}</small></th>`;
      if (editable) {
        const w = routing[knob.id] ? routing[knob.id][k] : 1;
        html += `<td class="depth"><input type="range" min="-100" max="200" step="5" value="${Math.round(w * 100)}" data-op="${k}" aria-label="OP${k + 1} depth"><output>${Math.round(w * 100)}%</output></td>`;
      }
      for (const c of cols) {
        const get = (p) => c.get(p.ops[k]);
        const live = moves(get) && !(c.modOnly && carrier);
        if (!live) { html += '<td class="off">·</td>'; continue; }
        const o = cur.ops[k];
        html += `<td><b>${c.fmt(get(cur), o)}</b><small>${c.fmt(get(lo), lo.ops[k])} to ${c.fmt(get(hi), hi.ops[k])}</small></td>`;
      }
      html += '</tr>';
    }
    html += '</tbody></table>';
  }
  const globals = GLOBALS.filter((g) => moves(g.get));
  if (globals.length) {
    html += '<ul class="globals">' + globals.map((g) =>
      `<li><span>${g.label}</span><b>${g.fmt(g.get(cur))}</b><small>${g.fmt(g.get(lo))} to ${g.fmt(g.get(hi))}</small></li>`).join('') + '</ul>';
  }
  if (!cols.length && !globals.length) html += '<p class="help">This knob does nothing with the current sound.</p>';
  if (editable) html += '<p class="hint">Depth sets how far this knob moves each operator: 100% normal, 0% ignores it, minus goes the other way. Saved in this browser for every sound. <button class="reset-routing">Reset to 100%</button></p>';
  html += '<p class="hint">Min to max shown under each value. Tap outside or press Esc to close.</p>';
  return html;
}
