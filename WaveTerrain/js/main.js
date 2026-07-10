// Map:
//   - synth sound / DSP math      -> js/audio/ (engine.js, worklet/, modulation/)
//   - terrain shape formulas      -> js/terrain/terrain-core.js
//   - 3D view / scope drawing     -> js/render/
//   - sliders, hotkeys, on-screen panels -> js/ui/
//   - shared numeric state (CONFIG) -> js/core/config.js
import { initAudio, resumeAudio } from './audio/engine.js';
import { initInputHandlers, initMainControls, processInputs } from './ui/input.js';
import { initRenderer, clearCanvas, drawTerrain, drawOrbit } from './render/renderer.js';
import { initScope2D, drawScope2D } from './render/scope2d.js';
import { initModMatrixUI } from './ui/mod-matrix-ui.js';
import { initMidi } from './midi/midi.js';
import { initEnvelopePanelUI } from './ui/envelope-panel-ui.js';
import { initLfoPanelUI } from './ui/lfo-panel-ui.js';
import { initPresetsUI } from './ui/presets-ui.js';

const canvas = document.getElementById("canvas");

// These can start immediately -- none of them need audio to exist.
// initMainControls() also pushes CONFIG's defaults into each potentiometer/slider as
// it builds them, so the UI, CONFIG, and (once audio starts) the sound all ar econsistent
// since the first frame.
initInputHandlers();
initMainControls();
initRenderer();
initScope2D();

// Browsers plays audio only after user interacts with the page 
// initAudio() builds the whole Web Audio graph; the envelope/LFO/matrix/
// preset panels make sense once that graph (and its envelope/LFO nodes) exists,
// so they stay empty until then -- everything else in the control panel (the pots,
// volume) is already live and usable before this.
window.addEventListener("click", async e => {
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
// requestAnimationFrame loop (~60Hz) driving visuals and input polling.
// Audio synthesis runs independently on the real-time AudioWorklet thread
// (js/audio/worklet/terrain-processor.js), so no audio glitches
function loop(t) {
  processInputs();
  clearCanvas();
  drawTerrain();
  drawOrbit(t * 0.002); // t is milliseconds since page load; scale it down to a slow rotation speed
  drawScope2D();
  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
