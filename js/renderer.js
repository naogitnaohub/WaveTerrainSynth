import { 
  RES, SPAN, YSCALE, LIFT, waveNumber, view, terrain, getGradientColor 
} from './terrain.js';
import { orbitState } from './orbit.js';

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

// High-performance caching infrastructure layout allocations
const heightGrid = new Float32Array(RES * RES);
const step = SPAN / (RES - 1);
const half = SPAN * 0.5;
const cellRenderList = [];

export function initRenderer() {
  // Precompute static terrain heights grid topology layout map
  for (let j = 0; j < RES; j++) {
    const z = -half + j * step;
    const offset = j * RES;
    for (let i = 0; i < RES; i++) {
      const x = -half + i * step;
      heightGrid[offset + i] = terrain(waveNumber, x, z);
    }
  }

  // Pre-allocate tracking data object arrays blocks
  for (let j = 0; j < RES - 1; j++) {
    for (let i = 0; i < RES - 1; i++) {
      cellRenderList.push({
        i, j,
        x0: -half + i * step, x1: -half + (i + 1) * step,
        z0: -half + j * step, z1: -half + (j + 1) * step,
        depth: 0
      });
    }
  }

  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);
}

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

function project(x, y, z) {
  const cosY = Math.cos(view.angleY);
  const sinY = Math.sin(view.angleY);
  const x1 = x * cosY - z * sinY;
  const z1 = x * sinY + z * cosY;
  const y2 = y * Math.cos(view.angleX) - z1 * Math.sin(view.angleX);
  
  const baseScale = Math.min(canvas.width, canvas.height) * 0.045;
  const currentScale = baseScale * view.zoom;

  return { 
    x: canvas.width / 2 + x1 * currentScale, 
    y: canvas.height / 2 + y2 * currentScale 
  };
}

export function drawTerrain() {
  const sinY = Math.sin(view.angleY);
  const cosY = Math.cos(view.angleY);
  const totalCells = cellRenderList.length;

  for (let k = 0; k < totalCells; k++) {
    const cell = cellRenderList[k];
    const avgX = (cell.x0 + cell.x1) * 0.5;
    const avgZ = (cell.z0 + cell.z1) * 0.5;
    cell.depth = avgX * sinY + avgZ * cosY;
  }

  cellRenderList.sort((a, b) => b.depth - a.depth);

  for (let k = 0; k < totalCells; k++) {
    const cell = cellRenderList[k];
    const { i, j } = cell;

    const h00 = heightGrid[j * RES + i];
    const h10 = heightGrid[j * RES + (i + 1)];
    const h01 = heightGrid[(j + 1) * RES + i];
    const h11 = heightGrid[(j + 1) * RES + (i + 1)];

    const p00 = project(cell.x0, h00 * YSCALE, cell.z0);
    const p10 = project(cell.x1, h10 * YSCALE, cell.z0);
    const p01 = project(cell.x0, h01 * YSCALE, cell.z1);
    const p11 = project(cell.x1, h11 * YSCALE, cell.z1);

    const avgH = (h00 + h10 + h01 + h11) * 0.25;
    ctx.fillStyle = getGradientColor((avgH + 1.0) * 0.5);

    ctx.beginPath();
    ctx.moveTo(p00.x, p00.y);
    ctx.lineTo(p10.x, p10.y);
    ctx.lineTo(p11.x, p11.y);
    ctx.lineTo(p01.x, p01.y);
    ctx.closePath();
    ctx.fill();
  }
}

export function drawOrbit(phase) {
  const N = 128;
  ctx.strokeStyle = "#c864ec"; 
  ctx.lineWidth = 4.0;
  ctx.beginPath();

  for (let i = 0; i <= N; i++) {
    const t = (i / N) * Math.PI * 2;
    const ox = orbitState.cx + orbitState.r * Math.cos(t);
    const oz = orbitState.cz + orbitState.r * Math.sin(t);
    const oy = terrain(waveNumber, ox, oz) * YSCALE + LIFT;

    const screenPos = project(ox, oy, oz);

    if (i === 0) ctx.moveTo(screenPos.x, screenPos.y);
    else ctx.lineTo(screenPos.x, screenPos.y);
  }
  ctx.stroke();

  const px = orbitState.cx + orbitState.r * Math.cos(phase);
  const pz = orbitState.cz + orbitState.r * Math.sin(phase);
  const py = terrain(waveNumber, px, pz) * YSCALE + LIFT;
  const pNode = project(px, py, pz);

  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(pNode.x, pNode.y, 6, 0, Math.PI * 2);
  ctx.fill();
}

export function clearCanvas() {
  ctx.fillStyle = "#0c0b0a"; 
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}
