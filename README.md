# WaveTerrainSynth

A real-time **wave terrain synthesizer** built with the Web Audio API, AudioWorklet and WebGL2.

Can try the app : wavywavy.netlify.app 
(- Use space bar or midi keyboard to trigger note, o p q w + - 0 1 2 3 4 5 6 7 8 9 and all arrows for controls)


Project for **ACTAM** (Advanced Coding Tools and Methodologies), M.Sc. in Music and Acoustic Engineering, Politecnico di Milano (POLIMI).

## Wave terrain synthesis

A wave terrain synthesis defines a 2D height function `f(x, z)` — the "terrain" — and reads the audio signal by walking a trajectory (here a circular orbit) across that surface once per audio-signal period. The terrain shape, the orbit's radius/position, and how fast it's traversed shape the resulting timbre. This project renders the terrain as a live 3D mesh, to see the surface that is heard.

## Features

- Real-time synthesis on a dedicated `AudioWorkletProcessor` (audio thread, not the UI thread) — five selectable terrain shapes, FM modulation, adjustable orbit/terrain parameters.
- Live 3D WebGL2 visualization of the terrain + the orbit path, and a 2D oscilloscope preview of the resulting waveform.
- An ADSR envelope, two LFOs (sine/triangle/square), and a modulation matrix to route onto synth parameters — all implemented as native Web Audio node connections, not custom per-sample code.
- MIDI input: notes drive the envelope + pitch, CC knobs drive the on-screen sliders.
- A "precision mode" toggle (`x` key) for finer slider control.

## Getting started

No dependencies, no build step. Because the app uses ES modules and an `AudioWorklet`, it must be served over HTTP (not opened directly as a `file://` path). From the repository root:

```bash
npx serve WaveTerrain
```

Then open the printed local address in a recent Chrome, Edge, or Firefox (WebGL2 + AudioWorklet support required) and **click the canvas once** — browsers require a user gesture before audio can start. That click also shows the modulation panel and starts listening for MIDI input.

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
| `x` | Toggle precision (fine step) mode |

Sliders can also be dragged directly, and a connected MIDI controller can play notes and turn mapped CC knobs.

The modulation matrix (top-right panel) is a small grid: columns are modulation sources (envelope, LFO1, LFO2), rows are destinations. Click and drag a cell up/down to set modulation intensity.

## Project structure

```
WaveTerrain/
  index.html, style.css        main page + styling
  js/
    core/      shared app state (CONFIG) and its limits
    terrain/   the wave-terrain height function and its color mapping
    audio/     AudioContext setup, the AudioWorklet processor, and modulation
               (envelope, LFOs, the modulation matrix)
    midi/      Web MIDI input handling
    render/    WebGL2 terrain renderer + the 2D scope overlay
    ui/        sliders, hotkeys, and the on-screen modulation panel
    main.js    entry point and the render/audio-lifecycle loop
```

