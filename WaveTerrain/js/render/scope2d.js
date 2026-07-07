// A small oscilloscope-style overlay (plain 2D Canvas, not WebGL) that traces one
// period of the waveform the current orbit/FM settings would produce -- a visual
// preview of the audio signal's shape, redrawn every frame like the 3D view. Purely
// for feedback; it doesn't touch the audio path at all.
import { CONFIG } from '../core/config.js';
import { evaluateTerrain } from '../terrain/terrain-core.js';

const uiCanvas = document.getElementById("uiCanvas");
const ctx = uiCanvas.getContext("2d");

// Pre-allocate variables to eliminate inner-loop allocations and garbage collection
let dpr = window.devicePixelRatio || 1;
let winW = window.innerWidth, winH = window.innerHeight;

export function initScope2D() {
  resizeUICanvas();
  window.addEventListener("resize", resizeUICanvas);
}

function resizeUICanvas() {
  winW = window.innerWidth;
  winH = window.innerHeight;
  dpr = window.devicePixelRatio || 1;
  uiCanvas.width = winW * dpr;
  uiCanvas.height = winH * dpr;
  ctx.scale(dpr, dpr);
}

export function drawScope2D() {
  const w = 320, h = 180, pad = 20;
  const x0 = winW - w - pad;
  const y0 = winH - h - pad;
  const hHalf = h * 0.5;

  // Clear only the bounding box region instead of the entire window for maximum speed
  ctx.clearRect(x0 - 1, y0 - 1, w + 2, h + 2);

  // Background Box
  ctx.fillStyle = "rgba(12, 11, 10, 0.85)";
  ctx.fillRect(x0, y0, w, h);

  // Outer Border & Center Baseline (Drawn in a single stroke batch)
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = "rgba(168, 30, 104, 0.4)";
  ctx.strokeRect(x0, y0, w, h);
  ctx.strokeStyle = "rgba(168, 30, 104, 0.15)";
  ctx.beginPath();
  ctx.moveTo(x0, y0 + hHalf);
  ctx.lineTo(x0 + w, y0 + hHalf);
  ctx.stroke();

  // Scope Waveform Setup
  const { orbit: orb, synth, style } = CONFIG;
  const c = style.cursorColor;

  ctx.strokeStyle = `rgb(${~~(c.r * 255)},${~~(c.g * 255)},${~~(c.b * 255)})`;
  ctx.lineWidth = 2.0;
  ctx.beginPath();

  // Cached math and lookups for the inner engine loop
  const modRatio = synth.fmRatio || 2.0;
  const fmFactor = synth.fmIndex * 0.01;
  const step = (Math.PI * 2) / w;
  const { cx, cz, r } = orb;
  const { waveNumber, a, yScale } = synth;

  // Walk one full cycle (sx = 0..w, mapped to phase = 0..2*pi) and, for each step,
  // do the same "FM-warp the phase, then sample the terrain around the orbit" the
  // audio worklet does per-sample -- just recomputed here for a static one-period
  // preview instead of continuously advancing in time.
  for (let sx = 0; sx < w; sx++) {
    const basePhase = sx * step;
    const warpedPhase = basePhase + fmFactor * Math.sin(basePhase * modRatio);

    // Coordinate mapping & height sampling
    const rawH = evaluateTerrain(waveNumber, cx + r * Math.cos(warpedPhase), cz + r * Math.sin(warpedPhase), a);
    const sy = y0 + h - (((rawH * yScale + 5.0) * 0.1) * h);

    if (sx === 0) ctx.moveTo(x0, sy);
    else ctx.lineTo(x0 + sx, sy);
  }
  ctx.stroke();
}
