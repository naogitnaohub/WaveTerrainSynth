import { 
  RES, SPAN, YSCALE, LIFT, BLOCK_BOTTOM, waveNumber, 
  view, orbitState, terrain, getGradientColor 
} from './terrain.js';
import { initAudio, updateAudioSynth, resumeAudio } from './audio.js';

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener("resize", resize);
resize();

// Unlock Web Audio API context safely upon the first screen click interaction
window.addEventListener("click", async () => {
  await initAudio();
  resumeAudio();
});

// Track currently active keys to ensure smooth combinations
const keys = {};
window.addEventListener("keydown", (e) => { keys[e.key] = true; });
window.addEventListener("keyup", (e) => { keys[e.key] = false; });

// Process keyboard input offsets relative to the terrain grid scale
function handleKeyboardInput() {
  const speed = 0.12; 
  if (keys["ArrowUp"])    orbitState.cz += speed;
  if (keys["ArrowDown"])  orbitState.cz -= speed;
  if (keys["ArrowLeft"])  orbitState.cx -= speed;
  if (keys["ArrowRight"]) orbitState.cx += speed;

  // Change orbit scanning radius size using + and - keys
  const radiusSpeed = 0.05;
  if (keys["+"] || keys["="]) orbitState.r += radiusSpeed;
  if (keys["-"] || keys["_"]) orbitState.r -= radiusSpeed;

  // Restrict radius sizes between small micro-probes and wide landscape sweeps
  orbitState.r = Math.max(0.2, Math.min(6.0, orbitState.r));

  // Contain orbit center bounds inside our maximum SPAN perimeter 
  const maxBound = SPAN * 0.45;
  orbitState.cx = Math.max(-maxBound, Math.min(maxBound, orbitState.cx));
  orbitState.cz = Math.max(-maxBound, Math.min(maxBound, orbitState.cz));
}

function project(x, y, z) {
  let x1 = x * Math.cos(view.angleY) - z * Math.sin(view.angleY);
  let z1 = x * Math.sin(view.angleY) + z * Math.cos(view.angleY);
  let y2 = y * Math.cos(view.angleX) - z1 * Math.sin(view.angleX);
  
  const baseScale = Math.min(canvas.width, canvas.height) * 0.045;
  const currentScale = baseScale * view.zoom;

  return { 
    x: canvas.width / 2 + x1 * currentScale, 
    y: canvas.height / 2 + y2 * currentScale 
  };
}

let isDragging = false;
let previousMousePosition = { x: 0, y: 0 };

window.addEventListener("mousedown", (e) => {
  isDragging = true;
  previousMousePosition = { x: e.clientX, y: e.clientY };
});

window.addEventListener("mousemove", (e) => {
  if (isDragging) {
    const deltaX = e.clientX - previousMousePosition.x;
    const deltaY = e.clientY - previousMousePosition.y;
    view.angleY += deltaX * 0.007;
    view.angleX += deltaY * 0.007;
    previousMousePosition = { x: e.clientX, y: e.clientY };
  }
});

window.addEventListener("mouseup", () => isDragging = false);

window.addEventListener("wheel", (e) => {
  e.preventDefault();
  if (e.deltaY < 0) view.zoom = Math.min(2.5, view.zoom + 0.08);
  else view.zoom = Math.max(0.4, view.zoom - 0.08);
}, { passive: false });


function drawTerrain() {
  const step = SPAN / (RES - 1);
  const half = SPAN * 0.5;

  // 1. Pre-calculate all cell data and compute an average depth (z1) for sorting
  const cells = [];
  for (let j = 0; j < RES - 1; j++) {
    const z0 = -half + j * step;
    const z1 = z0 + step;

    for (let i = 0; i < RES - 1; i++) {
      const x0 = -half + i * step;
      const x1 = x0 + step;

      // Rotate points dynamically to find actual depth relative to camera view
      const avgX = (x0 + x1) / 2;
      const avgZ = (z0 + z1) / 2;
      const rotatedZ = avgX * Math.sin(view.angleY) + avgZ * Math.cos(view.angleY);

      cells.push({ i, j, x0, x1, z0, z1, depth: rotatedZ });
    }
  }

  // 2. Sort from furthest to closest (back-to-front)
  cells.sort((a, b) => b.depth - a.depth);

  // 3. Render the sorted cells
  cells.forEach(cell => {
    const h00 = terrain(waveNumber, cell.x0, cell.z0);
    const h10 = terrain(waveNumber, cell.x1, cell.z0);
    const h01 = terrain(waveNumber, cell.x0, cell.z1);
    const h11 = terrain(waveNumber, cell.x1, cell.z1);

    const p00 = project(cell.x0, h00 * YSCALE, cell.z0);
    const p10 = project(cell.x1, h10 * YSCALE, cell.z0);
    const p01 = project(cell.x0, h01 * YSCALE, cell.z1);
    const p11 = project(cell.x1, h11 * YSCALE, cell.z1);

    const avgH = (h00 + h10 + h01 + h11) / 4;
    ctx.fillStyle = getGradientColor((avgH + 1.0) * 0.5);

    ctx.beginPath();
    ctx.moveTo(p00.x, p00.y);
    ctx.lineTo(p10.x, p10.y);
    ctx.lineTo(p11.x, p11.y);
    ctx.lineTo(p01.x, p01.y);
    ctx.closePath();
    ctx.fill();
  });
}


function drawOrbit(phase) {
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

function loop(timestamp) {
  const elapsedSeconds = timestamp / 1000;

  handleKeyboardInput(); // Read arrow states and radius inputs every frame

  // Send parameters dynamically to the FM audio engine (Base note: 110Hz)
  updateAudioSynth(orbitState, 110); 

  ctx.fillStyle = "#0c0b0a"; 
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  drawTerrain();
  drawOrbit(elapsedSeconds * 2.0); 

  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
