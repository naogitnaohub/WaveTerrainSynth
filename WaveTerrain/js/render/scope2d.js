// 2D oscilloscope preview (Canvas 2D, not WebGL): traces one period of the
// waveform the current orbit/FM settings would produce, redrawn every frame.
import { CONFIG } from '../core/config.js';
import { evaluateTerrain } from '../terrain/terrain-core.js';

const uiCanvas = document.getElementById("uiCanvas");
const ctx = uiCanvas.getContext("2d");

// Pre-allocated, so the per-frame draw has nothing left to allocate
let dpr = window.devicePixelRatio || 1; // device pixel ratio: physical pixels per CSS pixel
let cssW = 0, cssH = 0;

export function initScope2D() {
  resizeUICanvas();
  window.addEventListener("resize", resizeUICanvas);
}

function resizeUICanvas() {
  dpr = window.devicePixelRatio || 1;
  cssW = uiCanvas.clientWidth;
  cssH = uiCanvas.clientHeight;
  uiCanvas.width = cssW * dpr;
  uiCanvas.height = cssH * dpr;
  // setTransform (not scale): replaces the DPR scale on each resize instead of compounding it
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

export function drawScope2D() {
  if (!cssW || !cssH) return;
  const pad = 6;
  const x0 = pad, y0 = pad;
  const w = cssW - pad * 2, h = cssH - pad * 2;
  const hHalf = h * 0.5;

  ctx.clearRect(0, 0, cssW, cssH);

  // Background box
  ctx.fillStyle = "rgba(12, 11, 10, 0.85)";
  ctx.fillRect(x0, y0, w, h);

  // Outer border + center line
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = "rgba(168, 30, 104, 0.4)";
  ctx.strokeRect(x0, y0, w, h);
  ctx.strokeStyle = "rgba(168, 30, 104, 0.15)";
  ctx.beginPath();
  ctx.moveTo(x0, y0 + hHalf);
  ctx.lineTo(x0 + w, y0 + hHalf);
  ctx.stroke();

  // Scope waveform trace
  const { orbit: orb, synth, style } = CONFIG;
  const c = style.cursorColor;

  ctx.strokeStyle = `rgb(${~~(c.r * 255)},${~~(c.g * 255)},${~~(c.b * 255)})`; // ~~: fast truncate to integer
  ctx.lineWidth = 2.0;
  ctx.beginPath();

  const modRatio = synth.fmRatio || 2.0;
  const fmFactor = synth.fmInt * 0.01;
  const step = (Math.PI * 2) / w;
  const { cx, cz, r } = orb;
  const { waveNumber, a, yScale } = synth;

  // Walks one full cycle (sx = 0..w, mapped to phase = 0..2*pi) and, per step,
  // does the same "FM-warp the phase, then sample the terrain around the
  // orbit" as the audio worklet, per sample -- recomputed here for a static
  // one-period preview instead of continuously advancing in time.
  for (let sx = 0; sx < w; sx++) {
    const basePhase = sx * step;
    const warpedPhase = basePhase + fmFactor * Math.sin(basePhase * modRatio);

    const rawH = evaluateTerrain(waveNumber, cx + r * Math.cos(warpedPhase), cz + r * Math.sin(warpedPhase), a);
    const sy = y0 + h - (((rawH * yScale + 5.0) * 0.1) * h);

    if (sx === 0) ctx.moveTo(x0, sy);
    else ctx.lineTo(x0 + sx, sy);
  }
  ctx.stroke();
}
