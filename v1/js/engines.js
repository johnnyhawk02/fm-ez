// Engines. Each engine is data: its sound presets (algorithm + ratios),
// default envelopes, and its own 20 macro knobs (rows 1-5 of the PC4 grid,
// 4 per row). Row 6 (Random) is shared by every engine.
//
// A knob is a macro type from macros.js (TYPES) plus optional overrides:
//   label, def (0..1 knob position), range ([min, max] in the type's units),
//   list (stepped choices), step (snap, e.g. 12 = octaves).
// Algorithms are DX7 numbers (1-32). Ratios are OP1..OP6.

export const ENGINES = [
  {
    name: 'Percussion',
    rows: ['Hit', 'Tone', 'Envelope', 'Feel', 'Space'],
    presets: [
      { name: 'Kick', algo: 16, ratios: [1, 1.5, 0.5, 2.3, 1, 3.1] },
      { name: 'Tom', algo: 5, ratios: [1, 1.5, 1.5, 2.3, 1, 3.1] },
      { name: 'Snare', algo: 5, ratios: [1, 2.76, 1, 5.4, 1.41, 7.2] },
      { name: 'Clap', algo: 1, ratios: [1, 9.3, 1, 14.9, 1, 3.1] },
      { name: 'Hat', algo: 1, ratios: [1, 0.5, 1, 9.3, 1.5, 14.9] },
      { name: 'Metal', algo: 29, ratios: [1, 3.5, 7.13, 11.2, 4.4, 13.7] },
      { name: 'Wood', algo: 31, ratios: [1, 1.41, 2.2, 3.3, 1, 0.71] },
      { name: 'Zap', algo: 1, ratios: [1, 1, 1, 1, 1, 2] },
    ],
    env: { a: 0.001, d: 0.3, s: 0, r: 0.1 },
    modEnv: { a: 0.0005, d: 0.05, s: 0, r: 0.05 },
    inharmCarriers: true,
    knobs: [
      { type: 'sound' },
      { type: 'tune', range: [-24, 24] },
      { type: 'pitchDrop', range: [0, 48], def: 0.5 },
      { type: 'dropTime', range: [0.005, 0.3], def: 0.35 },

      { type: 'bright', range: [0, 7], def: 0.35 },
      { type: 'feedback', label: 'Noise', def: 0.1 },
      { type: 'inharm', label: 'Metal' },
      { type: 'modRatio', label: 'Overtone', list: [0.5, 1, 1.5, 2, 3, 4] },

      { type: 'attack', label: 'Snap', range: [0.0005, 0.03], def: 0 },
      { type: 'decay', range: [0.03, 2], def: 0.4 },
      { type: 'sustain', label: 'Ring', range: [0, 0.4], def: 0 },
      { type: 'release', label: 'Choke', range: [0.01, 1], def: 0.3 },

      { type: 'modDecay', range: [0.003, 0.6], def: 0.3 },
      { type: 'velAmp', label: 'Accent', def: 0.7 },
      { type: 'velBright' },
      { type: 'detune', range: [0, 40], def: 0.1 },

      { type: 'width', def: 0.2 },
      { type: 'spread', def: 0.2 },
      { type: 'drive' },
      { type: 'cutoff' },
    ],
  },
  {
    name: 'Bass',
    rows: ['Tone', 'Colour', 'Envelope', 'Play', 'Space'],
    presets: [
      { name: 'Pluck', algo: 1, ratios: [1, 1, 1, 1, 1, 1] },
      { name: 'Sub', algo: 5, ratios: [0.5, 1, 0.5, 2, 1, 1] },
      { name: 'Growl', algo: 3, ratios: [1, 2, 1, 1, 1, 3] },
      { name: 'Slap', algo: 13, ratios: [0.5, 1, 1, 0.5, 2, 1] },
      { name: 'Reese', algo: 16, ratios: [1, 3, 1, 2, 1, 5] },
      { name: 'Wood', algo: 7, ratios: [1, 1, 1, 2, 1, 3] },
    ],
    env: { a: 0.001, d: 0.4, s: 0.5, r: 0.1 },
    modEnv: { a: 0.001, d: 0.2, s: 0.25, r: 0.1 },
    knobs: [
      { type: 'sound' },
      { type: 'tune', label: 'Octave', range: [-24, 12], step: 12, def: 2 / 3 },
      { type: 'bright', range: [0, 5], def: 0.45 },
      { type: 'feedback', range: [0, 0.8], def: 0.2 },

      { type: 'modRatio', label: 'Overtone', list: [0.5, 1, 2, 3] },
      { type: 'mix', label: 'Sub mix' },
      { type: 'inharm', label: 'Grit' },
      { type: 'detune', range: [0, 15], def: 0.15 },

      { type: 'attack', range: [0.001, 0.08], def: 0 },
      { type: 'decay', range: [0.05, 2], def: 0.4 },
      { type: 'sustain', range: [0, 1], def: 0.5 },
      { type: 'release', range: [0.02, 1], def: 0.3 },

      { type: 'modDecay', label: 'Pluck', range: [0.02, 1.5], def: 0.35 },
      { type: 'velBright' },
      { type: 'glide', range: [0.005, 0.5], def: 0.3 },
      { type: 'vibrato', range: [0, 0.4] },

      { type: 'width', def: 0.15 },
      { type: 'spread', def: 0.2 },
      { type: 'drive' },
      { type: 'cutoff' },
    ],
  },
  {
    name: 'Keys',
    rows: ['Tone', 'Colour', 'Envelope', 'Motion', 'Space'],
    presets: [
      { name: 'E.Piano', algo: 5, ratios: [1, 1, 1, 14, 1, 1] },
      { name: 'Bark EP', algo: 5, ratios: [0.5, 1, 1, 14, 1, 1] },
      { name: 'Clav', algo: 6, ratios: [1, 1, 1, 1, 0.5, 2] },
      { name: 'Harpsi', algo: 3, ratios: [1, 2, 1, 3, 1, 7] },
      { name: 'Mallet', algo: 11, ratios: [1, 1, 2, 1, 1, 3] },
      { name: 'Organ', algo: 32, ratios: [0.5, 1, 2, 3, 4, 6] },
    ],
    env: { a: 0.001, d: 1.5, s: 0.3, r: 0.3 },
    modEnv: { a: 0.001, d: 0.4, s: 0.2, r: 0.3 },
    lfoRate: 4,
    knobs: [
      { type: 'sound' },
      { type: 'bright', range: [0, 4], def: 0.45 },
      { type: 'mix', label: 'Tine / body' },
      { type: 'modRatio', label: 'Bark', list: [1, 2, 3, 7] },

      { type: 'feedback', range: [0, 0.6] },
      { type: 'inharm' },
      { type: 'detune', label: 'Chorus', range: [0, 20], def: 0.25 },
      { type: 'velBright', def: 0.6 },

      { type: 'attack', range: [0.001, 0.05], def: 0 },
      { type: 'decay', range: [0.3, 6], def: 0.5 },
      { type: 'sustain', range: [0, 0.6], def: 0.3 },
      { type: 'release', range: [0.1, 1.5], def: 0.3 },

      { type: 'modDecay', range: [0.05, 3], def: 0.4 },
      { type: 'velAmp', def: 0.6 },
      { type: 'lfoRate', def: 0.5 },
      { type: 'lfoDepth', label: 'Wobble' },

      { type: 'width', def: 0.4 },
      { type: 'spread', def: 0.3 },
      { type: 'drive' },
      { type: 'cutoff' },
    ],
  },
  {
    name: 'Bells',
    rows: ['Tone', 'Colour', 'Envelope', 'Motion', 'Space'],
    presets: [
      { name: 'Tubular', algo: 5, ratios: [1, 3.5, 1, 3.5, 1, 1.41] },
      { name: 'Glass', algo: 16, ratios: [1, 1.41, 2, 4.24, 1, 7] },
      { name: 'Gong', algo: 22, ratios: [1, 7.07, 1, 2.71, 0.5, 3.14] },
      { name: 'Chime', algo: 29, ratios: [1, 5, 1.5, 9.5, 2, 1.5] },
      { name: 'Celesta', algo: 1, ratios: [1, 2.4, 1, 6.3, 1, 11.1] },
    ],
    env: { a: 0.001, d: 3, s: 0, r: 1 },
    modEnv: { a: 0.001, d: 0.5, s: 0.1, r: 1 },
    inharmCarriers: true,
    lfoRate: 3,
    knobs: [
      { type: 'sound' },
      { type: 'bright', range: [0, 4.5], def: 0.4 },
      { type: 'inharm', def: 0.2 },
      { type: 'modRatio', label: 'Spectrum', list: [0.5, 1, 1.41, 2, 3.5] },

      { type: 'feedback', range: [0, 0.5] },
      { type: 'mix' },
      { type: 'detune', label: 'Beat', range: [0, 30], def: 0.2 },
      { type: 'pitchDrop', label: 'Strike bend', range: [0, 12], def: 0 },

      { type: 'attack', range: [0.001, 0.05], def: 0 },
      { type: 'decay', range: [0.5, 10], def: 0.5 },
      { type: 'sustain', range: [0, 0.3], def: 0 },
      { type: 'release', range: [0.2, 6], def: 0.5 },

      { type: 'modDecay', range: [0.02, 3], def: 0.3 },
      { type: 'velBright', def: 0.6 },
      { type: 'lfoRate', def: 0.4 },
      { type: 'lfoDepth' },

      { type: 'width', def: 0.5 },
      { type: 'spread', def: 0.4 },
      { type: 'drive' },
      { type: 'cutoff' },
    ],
  },
  {
    name: 'Pads',
    rows: ['Tone', 'Colour', 'Envelope', 'Motion', 'Space'],
    presets: [
      { name: 'Warm', algo: 22, ratios: [1, 1, 1, 1, 1, 1] },
      { name: 'Glass', algo: 24, ratios: [1, 2, 1, 3, 2, 1] },
      { name: 'Choir', algo: 25, ratios: [0.5, 1, 2, 1, 1.5, 4] },
      { name: 'Strings', algo: 31, ratios: [1, 1, 1, 2, 3, 0.5] },
      { name: 'Organ', algo: 19, ratios: [1, 1.5, 2, 1, 3, 1] },
      { name: 'Vox', algo: 5, ratios: [1, 1, 2, 1, 3, 1] },
    ],
    env: { a: 0.5, d: 2, s: 0.7, r: 1.5 },
    modEnv: { a: 0.5, d: 2, s: 0.5, r: 1.5 },
    lfoRate: 0.5,
    knobs: [
      { type: 'sound' },
      { type: 'bright', range: [0, 3], def: 0.4 },
      { type: 'modRatio', label: 'Overtone', list: [0.5, 1, 2, 3] },
      { type: 'detune', range: [0, 25], def: 0.4 },

      { type: 'feedback', range: [0, 0.7] },
      { type: 'mix' },
      { type: 'inharm' },
      { type: 'vibrato', range: [0, 0.3] },

      { type: 'attack', range: [0.05, 4], def: 0.4 },
      { type: 'decay', range: [0.5, 6], def: 0.5 },
      { type: 'sustain', range: [0.3, 1], def: 0.6 },
      { type: 'release', range: [0.3, 6], def: 0.5 },

      { type: 'modAttack', label: 'Swell', range: [0.01, 6], def: 0.4 },
      { type: 'modDecay', label: 'Evolve', range: [0.5, 8], def: 0.5 },
      { type: 'lfoRate', def: 0.3 },
      { type: 'lfoDepth', def: 0.2 },

      { type: 'width', def: 0.7 },
      { type: 'spread', def: 0.5 },
      { type: 'drive' },
      { type: 'cutoff', def: 0.85 },
    ],
  },
  {
    name: 'Lead',
    rows: ['Tone', 'Colour', 'Envelope', 'Play', 'Space'],
    presets: [
      { name: 'Saw', algo: 1, ratios: [1, 1, 1, 1, 1, 1] },
      { name: 'Square', algo: 16, ratios: [1, 2, 1, 1, 3, 1] },
      { name: 'Brass', algo: 3, ratios: [1, 1, 2, 1, 1, 4] },
      { name: 'Sync', algo: 4, ratios: [2, 1, 1, 3, 1, 2] },
      { name: 'Whistle', algo: 7, ratios: [1, 3, 1, 1, 2, 5] },
    ],
    env: { a: 0.005, d: 0.5, s: 0.7, r: 0.2 },
    modEnv: { a: 0.005, d: 0.8, s: 0.6, r: 0.2 },
    lfoRate: 5.5,
    knobs: [
      { type: 'sound' },
      { type: 'bright', range: [0, 5], def: 0.5 },
      { type: 'feedback', range: [0, 1], def: 0.3 },
      { type: 'modRatio', label: 'Overtone', list: [0.5, 1, 2, 3, 4] },

      { type: 'mix' },
      { type: 'inharm' },
      { type: 'detune', range: [0, 20], def: 0.2 },
      { type: 'pitchDrop', label: 'Blip', range: [0, 12], def: 0 },

      { type: 'attack', range: [0.001, 0.3], def: 0.05 },
      { type: 'decay', range: [0.1, 3], def: 0.4 },
      { type: 'sustain', range: [0.3, 1], def: 0.6 },
      { type: 'release', range: [0.05, 1.5], def: 0.3 },

      { type: 'modDecay', range: [0.1, 4], def: 0.4 },
      { type: 'velBright' },
      { type: 'glide', range: [0.005, 0.6], def: 0.3 },
      { type: 'vibrato', range: [0, 0.6], def: 0.15 },

      { type: 'width', def: 0.3 },
      { type: 'spread', def: 0.3 },
      { type: 'drive' },
      { type: 'cutoff' },
    ],
  },
  {
    // Loaded DX7 / Dexed voices. Knob 1 picks the voice; the knobs marked
    // "x" are offsets around the voice as loaded (middle = original).
    name: 'DX7',
    library: true,
    rows: ['Voice', 'Colour', 'Envelope', 'Motion', 'Space'],
    presets: [],
    lfoRate: 5,
    knobs: [
      { type: 'sound', label: 'Voice' },
      { type: 'bright', def: 0.5 },
      { type: 'tune', label: 'Octave', range: [-24, 24], step: 12, def: 0.5 },
      { type: 'feedback', def: 0.5 },

      { type: 'inharm' },
      { type: 'pitchDrop', range: [0, 12] },
      { type: 'detune', range: [0, 20], def: 0.2 },
      { type: 'vibrato', range: [0, 0.5] },

      { type: 'attack', def: 0.5 },
      { type: 'decay', def: 0.5 },
      { type: 'sustain', def: 0.5 },
      { type: 'release', def: 0.5 },

      { type: 'modDecay', def: 0.5 },
      { type: 'velBright' },
      { type: 'lfoRate' },
      { type: 'lfoDepth' },

      { type: 'width', def: 0.4 },
      { type: 'spread', def: 0.3 },
      { type: 'drive' },
      { type: 'cutoff' },
    ],
  },
];

