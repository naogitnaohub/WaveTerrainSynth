import { CONFIG } from './config.js';
import { terrain, getGradientColor } from './terrain.js';

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

// Dynamic sizing vectors
let step, half;
let heightGrid, shadingGrid;
let px, py;

const LIGHT_DIR = { x: -0.4, y: 0.9, z: -0.3 };
const mag = Math.sqrt(LIGHT_DIR.x * LIGHT_DIR.x + LIGHT_DIR.y * LIGHT_DIR.y + LIGHT_DIR.z * LIGHT_DIR.z);
LIGHT_DIR.x /= mag; LIGHT_DIR.y /= mag; LIGHT_DIR.z /= mag;

export function initRenderer() {
  step = CONFIG.SPAN / (CONFIG.RES - 1);
  half = CONFIG.SPAN * 0.5;

  heightGrid = new Float32Array(CONFIG.RES * CONFIG.RES);
  shadingGrid = new Float32Array(CONFIG.RES * CONFIG.RES);
  px = new Float32Array(CONFIG.RES * CONFIG.RES);
  py = new Float32Array(CONFIG.RES * CONFIG.RES);

  computeHeightsAndShading();

  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);
}

export function rebuildTerrainMesh() {
  if (heightGrid.length !== CONFIG.RES * CONFIG.RES) {
    initRenderer();
  } else {
    computeHeightsAndShading();
  }
}

function computeHeightsAndShading() {
  for (let j = 0; j < CONFIG.RES; j++) {
    const z = -half + j * step;
    const offset = j * CONFIG.RES;
    for (let i = 0; i < CONFIG.RES; i++) {
      const x = -half + i * step;
      heightGrid[offset + i] = terrain(CONFIG.synth.waveNumber, x, z, CONFIG.synth.a);
    }
  }

  for (let j = 0; j < CONFIG.RES; j++) {
    const offset = j * CONFIG.RES;
    for (let i = 0; i < CONFIG.RES; i++) {
      const hL = heightGrid[offset + Math.max(0, i - 1)];
      const hR = heightGrid[offset + Math.min(CONFIG.RES - 1, i + 1)];
      const hD = heightGrid[Math.max(0, j - 1) * CONFIG.RES + i];
      const hU = heightGrid[Math.min(CONFIG.RES - 1, j + 1) * CONFIG.RES + i];

      const slopeX = ((hR - hL) / (2 * step)) * 3.5;
      const slopeZ = ((hU - hD) / (2 * step)) * 3.5;

      let nx = -slopeX, ny = 1.0, nz = -slopeZ;
      const nMag = Math.sqrt(nx * nx + ny * ny + nz * nz);
      nx /= nMag; ny /= nMag; nz /= nMag;

      const dot = nx * LIGHT_DIR.x + ny * LIGHT_DIR.y + nz * LIGHT_DIR.z;
      shadingGrid[offset + i] = 0.15 + Math.max(0, dot) * 1.35;
    }
  }
}

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

