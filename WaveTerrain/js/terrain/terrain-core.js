// Pure wave terrain height function. No DOM/canvas dependency on purpose: this file
// is imported by both the audio worklet (audio thread) and the renderer/scope (main
// thread), so it must be safe to load inside an AudioWorkletProcessor module.
//
// What this function IS, musically: a 2D surface z = f(x, z) -- five different
// formulas below, selected by `wave` (1-5, or the default). `a` is a shape parameter
// that distorts each surface (think of it like a extra knob baked into the formula).
// Nothing here is audio-specific by itself: it just returns a height for a given
// (x, z) coordinate. It becomes *sound* when something else (the audio worklet) walks
// a moving point across this surface once per waveform cycle and reads the height off
// as the sample value -- that's the "wave terrain synthesis" technique itself, and it
// happens in js/audio/worklet/terrain-processor.js. This file only holds the terrain
// shapes; it has no idea it's being used for audio.
export function evaluateTerrain(wave, x, z, a) {
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
