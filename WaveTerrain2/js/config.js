export const CONFIG = {
  RES: 100,
  SPAN: 16.0,
  BLOCK_BOTTOM: 3.5,

  synth: {
    frequency: 80,
    waveNumber: 2,
    a: 1.5,
    yScale: -1.7,
    lift: -0.07,
    volume: 0.4,
    fmIndex: 0.0
  },

  orbit: {
    cx: 0.0,
    cz: 0.0,
    r: 2.0
  },

  view: {
    angleY: -0.6,
    angleX: 0.5,
    zoom: 1.0
  }
};

const LIMITS = {
  frequency: { min: 40, max: 800 },
  fmIndex: { min: 0, max: 500 },
  yScale: { min: -5.0, max: 5.0 },
  volume: { min: 0.0, max: 1.0 },
  waveNumber: { min: 1, max: 3 },
  radius: { min: 0.2, max: 6.0 },
  cx: { min: -16.0 * 0.45, max: 16.0 * 0.45 },
  cz: { min: -16.0 * 0.45, max: 16.0 * 0.45 }
};

export function updateSynthParam(key, value) {
  if (key in CONFIG.synth) {
    if (LIMITS[key]) {
      CONFIG.synth[key] = Math.max(LIMITS[key].min, Math.min(LIMITS[key].max, value));
    } else {
      CONFIG.synth[key] = value;
    }
  }
}

export function updateOrbitState(dx, dz, dr = 0) {
  CONFIG.orbit.cx = Math.max(LIMITS.cx.min, Math.min(LIMITS.cx.max, CONFIG.orbit.cx + dx));
  CONFIG.orbit.cz = Math.max(LIMITS.cz.min, Math.min(LIMITS.cz.max, CONFIG.orbit.cz + dz));
  CONFIG.orbit.r  = Math.max(LIMITS.radius.min, Math.min(LIMITS.radius.max, CONFIG.orbit.r + dr));
}
