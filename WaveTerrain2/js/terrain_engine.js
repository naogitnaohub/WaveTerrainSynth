// Pure, stateless mathematical functions for both UI and Audio threads
export function evaluateTerrain(waveNumber, x, z, a = 1.5) {
  switch (waveNumber) {
    case 1:  
      return Math.sin((z * Math.sin(z) - x * Math.sin(x) * Math.log(z * z + 1)) / a);
    case 2: 
      return (Math.sin(0.8 * x) * Math.cos(0.8 * z) + Math.sin(0.4 * x * z)) * 0.6;
    case 3:  
      return Math.sin(Math.sin(a * x * z) / (x * z || 0.001));
    default: 
      return (Math.sin(0.8 * x) * Math.cos(0.8 * z) + Math.sin(0.4 * x * z)) * 0.6;
  }
}

export function lerp(start, end, amt) {
  return start + (end - start) * amt;
}
