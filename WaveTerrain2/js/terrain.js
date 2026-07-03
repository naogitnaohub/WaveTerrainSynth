import { CONFIG } from './config.js';

export function terrain(wave, x, z, a = 1.5) {
  switch (wave) {
    // 1. Your original log valley equation
    case 1:  
      return Math.sin((z * Math.sin(z) - x * Math.sin(x) * Math.log(z * z + 1)) / a);
    
    // 2. Processing Sync: Concentric ripple rings
    case 2:  
      return Math.sin(a * (x * x + z * z));
    
    // 3. Processing Sync: Sinc-modulated grid fold
    case 3:  
      return Math.sin(Math.sin(a * x * z) / (x * z || 0.001));
    
    // 4. NEW: Fractal Noise Lattice (Perfect for lush, evolving vowel pads)
    case 4: {
      const f1 = Math.sin(x * a) * Math.cos(z * a);
      const f2 = Math.sin(x * 2.3 * a + 1.0) * Math.cos(z * 1.9 * a);
      return (f1 * 0.7 + f2 * 0.3);
    }
    
    // 5. NEW: Hard-Clipping Fold Hyper-Cradles (Extreme metallic industrial textures)
    case 5: {
      const raw = Math.sin(x * 0.5) * Math.cos(z * 0.5) * a;
      // Truncates and mirrors values exceeding safe mathematical thresholds
      return Math.sin(raw > 1.0 ? 2.0 - raw : (raw < -1.0 ? -2.0 - raw : raw));
    }

    // Default Fallback: Processing cross-phase blend function
    default: 
      return (Math.sin(a * z * x) + Math.cos(a * (z * z - x * x))) / 2;
  }
}

export function lerp(start, end, amt) {
  return start + (end - start) * amt;
}

export function getGradientColor(t, lightIntensity = 1.0) {
  t = Math.max(0.0, Math.min(1.0, t));
  let c1, c2, factor;
  
  const palette = CONFIG.style.terrainPalette;

  if (t < 0.33) { 
    c1 = palette[0]; c2 = palette[1]; factor = t * 3.0303; 
  } else if (t < 0.66) { 
    c1 = palette[1]; c2 = palette[2]; factor = (t - 0.33) * 3.0303; 
  } else { 
    c1 = palette[2]; c2 = palette[3]; factor = (t - 0.66) * 2.9412; 
  }

  const r = Math.floor(Math.max(0, Math.min(255, lerp(c1.r, c2.r, factor) * lightIntensity)));
  const g = Math.floor(Math.max(0, Math.min(255, lerp(c1.g, c2.g, factor) * lightIntensity)));
  const b = Math.floor(Math.max(0, Math.min(255, lerp(c1.b, c2.b, factor) * lightIntensity)));
  return `rgb(${r},${g},${b})`;
}
