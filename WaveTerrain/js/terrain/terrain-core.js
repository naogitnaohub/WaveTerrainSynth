// Wave terrain height function :
// 2D surface z = f(x, z): returns a height given (x, z) coordinates.
// - 5 formulas, selected by `wave` .
// -`a` is a shape parameter that distorts the surface, a as different meaingn in each function
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
