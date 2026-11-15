# FM EZ

Six-operator FM synth for the browser, played from 24 knobs (a Faderfox PC4).
Just the engine: every knob goes straight to the operators.

## Knobs

On screen there is one column per operator:

| Row | OP1 to OP6 |
| --- | --- |
| Pitch | Frequency ratio, x0.5 to x16 |
| Envelope | One knob morphs through Click, Pluck, Long decay, Sustained, Long release, Slow attack, Swell |
| Level | Output level for a carrier (out), modulation depth for a modulator |
| Global | Algorithm (DX7 1-32), Feedback, Stereo, Mod spread, Glide, Volume |

The header above each column shows whether that operator is a carrier ("out")
or which operator it modulates, for the chosen algorithm.

- **Stereo:** every carrier is rendered twice (left and right, detuned and
  panned) and the Stereo knob sets how far apart. Modulators are rendered once
  and feed both sides with different depth (Mod spread).
- **Voice modes:** Poly (8 voices), Mono legato (glide, envelopes don't
  restart) and Duo.
- **Computer keyboard:** A W S E D F T G Y H U J K, Z and X change octave.
- The sound is saved in the browser. Init sound goes back to the start patch.

## PC4 setup

Set the PC4's 24 knobs to send **CC 1 to 24**, row by row from the top-left, on
any channel. The PC4 is the screen grid turned on its side: each PC4 row is one
operator.

| PC4 row | Knob 1 | Knob 2 | Knob 3 | Knob 4 |
| --- | --- | --- | --- | --- |
| 1 | OP1 Pitch | OP1 Envelope | OP1 Level | Algorithm |
| 2 | OP2 Pitch | OP2 Envelope | OP2 Level | Feedback |
| 3 | OP3 Pitch | OP3 Envelope | OP3 Level | Stereo |
| 4 | OP4 Pitch | OP4 Envelope | OP4 Level | Mod spread |
| 5 | OP5 Pitch | OP5 Envelope | OP5 Level | Glide |
| 6 | OP6 Pitch | OP6 Envelope | OP6 Level | Volume |

Soft takeover: a knob only follows the PC4 once you turn past its current value
(a ring dot shows where the PC4 knob is). **Learn PC4** maps other CC numbers:
turn each PC4 knob in order, row by row. **Use CC 1-24** goes back to the
default.

## Earlier version

The version with engines, macros, randomising and DX7 .syx loading is kept in
`v1/` (on Pages at /fm-ez/v1/).

## Run locally

Any static server works, for example `python3 -m http.server` in this folder,
then open http://localhost:8000. No build step.

## Credits

The DX7 algorithm routing table in `js/fm-processor.js` is ported from msfa
(Copyright 2012 Google Inc., Apache License 2.0), the engine inside
[Dexed](https://github.com/asb2m10/dexed). The rest is new code.
