import { 
  RES, SPAN, YSCALE, LIFT, waveNumber, view, terrain, getGradientColor 
} from './terrain.js';
import { orbitState } from './orbit.js';

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

// Constants & Layout parameters
const step = SPAN / (RES - 1);
const half = SPAN * 0.5;
const NUM_CELLS = (RES - 1) * (RES - 1);

// High-performance flat memory buffers (Eliminates GC thrashing)
const heightGrid = new Float32Array(RES * RES);
const cellIndices = new Uint16Array(NUM_CELLS);
const cellDepths = new Float32Array(NUM_CELLS);

// Precomputed world coordinates for cell vertices
const cellX0 = new Float32Array(NUM_CELLS);
const cellX1 = new Float32Array(NUM_CELLS);
const cellZ0 = new Float32Array(NUM_CELLS);
const cellZ1 = new Float32Array(NUM_CELLS);
const cellGridI = new Uint8Array(NUM_CELLS);
const cellGridJ = new Uint8Array(NUM_CELLS);

// Screen coordinate projection cache
const px = new Float32Array(RES * RES);
const py = new Float32Array(RES * RES);

export function initRenderer() {
  // Precompute static terrain heights grid
  for (let j = 0; j < RES; j++) {
    const z = -half + j * step;
    const offset = j * RES;
    for (let i = 0; i < RES; i++) {
      const x = -half + i * step;
      heightGrid[offset + i] = terrain(waveNumber, x, z);
    }
  }

  // Precompute structural layout maps
  let idx = 0;
  for (let j = 0; j < RES - 1; j++) {
    for (let i = 0; i < RES - 1; i++) {
      cellIndices[idx] = idx;
      cellGridI[idx] = i;
      cellGridJ[idx] = j;
      cellX0[idx] = -half + i * step;
      cellX1[idx] = -half + (i + 1) * step;
      cellZ0[idx] = -half + j * step;
      cellZ1[idx] = -half + (j + 1) * step;
      idx++;
    }
  }

  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);
}

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

export function drawTerrain() {
  // 1. Cache viewing transform variables globally for the frame
  const cosY = Math.cos(view.angleY);
  const sinY = Math.sin(view.angleY);
  const cosX = Math.cos(view.angleX);
  const sinX = Math.sin(view.angleX);
  
  const baseScale = Math.min(canvas.width, canvas.height) * 0.045;
  const currentScale = baseScale * view.zoom;
  const centerX = canvas.width * 0.5;
  const centerY = canvas.height * 0.5;

  // 2. Project all grid vertices in a single linear pass
  for (let j = 0; j < RES; j++) {
    const z = -half + j * step;
    const offset = j * RES;
    for (let i = 0; i < RES; i++) {
      const x = -half + i * step;
      const h = heightGrid[offset + i] * YSCALE;

      const x1 = x * cosY - z * sinY;
      const z1 = x * sinY + z * cosY;
      const y2 = h * cosX - z1 * sinX;

      const gIdx = offset + i;
      px[gIdx] = centerX + x1 * currentScale;
      py[gIdx] = centerY + y2 * currentScale;
    }
  }

  // 3. Compute depths using layout caches
  for (let k = 0; k < NUM_CELLS; k++) {
    cellDepths[k] = ((cellX0[k] + cellX1[k]) * 0.5 * sinY) + ((cellZ0[k] + cellZ1[k]) * 0.5 * cosY);
    cellIndices[k] = k; 
  }

  // 4. In-place sorting of indices array (No allocations)
  cellIndices.sort((idxA, idxB) => cellDepths[idxB] - cellDepths[idxA]);

  // 5. Draw painter's polygon sequence
  for (let k = 0; k < NUM_CELLS; k++) {
    const cellIdx = cellIndices[k];
    const i = cellGridI[cellIdx];
    const j = cellGridJ[cellIdx];

    // Read precalculated indices
    const idx00 = j * RES + i;
    const idx10 = idx00 + 1;
    const idx01 = idx00 + RES;
    const idx11 = idx01 + 1;

    // Fast color evaluation
    const avgH = (heightGrid[idx00] + heightGrid[idx10] + heightGrid[idx01] + heightGrid[idx11]) * 0.25;
    ctx.fillStyle = getGradientColor((avgH + 1.0) * 0.5);

    // Render polygon path
    ctx.beginPath();
    ctx.moveTo(px[idx00], py[idx00]);
    ctx.lineTo(px[idx10], py[idx10]);
    ctx.lineTo(px[idx11], py[idx11]);
    ctx.lineTo(px[idx01], py[idx01]);
    ctx.closePath();
    ctx.fill();
  }
}

export function drawOrbit(phase) {
  const N = 64; // Halved from 128 (Visually identical but twice as fast)
  const cosY = Math.cos(view.angleY);
  const sinY = Math.sin(view.angleY);
  const cosX = Math.cos(view.angleX);
  const sinX = Math.sin(view.angleX);
  
  const baseScale = Math.min(canvas.width, canvas.height) * 0.045;
  const currentScale = baseScale * view.zoom;
  const centerX = canvas.width * 0.5;
  const centerY = canvas.height * 0.5;

  ctx.strokeStyle = "#c864ec"; 
  ctx.lineWidth = 4.0;
  ctx.beginPath();

  // Inline project function block for speed
  for (let i = 0; i <= N; i++) {
    const t = (i / N) * 6.283185; 
    const ox = orbitState.cx + orbitState.r * Math.cos(t);
    const oz = orbitState.cz + orbitState.r * Math.sin(t);
    const oy = terrain(waveNumber, ox, oz) * YSCALE + LIFT;

    const x1 = ox * cosY - oz * sinY;
    const z1 = ox * sinY + oz * cosY;
    const y2 = oy * cosX - z1 * sinX;

    const sx = centerX + x1 * currentScale;
    const sy = centerY + y2 * currentScale;

    if (i === 0) ctx.moveTo(sx, sy);
    else ctx.lineTo(sx, sy);
  }
  ctx.stroke();

  // Draw target cursor position
  const pxCursor = orbitState.cx + orbitState.r * Math.cos(phase);
  const pzCursor = orbitState.cz + orbitState.r * Math.sin(phase);
  const pyCursor = terrain(waveNumber, pxCursor, pzCursor) * YSCALE + LIFT;

  const cx1 = pxCursor * cosY - pzCursor * sinY;
  const cz1 = pxCursor * sinY + pzCursor * cosY;
  const cy2 = pyCursor * cosX - cz1 * sinX;

  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(centerX + cx1 * currentScale, centerY + cy2 * currentScale, 6, 0, 6.283185);
  ctx.fill();
}

export function clearCanvas() {
  ctx.fillStyle = "#0c0b0a"; 
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}
