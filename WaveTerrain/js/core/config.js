// The single shared state object for the whole app. Every module that needs to read
// or change a synth/view parameter imports CONFIG directly.
export const CONFIG = {
  RES: 100, SPAN: 16.0,
  synth: { frequency: 80, waveNumber: 2, a: 1.5, yScale: -1.7, lift: -0.07, volume: 0.4, fmIndex: 0.0, fmRatio: 2.0 },
  orbit: { cx: 0.0, cz: 0.0, r: 2.0 },
  view: { angleY: -0.6, angleX: 0.5, zoom: 1.0 },
  style: {
    clearColor: '#0c0b0a', lightDir: { x: -0.4, y: 0.9, z: -0.3 }, ambientShadow: 0.15, lightContrast: 1.35, slopeSharpness: 3.5,
    terrainPalette: [ { r: 10, g: 40, b: 20 }, { r: 74, g: 222, b: 128 }, { r: 255, g: 215, b: 0 }, { r: 250, g: 110, b: 40 } ],
    orbitColor: { r: 1.0, g: 0.0, b: 0.9 }, cursorColor: { r: 0.95, g: 0.25, b: 0.85 }, cursorSize: 0.25
  }
};

// Min max values of sliders/potentiometers
// Exported so ui/input.js build each potentiometer's range from instead of hard copy
export const LIMITS = {
  frequency: { min: 20, max: 800 },    fmIndex: { min: 0, max: 500 },      fmRatio: { min: 0.5, max: 8.0 },
  yScale: { min: -5.0, max: 5.0 },     a: { min: -5.0, max: 15.0 },        volume: { min: 0.0, max: 1.0 },
  waveNumber: { min: 1, max: 5 },      radius: { min: 0.2, max: 6.0 },     cx: { min: -7.2, max: 7.2 }, cz: { min: -7.2, max: 7.2 }
};

// Edit these below to make a control coarser or finer 
export const STEPS = {
  frequency: 1, fmIndex: 1, fmRatio: 0.25, yScale: 0.1, a: 0.05, volume: 0.01, waveNumber: 1,
  // Envelope stage times/level (seconds, except sustain which is a 0..1 level) and LFO
  // rate (Hz) / depth (0..1) -- not CONFIG.synth params
  attack: 0.001, decay: 0.001, sustain: 0.01, release: 0.001,
  lfoRate: 0.05, lfoDepth: 0.01
};

// Clamp `value` into LIMITS[key] (if limit exists) and write it into CONFIG.synth.
// Every slider, hotkey, and MIDI CC handler in the app funnels through this function
// instead of writing to CONFIG.synth directly, so the clamping can't be forgotten.
export function updateSynthParam(key, value) {
  if (key in CONFIG.synth) {
    CONFIG.synth[key] = LIMITS[key] ? Math.max(LIMITS[key].min, Math.min(LIMITS[key].max, value)) : value;
  }
}

// Same for the orbit position/radius: dx/dz/dr are deltas, not absolute values
export function updateOrbitState(dx, dz, dr = 0) {
  const o = CONFIG.orbit;
  o.cx = Math.max(LIMITS.cx.min, Math.min(LIMITS.cx.max, o.cx + dx));
  o.cz = Math.max(LIMITS.cz.min, Math.min(LIMITS.cz.max, o.cz + dz));
  o.r  = Math.max(LIMITS.radius.min, Math.min(LIMITS.radius.max, o.r + dr));
}

// Same clamping, but for setting an absolute orbit position/radius rather than
// nudging it -- used when loading a preset (core/presets.js).
export function setOrbitState(cx, cz, r) {
  const o = CONFIG.orbit;
  o.cx = Math.max(LIMITS.cx.min, Math.min(LIMITS.cx.max, cx));
  o.cz = Math.max(LIMITS.cz.min, Math.min(LIMITS.cz.max, cz));
  o.r  = Math.max(LIMITS.radius.min, Math.min(LIMITS.radius.max, r));
}
