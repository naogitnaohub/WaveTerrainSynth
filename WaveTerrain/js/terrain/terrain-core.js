// Wave terrain height function: a 2D surface h = f(x, z). `wave` selects one of
// 15 formulas; `a` is a shape parameter, meaning differs per formula. Shared by
// the audio worklet (per-sample synthesis) and the renderer (mesh + orbit
// ring), so the sound and the visible shape can never drift apart.
//
// Cases 6-15 are built from bounded trig (sin/cos/tanh) or a division whose
// denominator can never reach 0, rather than raw x/z divisions -- unbounded
// division spiked harshly near x=0 or z=0, since the mesh and the audio orbit
// both sweep straight through the origin.
export function evaluateTerrain(wave, x, z, a) {
  switch (wave) {
    case 1: // log-warped cross terms
      return Math.sin((z * Math.sin(z) - x * Math.sin(x) * Math.log(z * z + 1)) / a);
    case 2: // radial ripple, a sets the frequency
      return Math.sin(a/4 * (x * x + z * z));
    case 3: // sinc-like center spike; `|| 0.001` guards divide-by-zero at the origin
      return Math.sin(Math.sin(a * x * z) / (x * z || 0.001));
    case 4: // two cross-modulated sine/cosine pairs, blended 70/30
      return (Math.sin(x * a) * Math.cos(z * a) * 0.7) + (Math.sin(x * 2.3 * a + 1.0) * Math.cos(z * 1.9 * a) * 0.3);
    case 5: { // folded sine: reflects back into range past +-1 instead of clipping
      const r = Math.sin(x * 0.5) * Math.cos(z * 0.5) * a;
      return Math.sin(r > 1.0 ? 2.0 - r : (r < -1.0 ? -2.0 - r : r));
    }
    case 6:
      // Concentric ripples radiating from the origin -- a sets the ring spacing.
      return Math.sin(Math.sqrt(x * x + z * z) * (1.5 + a));
    case 7:
      // Two axis-aligned standing waves beating against each other -- a detunes them.
      return (Math.sin(x * (2 + a)) + Math.sin(z * (2 - a))) * 0.5;
    case 8:
      // A rotating spiral of ridges -- a sets how tightly it winds.
      return Math.sin(Math.atan2(z, x) * (3 + a * 2) + Math.sqrt(x * x + z * z) * 0.5);
    case 9:
      // tanh rounds off sin's sharp zero-crossings into softer, rounder humps.
      return Math.tanh(Math.sin(x * a * 0.5) * Math.cos(z * a * 0.5) * 2);
    case 10:
      // Classic wave-terrain phase modulation: x's wave is pushed around by z's.
      return Math.sin(x * 1.5 + Math.sin(z * (1 + a)) * (2 + a));
    case 11:
      // Diagonal plaid lattice from two cross-modulated sines.
      return (Math.sin(x * a + z) + Math.sin(z * a - x)) * 0.5;
    case 12:
      // A ripple under a soft dome that fades out toward the edges -- the
      // denominator is always >= 1, so it can never reach 0.
      return Math.sin(x * z * 0.3 * a) / (1 + 0.05 * (x * x + z * z));
    case 13: {
      // A rose/petal curve: angular lobes crossed with radial rings.
      const petals = Math.sin(3 * Math.atan2(z, x));
      const rings = Math.sin(Math.sqrt(x * x + z * z) * (1 + Math.abs(a)));
      return petals * rings;
    }
    case 14:
      // The gentlest of the set: a simple saddle from two low-frequency sines.
      return Math.sin(x * 0.5 + a) * Math.cos(z * 0.5 - a);
    case 15:
      // Three layered sine waves at different rates -- a thicker, more organic texture.
      return (Math.sin(x * a) + Math.sin(z * a * 1.5) + Math.sin((x + z) * a * 0.5)) / 3;
    default: // wave 0 / unmapped: a saddle-ripple fallback
      return (Math.sin(a/4 * z * x) + Math.cos(a/4 * (z * z - x * x))) / 2;
  }
}
