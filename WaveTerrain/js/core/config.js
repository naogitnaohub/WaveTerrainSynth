// Shared app state: CONFIG (synth/orbit/view/style params), LIMITS (min/max per
// param), STEPS (slider/pot increment per param). Every module imports CONFIG
// directly and reads/writes it


const PINK = { r: 196, g: 18, b: 110 };

// Normalize rgb to webgl standard (WebGL/canvas color APIs expect value [0,1])
const normalize = c => ({ r: c.r / 255, g: c.g / 255, b: c.b / 255 });

const brighten = c => { const m = 255 / Math.max(c.r, c.g, c.b, 1); return normalize({ r: c.r * m, g: c.g * m, b: c.b * m }); };

// The single shared state object for the whole app.
export const CONFIG = {
  RES: 100, SPAN: 20.0, // terrain mesh resolution (RES x RES points) and world-space size
  synth: { frequency: 40, waveNumber: 1, a: 1.5, yScale: -1.7, lift: -0.07, volume: 0.4, fmInt: 0.0, fmRatio: 2.0 },
  orbit: { cx: 0.0, cz: 0.0, r: 2.0 },
  view: { angleY: -0.6, angleX: 0.5, zoom: 1.0 }, // camera orbit angles + zoom
  style: {
    clearColor: '#0c0b0a', lightDir: { x: -0.4, y: 0.9, z: -0.3 }, ambientShadow: 0.15, lightContrast: 1.35, slopeSharpness: 3.5,
    terrainPalette: [ { r: 10, g: 40, b: 20 }, { r: 74, g: 222, b: 128 }, { r: 255, g: 215, b: 0 }, { r: 250, g: 110, b: 40 } ],
    pink: PINK, orbitColor: brighten(PINK), cursorColor: normalize(PINK), cursorSize: 0.25
  }
};


document.documentElement.style.setProperty('--pink', `${PINK.r}, ${PINK.g}, ${PINK.b}`);

// Min/max per parameter, exported so ui/input.js can build each potentiometer's from their value here
export const LIMITS = {
  frequency: { min: 20, max: 800 },    fmInt: { min: 0, max: 500 },      fmRatio: { min: -0.5, max: 6.0 },
  yScale: { min: -5.0, max: 5.0 },     a: { min: -2.0, max: 2.0 },         volume: { min: 0.0, max: 1.0 },
  waveNumber: { min: 1, max: 15 },     radius: { min: 0.2, max: 6.0 },     cx: { min: -7.2, max: 7.2 }, cz: { min: -7.2, max: 7.2 }
};

// Increment for each control
export const STEPS = {
  frequency: 1, fmInt: 3.0, fmRatio: 0.05, yScale: 0.8, a: 0.03, volume: 0.01, waveNumber: 1,
  attack: 0.001, decay: 0.001, sustain: 0.01, release: 0.001, // all [sec] except sustain is level [0, 1]
  lfoRate: 0.02, lfoDepth: 0.01 // rate [Hz], depth [0,1]
};

// Clamps value into LIMITS[key] and writes it into CONFIG.synth. Every input
// path (slider, hotkey, MIDI CC) goes through this instead of writing
// CONFIG.synth directly, so clamping can never be skipped.
export function updateSynthParam(key, value) {
  if (key in CONFIG.synth) {
    CONFIG.synth[key] = LIMITS[key] ? Math.max(LIMITS[key].min, Math.min(LIMITS[key].max, value)) : value;
  }
}

// Same clamping, for the orbit. dx/dz/dr are deltas added to the current value,
// not absolute values.
export function updateOrbitState(dx, dz, dr = 0) {
  const o = CONFIG.orbit;
  o.cx = Math.max(LIMITS.cx.min, Math.min(LIMITS.cx.max, o.cx + dx));
  o.cz = Math.max(LIMITS.cz.min, Math.min(LIMITS.cz.max, o.cz + dz));
  o.r  = Math.max(LIMITS.radius.min, Math.min(LIMITS.radius.max, o.r + dr));
}

// Same clamping, but sets an absolute orbit position/radius -- used when a
// preset loads (core/presets.js).
export function setOrbitState(cx, cz, r) {
  const o = CONFIG.orbit;
  o.cx = Math.max(LIMITS.cx.min, Math.min(LIMITS.cx.max, cx));
  o.cz = Math.max(LIMITS.cz.min, Math.min(LIMITS.cz.max, cz));
  o.r  = Math.max(LIMITS.radius.min, Math.min(LIMITS.radius.max, r));
}
