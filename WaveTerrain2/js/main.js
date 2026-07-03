import { initAudio, updateAudioSynth, resumeAudio } from './audio.js';
import { initInputHandlers, processInputs, syncFrequencyUI, syncFmUI, syncWaveUI, syncYScaleUI, syncVolumeUI, syncParamAUI } from './input.js';
import { initRenderer, clearCanvas, drawTerrain, drawOrbit } from './renderer.js';
import { initScope2D, drawScope2D } from './scope2d.js'; // Imported from your new module
import { CONFIG } from './config.js';

const canvas = document.getElementById("canvas");
const freqSlider = document.getElementById("freq");
const fmSlider = document.getElementById("fm-index");

// 1. Initialise subsystem engines
initInputHandlers();
initRenderer();
initScope2D(); // Setup the 2D canvas sizing and resize listeners

// 2. Safely sync current startup slider states configurations maps
syncWaveUI(parseInt(document.getElementById("wave-select").value));
syncFrequencyUI(parseFloat(freqSlider.value));
syncFmUI(parseFloat(fmSlider.value));
syncYScaleUI(parseFloat(document.getElementById("y-scale").value));
syncVolumeUI(parseFloat(document.getElementById("volume").value));
syncParamAUI(parseFloat(document.getElementById("param-a").value));


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

  // Process user key controls updates (This auto-syncs audio on changes)
  processInputs();

  // Clear scene and paint graphic passes loops
  clearCanvas();
  drawTerrain();
  drawOrbit(elapsedSeconds * 2.0); 
  
  // Paint the responsive 2D path oscilloscope overlay directly over top
  drawScope2D(); 

  requestAnimationFrame(loop);
}

// Fire up animation sequence loop updates
requestAnimationFrame(loop);
