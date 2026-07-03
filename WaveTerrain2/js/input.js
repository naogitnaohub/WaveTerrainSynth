import { CONFIG, updateSynthParam, updateOrbitState } from './config.js';
import { updateAudioSynth, updateAudioWaveform } from './audio.js';
import { rebuildTerrainMesh } from './renderer.js';

const keys = {};
let isDragging = false;
let previousMousePosition = { x: 0, y: 0 };

// Global selector nodes matrix maps
const canvas = document.getElementById("canvas");
const freqSlider = document.getElementById("freq");
const freqDisplay = document.getElementById("freq-display");
const fmSlider = document.getElementById("fm-index");
const fmDisplay = document.getElementById("fm-display");
const fmRatioSlider = document.getElementById("fm-ratio");
const fmRatioDisplay = document.getElementById("fm-ratio-display");
const waveSlider = document.getElementById("wave-select");
const waveDisplay = document.getElementById("wave-display");
const yScaleSlider = document.getElementById("y-scale");
const yScaleDisplay = document.getElementById("yscale-display");
const volumeSlider = document.getElementById("volume");
const volumeDisplay = document.getElementById("volume-display");

// Parameter A DOM Nodes
const paramASlider = document.getElementById("param-a");
const paramADisplay = document.getElementById("param-a-display");

export function syncWaveUI(value) {
  updateSynthParam('waveNumber', value);
  waveSlider.value = CONFIG.synth.waveNumber;
  waveDisplay.textContent = `Wave Selection: Wave ${CONFIG.synth.waveNumber}`;
  rebuildTerrainMesh();
  updateAudioWaveform(CONFIG.synth.waveNumber);
}

export function syncYScaleUI(value) {
  updateSynthParam('yScale', value);
  yScaleSlider.value = CONFIG.synth.yScale;
  yScaleDisplay.textContent = `Y-Scale Profile: ${CONFIG.synth.yScale.toFixed(1)}`;
  updateAudioSynth();
}

export function syncParamAUI(value) {
  // Let config safely clamp the value to [-5.0, 15.0] first
  updateSynthParam('a', value);
  
  // Always use the safely clamped value from config!
  const currentA = CONFIG.synth.a;
  
  if (paramASlider) paramASlider.value = currentA;
  if (paramADisplay) paramADisplay.textContent = `Wave Shape (a): ${currentA.toFixed(2)}`;
  
  rebuildTerrainMesh(); 
  updateAudioSynth();
}


export function syncVolumeUI(value) {
  updateSynthParam('volume', value);
  volumeSlider.value = CONFIG.synth.volume;
  volumeDisplay.textContent = `Master Volume: ${Math.round(CONFIG.synth.volume * 100)}%`;
  updateAudioSynth();
}

export function syncFmUI(value) {
  updateSynthParam('fmIndex', value);
  fmSlider.value = CONFIG.synth.fmIndex;
  fmDisplay.textContent = `FM Intensity: ${Math.round(CONFIG.synth.fmIndex)}`;
  updateAudioSynth();
}

export function syncFmRatioUI(value) {
  updateSynthParam('fmRatio', value);
  fmRatioSlider.value = CONFIG.synth.fmRatio;
  fmRatioDisplay.textContent = `FM Ratio: ${CONFIG.synth.fmRatio.toFixed(2)}`;
  updateAudioSynth();
}

export function syncFrequencyUI(value) {
  updateSynthParam('frequency', value);
  freqSlider.value = CONFIG.synth.frequency;
  freqDisplay.textContent = `Frequency: ${Math.round(CONFIG.synth.frequency)} Hz`;
  updateAudioSynth();
}

