// Entry point: wires all modules and runs requestAnimationFrame loop.
//
// Module map:
//   synth sound / DSP math          -> js/audio/ (engine.js, worklet/, modulation/)
//   terrain shape formulas          -> js/terrain/terrain-core.js
//   3D view / scope drawing         -> js/render/
//   sliders, hotkeys, panels        -> js/ui/
//   shared numeric state (CONFIG)   -> js/core/config.js

import { initAudio, resumeAudio } from './audio/engine.js';
import { initInputHandlers, initMainControls, processInputs } from './ui/input.js';
import { initRenderer, clearCanvas, drawTerrain, drawOrbit } from './render/renderer.js';
import { initScope2D, drawScope2D } from './render/scope2d.js';
import { initModMatrixUI } from './ui/mod-matrix-ui.js';
import { initMidi } from './midi/midi.js';
import { initMidiLearnButton } from './midi/midi-map.js';
import { initEnvelopePanelUI } from './ui/envelope-panel-ui.js';
import { initLfoPanelUI } from './ui/lfo-panel-ui.js';
import { initPresetsUI } from './ui/presets-ui.js';
import { initHelpPanel } from './ui/help-panel-ui.js';

const canvas = document.getElementById("canvas");

// Functions that can start from the beginning -- none need audio to exist yet.
initInputHandlers();
initMainControls(); // pushes CONFIG's default values into each pot/slider
initMidiLearnButton();
initRenderer();
initScope2D();
initHelpPanel();

// initAudio() builds the whole Web Audio graph
// envlope/LFO/matrix/ preset panels only when the audio grap (and its envelope/LFO nodes)
// exists, so they stay empty until then 
window.addEventListener("click", async e => { // need a click to launch audio in browser
  if (e.target === canvas) {
    await initAudio();
    resumeAudio();
    initEnvelopePanelUI();
    initLfoPanelUI();
    initModMatrixUI();
    initPresetsUI();
    initMidi();
  }
});

// Runs ~60Hz. Only visuals + hold keys
// audio runs on its own real-time thread (js/audio/worklet/terrain-processor.js) 
// and is never affected by this loop's timing.
function loop(t) {
  processInputs();      // apply whatever keys are currently held down
  clearCanvas();
  drawTerrain();
  drawOrbit(t * 0.002); // t = ms since page load, slowed into a rotation speed
  drawScope2D();
  requestAnimationFrame(loop); // schedule next frame
}

requestAnimationFrame(loop);
