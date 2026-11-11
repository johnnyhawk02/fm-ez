# FM EZ

Six-operator FM synth for the browser, built to be played from 24 knobs
(a 4 x 6 grid, laid out like the Faderfox PC4).

- **Engines:** Percussion, Bass, Keys, Bells, Pads, Lead. Each engine is a data
  template (algorithms, ratio sets, ranges) in `js/engines.js`.
- **Stereo:** every carrier is rendered twice (left and right, detuned and
  panned); modulators are rendered once and feed both sides with per-side
  depth (Mod spread).
- **Randomise:** Generate, Mutate, Harmonic, Breed (between stored A and B) and
  Row, with Amount, Lock rows, Morph A to B and 32 steps of undo.
- **Control:** Web MIDI notes and CCs (Chrome or Edge), with soft takeover so
  hardware knobs never make the sound jump. Computer keyboard: A W S E D F T G
  Y H U J K, Z and X change octave.

## Knob grid

| Row | 1 | 2 | 3 | 4 | 5 | 6 |
| --- | --- | --- | --- | --- | --- | --- |
| Tone | Engine | Algorithm | Brightness | Harmonics | Feedback | Inharmonic |
| Shape | Attack | Decay | Sustain | Release | Mod decay | Vel > bright |
| Space | Width | Mod spread | LFO rate | LFO depth | Pitch env | Tone / drive |
| Random | Method | Amount | Go | Morph A>B | Lock rows | Volume |

## PC4 setup

Click **Learn PC4**, then turn each knob once, top-left to bottom-right. The
mapping is saved in the browser.

## Run locally

Any static server works, for example `python3 -m http.server` in this folder,
then open http://localhost:8000. No build step.

## Credits

The DX7 algorithm routing table in `js/fm-processor.js` is ported from msfa
(Copyright 2012 Google Inc., Apache License 2.0), the engine inside
[Dexed](https://github.com/asb2m10/dexed). The rest is new code.
