import { orbitState, clampOrbitState } from './orbit.js';
import { view } from './terrain.js';

const keys = {};
let isDragging = false;
let previousMousePosition = { x: 0, y: 0 };

// Global selector nodes
const canvas = document.getElementById("canvas");
const freqSlider = document.getElementById("freq");
const freqDisplay = document.getElementById("freq-display");

const fmSlider = document.getElementById("fm-index");
const fmDisplay = document.getElementById("fm-display");


export function syncFmUI(value) {
  fmSlider.value = value;
  fmDisplay.textContent = `FM Intensity: ${Math.round(value)}`;
}
export function initInputHandlers() {
  // Track key matrices
  window.addEventListener("keydown", (e) => { keys[e.key] = true; });
  window.addEventListener("keyup", (e) => { keys[e.key] = false; });

  // Canvas context click interactions 
  window.addEventListener("mousedown", (e) => {
    if (e.target === canvas) {
      isDragging = true;
      previousMousePosition = { x: e.clientX, y: e.clientY };
    }
  });

  window.addEventListener("mousemove", (e) => {
    if (isDragging) {
      const deltaX = e.clientX - previousMousePosition.x;
      const deltaY = e.clientY - previousMousePosition.y;
      view.angleY += deltaX * 0.007;
      view.angleX += deltaY * 0.007;
      previousMousePosition = { x: e.clientX, y: e.clientY };
    }
  });

  window.addEventListener("mouseup", () => { isDragging = false; });

  window.addEventListener("wheel", (e) => {
    if (e.target === canvas) {
      e.preventDefault();
      if (e.deltaY < 0) view.zoom = Math.min(2.5, view.zoom + 0.08);
      else view.zoom = Math.max(0.4, view.zoom - 0.08);
    }
  }, { passive: false });

  // Slider change engine parameters updating listener
  freqSlider.oninput = function () {
    syncFrequencyUI(parseFloat(this.value));
  };

  fmSlider.oninput = function () {
    syncFmUI(parseFloat(this.value));
  };
}

export function syncFrequencyUI(value) {
  freqSlider.value = value;
  freqDisplay.textContent = `Frequency: ${Math.round(value)} Hz`;
}

export function processInputs() {
  const speed = 0.28; 
  if (keys["ArrowUp"])    orbitState.cz += speed;
  if (keys["ArrowDown"])  orbitState.cz -= speed;
  if (keys["ArrowLeft"])  orbitState.cx -= speed;
  if (keys["ArrowRight"]) orbitState.cx += speed;

  const radiusSpeed = 0.1;
  if (keys["+"] || keys["="]) orbitState.r += radiusSpeed;
  if (keys["-"] || keys["_"]) orbitState.r -= radiusSpeed;

  // Real-time button triggers parsing
  let currentFreq = parseFloat(freqSlider.value) || 120;
  if (keys["1"]) {
    currentFreq = Math.max(parseFloat(freqSlider.min), currentFreq - 4);
    syncFrequencyUI(currentFreq);
  }
  if (keys["2"]) {
    currentFreq = Math.min(parseFloat(freqSlider.max), currentFreq + 4);
    syncFrequencyUI(currentFreq);
  }

  clampOrbitState();
}
