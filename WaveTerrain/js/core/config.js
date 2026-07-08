// The single shared state object for the whole app. Every module that needs to read
// or change a synth/view parameter imports CONFIG directly and mutates it in place --
// there's no event system, no framework state management, just one plain object.
// This is fine at this project's scale, but it's why updateSynthParam() below exists:
// it's the *one* place that enforces "don't let a value go out of its musically/
// visually sane range", so that guarantee doesn't have to be re-implemented at every
// call site (every slider, every MIDI CC, every hotkey).
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

// Sane min/max for each synth parameter (musically or numerically -- e.g. `a` going
// too negative just breaks the terrain math, it doesn't sound "more extreme").
// Exported so ui/input.js can build each potentiometer's range from this one table
// instead of a second hardcoded copy.
export const LIMITS = {
  frequency: { min: 20, max: 800 },    fmIndex: { min: 0, max: 500 },      fmRatio: { min: 0.5, max: 8.0 },
  yScale: { min: -5.0, max: 5.0 },     a: { min: -5.0, max: 15.0 },        volume: { min: 0.0, max: 1.0 },
  waveNumber: { min: 1, max: 5 },      radius: { min: 0.2, max: 6.0 },     cx: { min: -7.2, max: 7.2 }, cz: { min: -7.2, max: 7.2 }
};

// How much each fader moves per step (mouse-drag snap granularity + keyboard-arrow
// nudge size). Edit these directly to make a control coarser or finer -- this is the
// one place to do it; nothing else in the app hardcodes a step size. `ui/precision-
// mode.js`'s fine-mode toggle further divides whichever of these is active by its own
// factor, it doesn't replace this table.
export const STEPS = {
  frequency: 1, fmIndex: 1, fmRatio: 0.25, yScale: 0.1, a: 0.05, volume: 0.01, waveNumber: 1,
  // Envelope stage times/level (seconds, except sustain which is a 0..1 level) and LFO
  // rate (Hz) / depth (0..1) -- not CONFIG.synth params, but kept in the same table
  // since they're the same kind of "how precise should this fader be" decision.
  attack: 0.001, decay: 0.001, sustain: 0.01, release: 0.001,
  lfoRate: 0.05, lfoDepth: 0.01
};

// Clamp `value` into LIMITS[key] (if a limit exists) and write it into CONFIG.synth.
// Every slider, hotkey, and MIDI CC handler in the app funnels through this function
// instead of writing to CONFIG.synth directly, so the clamping can't be forgotten.
export function updateSynthParam(key, value) {
  if (key in CONFIG.synth) {
    CONFIG.synth[key] = LIMITS[key] ? Math.max(LIMITS[key].min, Math.min(LIMITS[key].max, value)) : value;
  }
}

// Same idea, but for the orbit position/radius: dx/dz/dr are *deltas* (how much to
// move), not absolute values -- used by the arrow-key/+-  hotkeys in ui/input.js.
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
