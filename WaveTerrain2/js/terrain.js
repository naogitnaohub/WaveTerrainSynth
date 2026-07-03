export function terrain(wave, x, z, a = 1.5) {
  switch (wave) {
    case 1:  return Math.sin((z * Math.sin(z) - x * Math.sin(x) * Math.log(z * z + 1)) / a);
    case 2:  return (Math.sin(0.8 * x) * Math.cos(0.8 * z) + Math.sin(0.4 * x * z)) * 0.6;
    case 3:  return Math.sin(Math.sin(a * x * z) / (x * z || 0.001));
    default: return (Math.sin(0.8 * x) * Math.cos(0.8 * z) + Math.sin(0.4 * x * z)) * 0.6;
  }
}

function lerp(start, end, amt) {
  return start + (end - start) * amt;
}

const colors = [
  { r: 10,  g: 40,  b: 20  }, 
  { r: 74,  g: 222, b: 128 }, 
  { r: 255, g: 215, b: 0   }, 
  { r: 250, g: 110, b: 40  }  
];

export function getGradientColor(t, lightIntensity = 1.0) {
  t = Math.max(0.0, Math.min(1.0, t));
  let c1, c2, factor;

  if (t < 0.33) {
    c1 = colors[0]; c2 = colors[1]; factor = t * 3.0303;
  } else if (t < 0.66) {
    c1 = colors[1]; c2 = colors[2]; factor = (t - 0.33) * 3.0303;
  } else {
    c1 = colors[2]; c2 = colors[3]; factor = (t - 0.66) * 2.9412;
  }

  // Multiply the RGB channels directly by the precalculated light scaling factor
  const r = Math.floor(Math.max(0, Math.min(255, lerp(c1.r, c2.r, factor) * lightIntensity)));
  const g = Math.floor(Math.max(0, Math.min(255, lerp(c1.g, c2.g, factor) * lightIntensity)));
  const b = Math.floor(Math.max(0, Math.min(255, lerp(c1.b, c2.b, factor) * lightIntensity)));
  return `rgb(${r},${g},${b})`;
}
