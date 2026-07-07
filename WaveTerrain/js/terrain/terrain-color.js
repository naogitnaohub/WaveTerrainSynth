// Visual-only helpers (main thread rendering). Kept separate from terrain-core.js
// because the audio worklet never needs colors — only the height function.
import { CONFIG } from '../core/config.js';

// Linear interpolation: at amt=0 returns start, at amt=1 returns end, in between a
// proportional blend. The standard building block for any kind of "fade from A to B".
export function lerp(start, end, amt) {
  return start + (end - start) * amt;
}

// Maps a terrain height (normalized to 0..1 via `t`) to an RGB color string, by
// blending across the 4-color palette in CONFIG.style.terrainPalette: low points are
// palette[0], mid-low is palette[1], mid-high is palette[2], peaks are palette[3].
// `lightIntensity` (0..~1.5) additionally darkens/brightens the result to fake
// directional lighting -- see the normal-vector calculation in renderer.js.
export function getGradientColor(t, lightIntensity = 1.0) {
  t = t < 0.0 ? 0.0 : (t > 1.0 ? 1.0 : t);
  const palette = CONFIG.style.terrainPalette;

  // Split the 0..1 range into three thirds, each interpolating between one adjacent
  // pair of palette colors (0->1, 1->2, or 2->3). `factor` is that pair's local 0..1
  // position; the odd constants (3.0303, 2.9412) just rescale a 0.33-wide slice back
  // up to a full 0..1 range (1 / 0.33 and 1 / 0.34).
  let c1 = palette[0], c2 = palette[1], factor = t * 3.0303;
  if (t >= 0.33 && t < 0.66) {
    c1 = palette[1]; c2 = palette[2]; factor = (t - 0.33) * 3.0303;
  } else if (t >= 0.66) {
    c1 = palette[2]; c2 = palette[3]; factor = (t - 0.66) * 2.9412;
  }

  const r = Math.floor(lerp(c1.r, c2.r, factor) * lightIntensity);
  const g = Math.floor(lerp(c1.g, c2.g, factor) * lightIntensity);
  const b = Math.floor(lerp(c1.b, c2.b, factor) * lightIntensity);

  return `rgb(${r < 0 ? 0 : (r > 255 ? 255 : r)},${g < 0 ? 0 : (g > 255 ? 255 : g)},${b < 0 ? 0 : (b > 255 ? 255 : b)})`;
}
