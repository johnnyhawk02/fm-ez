# FM EZ

Six-operator FM synth for the browser, built to be played from 24 knobs
(4 across by 6 down, laid out like the Faderfox PC4).

- **Engines:** Percussion, Bass, Keys, Bells, Pads, Lead. Each engine is a data
  template (algorithms, ratio sets, ranges) in `js/engines.js`.
- **Stereo:** every carrier is rendered twice (left and right, detuned and
  panned); modulators are rendered once and feed both sides with per-side
  depth (Mod spread).
- **Randomise:** Generate, Mutate, Harmonic, Breed (between stored A and B) and
  Row, with Amount, Lock rows, Morph A to B and 32 steps of undo.
- **Voice modes:** Poly (8 voices), Mono legato (last-note priority, short
  glide, envelopes don't restart) and Duo (two voices).
- **Control:** Web MIDI notes and CCs (Chrome or Edge), with soft takeover so
  hardware knobs never make the sound jump. Computer keyboard: A W S E D F T G
  Y H U J K, Z and X change octave.

## Engines and knob grid

Pick the engine with the buttons beside the knobs, or send MIDI **program
change 1 to 7** (Percussion, Bass, Keys, Bells, Pads, Lead, DX7). Each engine
has its own 20 knobs (rows 1 to 5) and remembers their settings when you switch
away. Row 6 is the same in every engine. Lock rows and Volume are on screen.

| Engine | Row 1 | Row 2 | Row 3 | Row 4 | Row 5 |
| --- | --- | --- | --- | --- | --- |
| Percussion | Sound, Tune, Pitch drop, Drop time | Brightness, Noise, Metal, Overtone | Snap, Decay, Ring, Choke | Mod decay, Accent, Vel > bright, Detune | Width, Mod spread, Drive, Low-pass |
| Bass | Sound, Octave, Brightness, Feedback | Overtone, Sub mix, Grit, Detune | Attack, Decay, Sustain, Release | Pluck, Vel > bright, Glide, Vibrato | Width, Mod spread, Drive, Low-pass |
| Keys | Sound, Brightness, Tine / body, Bark | Feedback, Inharmonic, Chorus, Vel > bright | Attack, Decay, Sustain, Release | Mod decay, Vel > level, LFO rate, Wobble | Width, Mod spread, Drive, Low-pass |
| Bells | Sound, Brightness, Inharmonic, Spectrum | Feedback, Mix, Beat, Strike bend | Attack, Decay, Sustain, Release | Mod decay, Vel > bright, LFO rate, LFO depth | Width, Mod spread, Drive, Low-pass |
| Pads | Sound, Brightness, Overtone, Detune | Feedback, Mix, Inharmonic, Vibrato | Attack, Decay, Sustain, Release | Swell, Evolve, LFO rate, LFO depth | Width, Mod spread, Drive, Low-pass |
| Lead | Sound, Brightness, Feedback, Overtone | Mix, Inharmonic, Detune, Blip | Attack, Decay, Sustain, Release | Mod decay, Vel > bright, Glide, Vibrato | Width, Mod spread, Drive, Low-pass |
| DX7 | Voice, Brightness, Octave, Feedback | Inharmonic, Pitch drop, Detune, Vibrato | Attack, Decay, Sustain, Release | Mod decay, Vel > bright, LFO rate, LFO depth | Width, Mod spread, Drive, Low-pass |

Row 6 (all engines): Method, Amount, Go, Morph A>B.

## DX7 voices

Click **Load DX7 .syx** or drop .syx files on the page (32-voice banks or
single voices). The engine switches to **DX7**: knob 1 (Voice) picks the voice, and
the other knobs become offsets around it (middle = as loaded). Go then works on the voice's own DX7
parameters:

- **Generate** picks another voice from the loaded banks.
- **Mutate** nudges modulator levels and ratios, envelope rates and levels, and
  detune. Carriers keep their level and pitch. Each Go mutates the last result.
- **Harmonic** re-rolls the modulator ratios.
- **Breed** builds a child operator by operator from voices stored in A and B.
- **Morph A>B** blends the two stored voices.

Loaded banks are remembered in the browser. FM EZ sounds are stereo (carrier
pairs and panned modulators), so they can't be saved back to DX7 format as they
are; a mono conversion is possible later. Not yet carried over from the DX7:
pitch envelope, LFO, keyboard scaling and per-operator velocity.

## PC4 setup

Set the PC4's 24 knobs to send **CC 1 to 24** in grid order: row by row from the
top-left, 4 per row (knob 1 = Sound, knob 24 = Morph A>B). Program change 1-7 picks the engine. Any MIDI channel
works. FM EZ uses this mapping by default, no setup needed.

To use other CC numbers, click **Learn PC4** and turn each knob once as it
lights up; the mapping is saved in the browser. **Use CC 1-24** goes back to the
default. The MIDI bar under the title shows the ports the browser sees and the
last message received.

## Run locally

Any static server works, for example `python3 -m http.server` in this folder,
then open http://localhost:8000. No build step.

## Credits

The DX7 algorithm routing table in `js/fm-processor.js` is ported from msfa
(Copyright 2012 Google Inc., Apache License 2.0), the engine inside
[Dexed](https://github.com/asb2m10/dexed). The rest is new code.
