import { initAudio, resumeAudio } from './audio.js';
import { initInputHandlers, processInputs, syncUI } from './input.js';
import { initRenderer, clearCanvas, drawTerrain, drawOrbit } from './renderer.js';
import { initScope2D, drawScope2D } from './scope2d.js';

const canvas = document.getElementById("canvas");

// Initialize core hardware engines
initInputHandlers();
initRenderer();
initScope2D();

// Synchronize all current HTML slider layouts automatically on initialization
["wave-select", "freq", "fm-index", "y-scale", "volume", "param-a"].forEach(id => {
  const el = document.getElementById(id);
  if (el) syncUI(id, parseFloat(el.value));
});

// Sound context interaction trigger
window.addEventListener("click", async e => {
  if (e.target === canvas) {
    await initAudio();
    resumeAudio();
  }
});

// Central 60FPS Render & Audio Lifecycle Engine Loop
function loop(t) {
  processInputs();
  clearCanvas();
  drawTerrain();
  drawOrbit(t * 0.002); // Multiplied by 2.0 and divided by 1000 converted into a single factor
  drawScope2D();
  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
