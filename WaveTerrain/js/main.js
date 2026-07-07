// Entry point. This file just wires the other modules together and runs the main
// loop -- it holds no logic of its own. If you're new to this codebase, this is the
// best place to start reading: everything imported below is one self-contained piece
// (audio engine, input handling, 3D rendering, the 2D scope, MIDI, the modulation UI).
//
// Quick map of "where do I edit to change X":
//   - synth sound / DSP math      -> js/audio/ (engine.js, worklet/, modulation/)
//   - terrain shape formulas      -> js/terrain/terrain-core.js
//   - 3D view / scope drawing     -> js/render/
//   - sliders, hotkeys, on-screen panels -> js/ui/
//   - shared numeric state (CONFIG) -> js/core/config.js
import { initAudio, resumeAudio } from './audio/engine.js';
import { initInputHandlers, processInputs, syncUI } from './ui/input.js';
import { initRenderer, clearCanvas, drawTerrain, drawOrbit } from './render/renderer.js';
import { initScope2D, drawScope2D } from './render/scope2d.js';
import { initModMatrixUI } from './ui/mod-matrix-ui.js';
import { initMidi } from './midi/midi.js';
import { initPrecisionMode } from './ui/precision-mode.js';
import { initEnvelopePanelUI } from './ui/envelope-panel-ui.js';
import { initLfoPanelUI } from './ui/lfo-panel-ui.js';

const canvas = document.getElementById("canvas");

// These can start immediately -- none of them need audio to already exist.
initInputHandlers();
initRenderer();
initScope2D();
initPrecisionMode();

// Push each slider's current HTML value into CONFIG once at startup, so the app's
// internal state always matches what's shown on screen, even before the user touches
// anything.
["wave-select", "freq", "fm-index", "y-scale", "volume", "param-a"].forEach(id => {
  const el = document.getElementById(id);
  if (el) syncUI(id, parseFloat(el.value));
});

// Browsers refuse to play audio until the user interacts with the page (the
// "autoplay policy"), so everything audio-related is deferred to this first click on
// the canvas. initAudio() builds the whole Web Audio graph; the panel/MIDI setup only
// makes sense once that graph (and its envelope/LFO nodes) actually exists.
window.addEventListener("click", async e => {
  if (e.target === canvas) {
    await initAudio();
    resumeAudio();
    document.getElementById('mod-panel').style.display = 'flex';
    initEnvelopePanelUI();
    initLfoPanelUI();
    initModMatrixUI();
    initMidi();
  }
});

// requestAnimationFrame runs this once per screen refresh (~60 times/second). Note
// that this loop only drives the *visuals* (3D mesh, orbit ring, 2D scope) and input
// polling -- the actual audio synthesis runs independently on the AudioWorklet's own
// real-time thread (see js/audio/worklet/terrain-processor.js), so a slow frame here
// can never cause an audio glitch.
function loop(t) {
  processInputs();
  clearCanvas();
  drawTerrain();
  drawOrbit(t * 0.002); // t is milliseconds since page load; scale it down to a slow rotation speed
  drawScope2D();
  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
