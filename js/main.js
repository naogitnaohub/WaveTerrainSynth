import { initAudio, updateAudioSynth, resumeAudio } from './audio.js';
import { orbitState } from './orbit.js';
import { initInputHandlers, processInputs, syncFrequencyUI, syncFmUI } from './input.js';
import { initRenderer, clearCanvas, drawTerrain, drawOrbit } from './renderer.js';

const canvas = document.getElementById("canvas");
const freqSlider = document.getElementById("freq");
const fmSlider = document.getElementById("fm-index");

// 1. Initialise subsystem engines
initInputHandlers();
initRenderer();

// 2. Safely sync current startup slider states configurations maps
syncFrequencyUI(parseFloat(freqSlider.value));
syncFmUI(parseFloat(fmSlider.value));

// 3. Audio hardware contexts unlock listeners
window.addEventListener("click", async (e) => {
  if (e.target === canvas) {
    await initAudio();
    resumeAudio();
  }
});

// 4. Central execution animation loop lifecycle frame
function loop(timestamp) {
  const elapsedSeconds = timestamp / 1000;

  // Process user key controls updates
  processInputs();

  // Send coordinates state snapshots parameters down to Web Audio Worklets Threads
  const currentFreq = parseFloat(freqSlider.value) || 80;
  const currentFm = parseFloat(fmSlider.value) || 10;
  

  updateAudioSynth(orbitState, currentFreq, currentFm); 

  // Clear scene and paint graphic passes loops
  clearCanvas();
  drawTerrain();
  drawOrbit(elapsedSeconds * 2.0); 

  requestAnimationFrame(loop);
}

// Fire up animation sequence loop updates
requestAnimationFrame(loop);
