import { CONFIG, updateSynthParam, updateOrbitState } from './config.js';
import { updateAudioSynth, updateAudioWaveform } from './audio.js';
import { rebuildTerrainMesh } from './renderer.js';

const keys = {}, mouse = { x: 0, y: 0 };
let isDragging = false;

// Unified slider configuration maps mapping DOM IDs to keys, formatters, and optional update callbacks
const UI_MAP = {
  "wave-select":   { p: 'waveNumber', f: v => `Wave Selection: Wave ${v}`,       cb: v => { rebuildTerrainMesh(); updateAudioWaveform(v); } },
  "y-scale":       { p: 'yScale',     f: v => `Y-Scale Profile: ${v.toFixed(1)}` },
  "param-a":       { p: 'a',          f: v => `Wave Shape (a): ${v.toFixed(2)}`, cb: () => rebuildTerrainMesh() },
  "volume":        { p: 'volume',     f: v => `Master Volume: ${~~(v * 100)}%` },
  "fm-index":      { p: 'fmIndex',    f: v => `FM Intensity: ${~~v}` },
  "fm-ratio":      { p: 'fmRatio',    f: v => `FM Ratio: ${v.toFixed(2)}` },
  "freq":          { p: 'frequency',  f: v => `Frequency: ${~~v} Hz` }
};

// Generic UI Synchronization Engine
export function syncUI(id, val) {
  const cfg = UI_MAP[id];
  if (!cfg) return;
  updateSynthParam(cfg.p, val);
  const actualVal = CONFIG.synth[cfg.p], el = document.getElementById(id), disp = document.getElementById(cfg.f.id || (cfg.f.id = id === 'freq' ? 'freq-display' : id === 'wave-select' ? 'wave-display' : `${id}-display`));
  if (el) el.value = actualVal;
  if (disp) disp.textContent = cfg.f(actualVal);
  if (cfg.cb) cfg.cb(actualVal);
  updateAudioSynth();
}

// Shortcuts for backward compatibility or module exports
export const syncWaveUI = v => syncUI("wave-select", v);
export const syncYScaleUI = v => syncUI("y-scale", v);
export const syncParamAUI = v => syncUI("param-a", v);
export const syncVolumeUI = v => syncUI("volume", v);
export const syncFmUI = v => syncUI("fm-index", v);
export const syncFmRatioUI = v => syncUI("fm-ratio", v);
export const syncFrequencyUI = v => syncUI("freq", v);

export function initInputHandlers() {
  const win = window;
  win.addEventListener("keydown", e => keys[e.key] = true);
  win.addEventListener("keyup", e => keys[e.key] = false);
  win.addEventListener("mousedown", e => e.target.id === "canvas" && (isDragging = true, mouse.x = e.clientX, mouse.y = e.clientY));
  win.addEventListener("mouseup", () => isDragging = false);
  
  win.addEventListener("mousemove", e => {
    if (!isDragging) return;
    CONFIG.view.angleY += (e.clientX - mouse.x) * 0.007;
    CONFIG.view.angleX += (e.clientY - mouse.y) * 0.007;
    mouse.x = e.clientX; mouse.y = e.clientY;
  });

  win.addEventListener("wheel", e => {
    if (e.target.id === "canvas") e.preventDefault(), CONFIG.view.zoom = Math.max(0.4, Math.min(2.5, CONFIG.view.zoom + (e.deltaY < 0 ? 0.08 : -0.08)));
  }, { passive: false });

  // Dynamically initialize all HTML input listeners out of the map definition
  Object.keys(UI_MAP).forEach(id => {
    const el = document.getElementById(id);
    if (el) el.oninput = function() { syncUI(id, parseFloat(this.value)); };
  });
}

export function processInputs() {
  let dx = 0, dz = 0, dr = 0, sy = CONFIG.synth;
  if (keys["ArrowUp"]) dz -= 0.28;    if (keys["ArrowDown"]) dz += 0.28;
  if (keys["ArrowLeft"]) dx -= 0.28;  if (keys["ArrowRight"]) dx += 0.28;
  if (keys["+"] || keys["="]) dr += 0.1; if (keys["-"] || keys["_"]) dr -= 0.1;

  if (dx || dz || dr) updateOrbitState(dx, dz, dr), updateAudioSynth();

  // Unified Hotkey Evaluation Table
  if (keys["1"]) syncUI("freq", sy.frequency - 4);     if (keys["2"]) syncUI("freq", sy.frequency + 4);
  if (keys["4"]) syncUI("fm-index", sy.fmIndex - 3);   if (keys["5"]) syncUI("fm-index", sy.fmIndex + 3);
  if (keys["7"]) syncUI("fm-ratio", sy.fmRatio - 0.25);if (keys["8"]) syncUI("fm-ratio", sy.fmRatio + 0.25);
  if (keys["3"]) syncUI("y-scale", sy.yScale - 0.1);   if (keys["6"]) syncUI("y-scale", sy.yScale + 0.1);
  if (keys["0"]) syncUI("volume", sy.volume - 0.02);   if (keys["9"]) syncUI("volume", sy.volume + 0.02);
  if (keys["o"] || keys["O"]) syncUI("param-a", sy.a - 0.05);
  if (keys["p"] || keys["P"]) syncUI("param-a", sy.a + 0.05);

  if (keys["q"] || keys["Q"]) { keys["q"] = keys["Q"] = false; syncUI("wave-select", sy.waveNumber === 1 ? 5 : sy.waveNumber - 1); }
  if (keys["w"] || keys["W"]) { keys["w"] = keys["W"] = false; syncUI("wave-select", sy.waveNumber === 5 ? 1 : sy.waveNumber + 1); }
}
