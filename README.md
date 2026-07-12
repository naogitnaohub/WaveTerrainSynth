# WaveTerrainSynth

A real-time wave terrain synth built with Web Audio API, AudioWorklet and WebGL2.

Can try the app : wavywavy.netlify.app

Project for ACTAM (Advanced Coding Tools and Methodologies), M.Sc. in Music and Acoustic Engineering, Politecnico di Milano (POLIMI).

## Wave terrain synth 

The terrain is a 2D height function `f(x, z)`. A circular orbit, the sound path, walks across it once per audio period; the height along the orbit is the waveform. The terrain shape, orbit radius/position, and orbit speed define the timbre. 

## Features

- Real-time synthesis on a dedicated `AudioWorkletProcessor`, off the UI thread. 15 terrain shapes, FM modulation, adjustable orbit/terrain parameters.
- Live 3D WebGL2 view of the terrain and orbit, plus a 2D oscilloscope (on canvas).
- ADSR envelope, two LFOs, and a modulation matrix, all as Web Audio node connections. One toggle bypasses the whole modulation matrix  without routing information.
- Potentiometers and faders for every synth parameter.
- Presets: save/load by name, export/import as `.json`.
- MIDI input: notes trigger the envelope and set pitch, CC knobs drive on-screen controls. 
- MIDI maping: MIDI-learn binds any pot, fader, or matrix cell to a CC or note.

## Getting started

 Must be served over HTTP, not opened as `file://`, because it uses ES modules and an `AudioWorklet`.

```bash
npx serve WaveTerrain
```

Open the printed address in a recent Chrome, Edge, or Firefox. Click the canvas once to start audio and MIDI listening.

## Controls

| Input | Action |
|---|---|
| Click canvas | Enable audio (once) |
| Drag canvas (mouse) | Orbit the camera |
| Scroll wheel | Zoom |
| Arrow keys | Move the orbit center |
| `+` / `-` | Orbit radius |
| `1` / `2` | Frequency down / up |
| `4` / `5` | FM intensity down / up |
| `7` / `8` | FM ratio down / up |
| `3` / `6` | Y-scale down / up |
| `0` / `9` | Volume down / up |
| `o` / `p` | Wave shape parameter `a` down / up |
| `q` / `w` | Previous / next terrain shape |
| Spacebar (hold) | Trigger the envelope (note on/off) |

Potentiometers drag vertically. Volume and ADSR faders drag like a normal slider. A connected MIDI controller plays notes and knobs can be mapped to parameters.

The modulation matrix is inside the control panel: rows are sources (LFO1, LFO2, Envelope), columns are destinations. Drag a cell up/down to set depth; drag to the bottom to remove the route. Bypass (top-right, above Volume) mutes every route without loosing their depths values.

## Project structure

```
WaveTerrain/
  index.html, style.css        main page + styling
  js/
    core/      shared app state (CONFIG) and its limits
    terrain/   the wave-terrain height function and its color mapping
    audio/     AudioContext setup, the AudioWorklet processor, and modulation
               (envelope, LFOs, the modulation matrix)
    midi/      Web MIDI input + MIDI-learn CC/note mapping
    render/    WebGL2 terrain renderer + the 2D scope
    ui/        potentiometers, the on-screen modulation panel, presets, hotkeys
    main.js    entry point and the render/audio-lifecycle loop
```

## AI use

`ui/potentiometer.js`, `ui/presets-ui.js`, `render/renderer.js`, `terrain/terrain-color.js, and `midi/midi-map.js` were written with Claude.

Genereally, AI helped structure the code to be computationnaly cheaper, more efficent and modular.
In particular, using a separate thread for real-time audio would not have been possible without AI.