export const LIBRARY_ENGINE = ENGINES.findIndex((e) => e.library);

// Carrier flags per algorithm (OP1..OP6), from the msfa routing table.
const ROUTING = [
  [0xc1, 0x11, 0x11, 0x14, 0x01, 0x14], [0x01, 0x11, 0x11, 0x14, 0xc1, 0x14],
  [0xc1, 0x11, 0x14, 0x01, 0x11, 0x14], [0xc1, 0x11, 0x94, 0x01, 0x11, 0x14],
  [0xc1, 0x14, 0x01, 0x14, 0x01, 0x14], [0xc1, 0x94, 0x01, 0x14, 0x01, 0x14],
  [0xc1, 0x11, 0x05, 0x14, 0x01, 0x14], [0x01, 0x11, 0xc5, 0x14, 0x01, 0x14],
  [0x01, 0x11, 0x05, 0x14, 0xc1, 0x14], [0x01, 0x05, 0x14, 0xc1, 0x11, 0x14],
  [0xc1, 0x05, 0x14, 0x01, 0x11, 0x14], [0x01, 0x05, 0x05, 0x14, 0xc1, 0x14],
  [0xc1, 0x05, 0x05, 0x14, 0x01, 0x14], [0xc1, 0x05, 0x11, 0x14, 0x01, 0x14],
  [0x01, 0x05, 0x11, 0x14, 0xc1, 0x14], [0xc1, 0x11, 0x02, 0x25, 0x05, 0x14],
  [0x01, 0x11, 0x02, 0x25, 0xc5, 0x14], [0x01, 0x11, 0x11, 0xc5, 0x05, 0x14],
  [0xc1, 0x14, 0x14, 0x01, 0x11, 0x14], [0x01, 0x05, 0x14, 0xc1, 0x14, 0x14],
  [0x01, 0x14, 0x14, 0xc1, 0x14, 0x14], [0xc1, 0x14, 0x14, 0x14, 0x01, 0x14],
  [0xc1, 0x14, 0x14, 0x01, 0x14, 0x04], [0xc1, 0x14, 0x14, 0x14, 0x04, 0x04],
  [0xc1, 0x14, 0x14, 0x04, 0x04, 0x04], [0xc1, 0x05, 0x14, 0x01, 0x14, 0x04],
  [0x01, 0x05, 0x14, 0xc1, 0x14, 0x04], [0x04, 0xc1, 0x11, 0x14, 0x01, 0x14],
  [0xc1, 0x14, 0x01, 0x14, 0x04, 0x04], [0x04, 0xc1, 0x11, 0x14, 0x04, 0x04],
  [0xc1, 0x14, 0x04, 0x04, 0x04, 0x04], [0xc4, 0x04, 0x04, 0x04, 0x04, 0x04],
];

// isCarrier(algorithmIndex0, opIndex0) where opIndex0 0 = OP1.
export function isCarrier(alg, op) {
  return (ROUTING[alg][5 - op] & 3) === 0;
}
