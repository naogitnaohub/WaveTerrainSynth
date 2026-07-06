import { CONFIG } from './config.js';

/**
 * Wave terrain equation engine - optimised evaluation mapping
 */
export function terrain(wave, x, z, a = 1.5) {
  switch (wave) {
    case 1: 
      return Math.sin((z * Math.sin(z) - x * Math.sin(x) * Math.log(z * z + 1)) / a);
    case 2: 
      return Math.sin(a * (x * x + z * z));
    case 3: 
      return Math.sin(Math.sin(a * x * z) / (x * z || 0.001));
    case 4: 
      return (Math.sin(x * a) * Math.cos(z * a) * 0.7) + (Math.sin(x * 2.3 * a + 1.0) * Math.cos(z * 1.9 * a) * 0.3);
    case 5: {
      const r = Math.sin(x * 0.5) * Math.cos(z * 0.5) * a;
      return Math.sin(r > 1.0 ? 2.0 - r : (r < -1.0 ? -2.0 - r : r));
    }
    default: 
      return (Math.sin(a * z * x) + Math.cos(a * (z * z - x * x))) / 2;
  }
}

export function lerp(start, end, amt) {
  return start + (end - start) * amt;
}

/**
 * Cached vector conversion layer for hardware-accelerated vertex shading
 */
export function getGradientColor(t, lightIntensity = 1.0) {
  t = t < 0.0 ? 0.0 : (t > 1.0 ? 1.0 : t);
  const palette = CONFIG.style.terrainPalette;
  
  let c1 = palette[0], c2 = palette[1], factor = t * 3.0303;
  if (t >= 0.33 && t < 0.66) { 
    c1 = palette[1]; c2 = palette[2]; factor = (t - 0.33) * 3.0303; 
  } else if (t >= 0.66) { 
    c1 = palette[2]; c2 = palette[3]; factor = (t - 0.66) * 2.9412; 
  }

  const r = Math.floor(lerp(c1.r, c2.r, factor) * lightIntensity);
  const g = Math.floor(lerp(c1.g, c2.g, factor) * lightIntensity);
  const b = Math.floor(lerp(c1.b, c2.b, factor) * lightIntensity);

  // Return formatted parsing token strings explicitly guarded to [0 - 255] thresholds
  return `rgb(${r < 0 ? 0 : (r > 255 ? 255 : r)},${g < 0 ? 0 : (g > 255 ? 255 : g)},${b < 0 ? 0 : (b > 255 ? 255 : b)})`;
}
