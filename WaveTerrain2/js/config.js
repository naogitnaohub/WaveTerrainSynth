export const CONFIG = {
  RES: 100,             
  SPAN: 16.0,           

  synth: {
    frequency: 80,
    waveNumber: 2,
    a: 1.5,
    yScale: -1.7,
    lift: -0.07,
    volume: 0.4,
    fmIndex: 0.0,
    fmRatio: 2.0,
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
  },

  style: {
    clearColor: '#0c0b0a',
    lightDir: { x: -0.4, y: 0.9, z: -0.3 },
    ambientShadow: 0.15,
    lightContrast: 1.35,
    slopeSharpness: 3.5,

    terrainPalette: [
      { r: 10,  g: 40,  b: 20  },  
      { r: 74,  g: 222, b: 128 },  
      { r: 255, g: 215, b: 0   },  
      { r: 250, g: 110, b: 40  }   
    ],

    orbitColor: { r: 1.0, g: 0.0, b: 0.9 }, 
    cursorColor: { r: 0.95, g: 0.25, b: 0.85 }, 
    cursorSize: 0.25
  }
};

const LIMITS = {
  frequency: { min: 20, max: 800 },
  fmIndex: { min: 0, max: 500 },
  fmRatio: { min: 0.5, max: 8.0 },
  yScale: { min: -5.0, max: 5.0 },
  a: { min: -5.0, max: 15.0 },
  volume: { min: 0.0, max: 1.0 },
  waveNumber: { min: 1, max: 5 },
  radius: { min: 0.2, max: 6.0 },
  cx: { min: -7.2, max: 7.2 },
  cz: { min: -7.2, max: 7.2 }
};

// BULLETPROOFED: Explicitly clamps and forces your value back to the wall if keys overflow it
export function updateSynthParam(key, value) {
  if (key in CONFIG.synth) {
    if (LIMITS[key]) {
      // Clamps the values strictly between your min and max config boundaries
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