export function initInputHandlers() {
  window.addEventListener("keydown", (e) => { keys[e.key] = true; });
  window.addEventListener("keyup", (e) => { keys[e.key] = false; });

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
      CONFIG.view.angleY += deltaX * 0.007;
      CONFIG.view.angleX += deltaY * 0.007;
      previousMousePosition = { x: e.clientX, y: e.clientY };
    }
  });

  window.addEventListener("mouseup", () => { isDragging = false; });

  window.addEventListener("wheel", (e) => {
    if (e.target === canvas) {
      e.preventDefault();
      CONFIG.view.zoom = Math.max(0.4, Math.min(2.5, CONFIG.view.zoom + (e.deltaY < 0 ? 0.08 : -0.08)));
    }
  }, { passive: false });

  waveSlider.oninput = function () { syncWaveUI(parseInt(this.value)); };
  freqSlider.oninput = function () { syncFrequencyUI(parseFloat(this.value)); };
  fmSlider.oninput = function () { syncFmUI(parseFloat(this.value)); };
  fmRatioSlider.oninput = function () { syncFmRatioUI(parseFloat(this.value)); };
  yScaleSlider.oninput = function () { syncYScaleUI(parseFloat(this.value)); };
  if (paramASlider) {
    paramASlider.oninput = function () { syncParamAUI(parseFloat(this.value)); };
  }
  volumeSlider.oninput = function () { syncVolumeUI(parseFloat(this.value)); };
}

export function processInputs() {
  let dx = 0, dz = 0, dr = 0;
  const speed = 0.28; 
  if (keys["ArrowUp"])    dz -= speed;
  if (keys["ArrowDown"])  dz += speed;
  if (keys["ArrowLeft"])  dx -= speed;
  if (keys["ArrowRight"]) dx += speed;

  const radiusSpeed = 0.1;
  if (keys["+"] || keys["="]) dr += radiusSpeed;
  if (keys["-"] || keys["_"]) dr -= radiusSpeed;

  if (dx !== 0 || dz !== 0 || dr !== 0) {
    updateOrbitState(dx, dz, dr);
    updateAudioSynth();
  }

  // 1. FREQUENCY HOTKEYS
  if (keys["1"]) syncFrequencyUI(CONFIG.synth.frequency - 4);
  if (keys["2"]) syncFrequencyUI(CONFIG.synth.frequency + 4);

  // 2. FM INTENSITY HOTKEYS
  if (keys["4"]) syncFmUI(CONFIG.synth.fmIndex - 3);
  if (keys["5"]) syncFmUI(CONFIG.synth.fmIndex + 3);
  
  // 3. FM RATIO HOTKEYS
  if (keys["7"]) syncFmRatioUI(CONFIG.synth.fmRatio - 0.25);
  if (keys["8"]) syncFmRatioUI(CONFIG.synth.fmRatio + 0.25);

  // 4. Y-SCALE PROFILE HOTKEYS
  if (keys["3"]) syncYScaleUI(CONFIG.synth.yScale - 0.1);
  if (keys["6"]) syncYScaleUI(CONFIG.synth.yScale + 0.1);

  // 5. MASTER VOLUME HOTKEYS
  if (keys["0"]) syncVolumeUI(CONFIG.synth.volume - 0.02);
  if (keys["9"]) syncVolumeUI(CONFIG.synth.volume + 0.02);

  // 6. PARAMETER A HOTKEYS (o / p keys)
  if (keys["o"] || keys["O"]) {
    // Calculate the target value, let syncParamAUI handle safe limits update
    const targetA = CONFIG.synth.a - 0.05;
    syncParamAUI(targetA);
  }
  if (keys["p"] || keys["P"]) {
    const targetA = CONFIG.synth.a + 0.05;
    syncParamAUI(targetA);
  }


    // 7. Cycle wave numbers down (-) with Q and up (+) with W
  if (keys["q"] || keys["Q"]) {
    keys["q"] = false; keys["Q"] = false; // Debounce immediate key triggers
    let nextWave = CONFIG.synth.waveNumber - 1;
    if (nextWave < 1) nextWave = 5; // Loop back to the highest wave
    syncWaveUI(nextWave);
  }
  if (keys["w"] || keys["W"]) {
    keys["w"] = false; keys["W"] = false; 
    let nextWave = CONFIG.synth.waveNumber + 1;
    if (nextWave > 5) nextWave = 1; // Loop back to the first wave
    syncWaveUI(nextWave);
  }

}
