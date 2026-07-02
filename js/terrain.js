// =====  =====
export const RES = 40;          
export const SPAN = 16.0;       
export const YSCALE = -1.7;     
export const LIFT = -0.07;      
export const BLOCK_BOTTOM = 3.5; // Depth position for the solid base material

export let waveNumber = 2;      
export let a = 1.5;             

export const view = {
  angleY: -0.6,                 
  angleX: 0.5,                  
  zoom: 1.0                     
};

export const orbitState = {
  cx: 0,
  cz: 0,
  r: 2.0
};

const colors = [
  { r: 10,  g: 40,  b: 20  }, 
  { r: 74,  g: 222, b: 128 }, 
  { r: 255, g: 215, b: 0   }, 
  { r: 250, g: 110, b: 40  }  
];


export function terrain(wave, x, z) {
  switch (wave) {
    case 1:  return Math.sin((z * Math.sin(z) - x * Math.sin(x) * Math.log(z * z + 1)) / a);
  
    case 2: return (Math.sin(0.8 * x) * Math.cos(0.8 * z) + Math.sin(0.4 * x * z)) * 0.6;

    case 3:  return Math.sin(Math.sin(a * x * z) / (x * z || 0.001));
    default: return (Math.sin(0.8 * x) * Math.cos(0.8 * z) + Math.sin(0.4 * x * z)) * 0.6;
  }
}

function lerp(start, end, amt) {
  return start + (end - start) * amt;
}

export function getGradientColor(t) {
  t = Math.max(0.0, Math.min(1.0, t));
  let c1, c2, factor;

  if (t < 0.33) {
    c1 = colors[0]; c2 = colors[1]; factor = t * 3.0303;
  } else if (t < 0.66) {
    c1 = colors[1]; c2 = colors[2]; factor = (t - 0.33) * 3.0303;
  } else {
    c1 = colors[2]; c2 = colors[3]; factor = (t - 0.66) * 2.9412;
  }

  const r = Math.floor(lerp(c1.r, c2.r, factor));
  const g = Math.floor(lerp(c1.g, c2.g, factor));
  const b = Math.floor(lerp(c1.b, c2.b, factor));
  return `rgb(${r},${g},${b})`;
}
