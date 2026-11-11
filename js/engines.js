// Engine templates. An engine is data, not DSP: it picks algorithms, ratio
// sets and ranges that suit one sound family, and the 24 knobs move inside them.
// Algorithms are DX7 numbers (1-32). Ratios are listed OP1..OP6.

export const ENGINES = [
  {
    name: 'Percussion',
    algos: [16, 5, 1, 31, 29, 32],
    ratioSets: [
      [1, 1.5, 0.5, 2.3, 1, 3.1],      // kick / tom
      [1, 2.76, 1, 5.4, 1.41, 7.2],    // snare body
      [1, 3.5, 7.13, 11.2, 4.4, 13.7], // metallic
      [1, 0.5, 1, 9.3, 1.5, 14.9],     // hat
      [1, 1.41, 2.2, 3.3, 1, 0.71],    // wood / clave
    ],
    indexMax: 7,
    fbMax: 1,
    attack: [0.001, 0.02],
    decay: [0.03, 1.2],
    sustain: [0, 0],
    release: [0.02, 0.6],
    modDecay: [0.005, 0.5],
    modSus: 0,
    pitchEnv: { max: 36, decay: 0.08 },
    inharmCarriers: true,
  },
  {
    name: 'Bass',
    algos: [1, 5, 3, 13, 16, 7],
    ratioSets: [
      [1, 1, 1, 1, 1, 1],
      [0.5, 1, 0.5, 2, 1, 1],
      [1, 2, 1, 1, 1, 3],
      [0.5, 1, 1, 0.5, 2, 1],
      [1, 3, 1, 2, 1, 5],
    ],
    indexMax: 5,
    fbMax: 0.8,
    attack: [0.001, 0.08],
    decay: [0.05, 2],
    sustain: [0, 1],
    release: [0.02, 1],
    modDecay: [0.02, 1.5],
    modSus: 0.25,
    pitchEnv: { max: 7, decay: 0.03 },
  },
  {
    name: 'Keys',
    algos: [5, 6, 1, 3, 11],
    ratioSets: [
      [1, 1, 1, 14, 1, 1],
      [1, 1, 1, 1, 0.5, 2],
      [1, 2, 1, 3, 1, 7],
      [1, 1, 2, 1, 1, 3],
      [0.5, 1, 1, 14, 1, 1],
    ],
    indexMax: 4,
    fbMax: 0.6,
    attack: [0.001, 0.05],
    decay: [0.3, 6],
    sustain: [0, 0.6],
    release: [0.1, 1.5],
    modDecay: [0.05, 3],
    modSus: 0.2,
    pitchEnv: { max: 2, decay: 0.05 },
  },
  {
    name: 'Bells',
    algos: [5, 16, 22, 29, 1],
    ratioSets: [
      [1, 3.5, 1, 3.5, 1, 1.41],
      [1, 1.41, 2, 4.24, 1, 7],
      [1, 7.07, 1, 2.71, 0.5, 3.14],
      [1, 5, 1.5, 9.5, 2, 1.5],
      [1, 2.4, 1, 6.3, 1, 11.1],
    ],
    indexMax: 4.5,
    fbMax: 0.5,
    attack: [0.001, 0.05],
    decay: [0.5, 8],
    sustain: [0, 0.3],
    release: [0.2, 4],
    modDecay: [0.02, 2],
    modSus: 0.1,
    pitchEnv: { max: 2, decay: 0.02 },
    inharmCarriers: true,
  },
  {
    name: 'Pads',
    algos: [22, 24, 25, 31, 19, 5],
    ratioSets: [
      [1, 1, 1, 1, 1, 1],
      [1, 2, 1, 3, 2, 1],
      [0.5, 1, 2, 1, 1.5, 4],
      [1, 1, 1, 2, 3, 0.5],
      [1, 1.5, 2, 1, 3, 1],
    ],
    indexMax: 3,
    fbMax: 0.7,
    attack: [0.05, 4],
    decay: [0.5, 6],
    sustain: [0.3, 1],
    release: [0.3, 6],
    modDecay: [0.5, 8],
    modSus: 0.5,
    pitchEnv: { max: 1, decay: 0.5 },
  },
  {
    name: 'Lead',
    algos: [1, 16, 3, 4, 7],
    ratioSets: [
      [1, 1, 1, 1, 1, 1],
      [1, 2, 1, 1, 3, 1],
      [1, 1, 2, 1, 1, 4],
      [2, 1, 1, 3, 1, 2],
      [1, 3, 1, 1, 2, 5],
    ],
    indexMax: 5,
    fbMax: 1,
    attack: [0.001, 0.3],
    decay: [0.1, 3],
    sustain: [0.3, 1],
    release: [0.05, 1.5],
    modDecay: [0.1, 4],
    modSus: 0.6,
    pitchEnv: { max: 3, decay: 0.05 },
  },
  {
    // Loaded DX7 voices. The Algorithm knob picks the voice; the other
    // Tone and Shape knobs become offsets around the original (middle = as loaded).
    name: 'DX7 Library',
    library: true,
    algos: [],
    pitchEnv: { max: 12, decay: 0.1 },
  },
];

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