export function drawTerrain() {
  const cosY = Math.cos(CONFIG.view.angleY), sinY = Math.sin(CONFIG.view.angleY);
  const cosX = Math.cos(CONFIG.view.angleX), sinX = Math.sin(CONFIG.view.angleX);
  
  const baseScale = Math.min(canvas.width, canvas.height) * 0.045;
  const currentScale = baseScale * CONFIG.view.zoom;
  const centerX = canvas.width * 0.5;
  const centerY = canvas.height * 0.5;

  // 1. Single-pass linear node transformations
  for (let j = 0; j < CONFIG.RES; j++) {
    const z = -half + j * step;
    const offset = j * CONFIG.RES;
    for (let i = 0; i < CONFIG.RES; i++) {
      const x = -half + i * step;
      const h = heightGrid[offset + i] * CONFIG.synth.yScale;

      const x1 = x * cosY - z * sinY;
      const z1 = x * sinY + z * cosY;
      const y2 = h * cosX - z1 * sinX;

      px[offset + i] = centerX + x1 * currentScale;
      py[offset + i] = centerY + y2 * currentScale;
    }
  }

  // 2. Resolve view tracking directions
  const reverseI = (cosY - sinY) > 0;
  const reverseJ = (sinY + cosY) > 0;

  const iStart = reverseI ? CONFIG.RES - 2 : 0;
  const iEnd = reverseI ? -1 : CONFIG.RES - 1;
  const iStep = reverseI ? -1 : 1;

  const jStart = reverseJ ? CONFIG.RES - 2 : 0;
  const jEnd = reverseJ ? -1 : CONFIG.RES - 1;
  const jStep = reverseJ ? -1 : 1;

  // 3. Optimized Solid Fill Loop (Zero stroke lines overhead)
  for (let j = jStart; j !== jEnd; j += jStep) {
    for (let i = iStart; i !== iEnd; i += iStep) {
      const idx00 = j * CONFIG.RES + i;
      const idx10 = idx00 + 1;
      const idx01 = idx00 + CONFIG.RES;
      const idx11 = idx01 + 1;

      const avgH = (heightGrid[idx00] + heightGrid[idx10] + heightGrid[idx01] + heightGrid[idx11]) * 0.25;
      const avgLight = (shadingGrid[idx00] + shadingGrid[idx10] + shadingGrid[idx01] + shadingGrid[idx11]) * 0.25;
      
      ctx.fillStyle = getGradientColor((avgH + 1.0) * 0.5, avgLight);
      
      ctx.beginPath();
      ctx.moveTo(px[idx00], py[idx00]);
      ctx.lineTo(px[idx10], py[idx10]);
      ctx.lineTo(px[idx11], py[idx11]);
      ctx.lineTo(px[idx01], py[idx01]);
      ctx.closePath();
      ctx.fill(); // Paints the solid liquid polygons directly
    }
  }
}

export function drawOrbit(phase) {
  const N = 64; 
  const cosY = Math.cos(CONFIG.view.angleY), sinY = Math.sin(CONFIG.view.angleY);
  const cosX = Math.cos(CONFIG.view.angleX), sinX = Math.sin(CONFIG.view.angleX);
  
  const baseScale = Math.min(canvas.width, canvas.height) * 0.045;
  const currentScale = baseScale * CONFIG.view.zoom;
  const centerX = canvas.width * 0.5;
  const centerY = canvas.height * 0.5;

  ctx.strokeStyle = "#ffffff"; 
  ctx.lineWidth = 4.0;
  ctx.beginPath();

  for (let i = 0; i <= N; i++) {
    const t = (i / N) * 6.283185; 
    const ox = CONFIG.orbit.cx + CONFIG.orbit.r * Math.cos(t);
    const oz = CONFIG.orbit.cz + CONFIG.orbit.r * Math.sin(t);
    const oy = terrain(CONFIG.synth.waveNumber, ox, oz, CONFIG.synth.a) * CONFIG.synth.yScale + CONFIG.synth.lift;

    const x1 = ox * cosY - oz * sinY;
    const z1 = ox * sinY + oz * cosY;
    const y2 = oy * cosX - z1 * sinX;

    const sx = centerX + x1 * currentScale;
    const sy = centerY + y2 * currentScale;

    if (i === 0) ctx.moveTo(sx, sy);
    else ctx.lineTo(sx, sy);
  }
  ctx.stroke();

  const pxCursor = CONFIG.orbit.cx + CONFIG.orbit.r * Math.cos(phase);
  const pzCursor = CONFIG.orbit.cz + CONFIG.orbit.r * Math.sin(phase);
  const pyCursor = terrain(CONFIG.synth.waveNumber, pxCursor, pzCursor, CONFIG.synth.a) * CONFIG.synth.yScale + CONFIG.synth.lift;

  const cx1 = pxCursor * cosY - pzCursor * sinY;
  const cz1 = pxCursor * sinY + pzCursor * cosY;
  const cy2 = pyCursor * cosX - cz1 * sinX;

  ctx.fillStyle = "#c864ec";
  ctx.beginPath();
  ctx.arc(centerX + cx1 * currentScale, centerY + cy2 * currentScale, 7, 0, 6.283185);
  ctx.fill();
}

export function clearCanvas() {
  ctx.fillStyle = "#0c0b0a"; 
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}
