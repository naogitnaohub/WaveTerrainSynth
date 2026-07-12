// Color mapping for the terrain mesh (render thread only). Separate from
// terrain-core.js because the audio workel only needs height.
import { CONFIG } from '../core/config.js';

// Linear interpolation: amt=0 returns start, amt=1 returns end, in between blends.
export function lerp(start, end, amt) {
  return start + (end - start) * amt;
}

// Maps t (0..1) to an RGB color string by blending across the 4-color palette
// in CONFIG.style.terrainPalette: t=0 -> palette[0] (low points), t=1 ->
// palette[3] (peaks). 
// Called from renderer.js with t = normalized terrain height, and 
// lightIntensity = fake directional lighting (see the normal-vector
// calculation )
export function getGradientColor(t, lightIntensity = 1.0) {
  t = t < 0.0 ? 0.0 : (t > 1.0 ? 1.0 : t); // clamp to 0..1
  const palette = CONFIG.style.terrainPalette;

  // Splits 0..1 into 3 x 1/3, each blending one neighbout palette pair
  // (0->1, 1->2, or 2->3). `factor` is that pair's local 0..1 position; 3.0303
  // and 2.9412 rescale a 0.33-wide slice back up to a full 0..1 range (1/0.33, 1/0.34).
  let c1 = palette[0], c2 = palette[1], factor = t * 3.0303;
  if (t >= 0.33 && t < 0.66) {
    c1 = palette[1]; c2 = palette[2]; factor = (t - 0.33) * 3.0303;
  } else if (t >= 0.66) {
    c1 = palette[2]; c2 = palette[3]; factor = (t - 0.66) * 2.9412;
  }

  const r = Math.floor(lerp(c1.r, c2.r, factor) * lightIntensity);
  const g = Math.floor(lerp(c1.g, c2.g, factor) * lightIntensity);
  const b = Math.floor(lerp(c1.b, c2.b, factor) * lightIntensity);

  // Clamp each channel to a valid 0-255 byte before building the color string
  return `rgb(${r < 0 ? 0 : (r > 255 ? 255 : r)},${g < 0 ? 0 : (g > 255 ? 255 : g)},${b < 0 ? 0 : (b > 255 ? 255 : b)})`;
}
