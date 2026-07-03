import { CONFIG } from './config.js';
import { terrain } from './terrain.js';

const uiCanvas = document.getElementById("uiCanvas");
const ctx = uiCanvas.getContext("2d");

export function initScope2D() {
  resizeUICanvas();
  window.addEventListener("resize", resizeUICanvas);
}

function resizeUICanvas() {
  uiCanvas.width = window.innerWidth * window.devicePixelRatio;
  uiCanvas.height = window.innerHeight * window.devicePixelRatio;
  ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
}

export function drawScope2D() {
  const w = 320; 
  const h = 180; 
  const pad = 20; 
  const x0 = window.innerWidth - w - pad;
  const y0 = window.innerHeight - h - pad;

  ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

  // Background box layout frame
  ctx.fillStyle = "rgba(12, 11, 10, 0.85)";
  ctx.fillRect(x0, y0, w, h);
  ctx.strokeStyle = "rgba(168, 30, 104, 0.4)";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x0, y0, w, h);

  // Center baseline grid guide marker
  ctx.strokeStyle = "rgba(168, 30, 104, 0.15)";
  ctx.beginPath();
  ctx.moveTo(x0, y0 + h / 2);
  ctx.lineTo(x0 + w, y0 + h / 2);
  ctx.stroke();

  const orb = CONFIG.orbit;
  const synth = CONFIG.synth;
  
  ctx.strokeStyle = `rgb(${Math.round(CONFIG.style.cursorColor.r * 255)}, ${Math.round(CONFIG.style.cursorColor.g * 255)}, ${Math.round(CONFIG.style.cursorColor.b * 255)})`;
  ctx.lineWidth = 2.0;
  ctx.beginPath();

  // VISUAL FM CALCULATION ENGINE
  // Dynamic lookup matching the 2.0 multiplier used inside the audio worker
  const modRatio = CONFIG.synth.fmRatio || 2.0; 

  for (let sx = 0; sx < w; sx++) {
    // Standard linear horizontal phase tracking index
    const basePhase = (sx / w) * Math.PI * 2;
    
    // Simulate the hidden FM phase warping offset wave mathematically
    // The higher the fmIndex, the more the phase squishes and expands horizontally!
    const fmPhaseOffset = (synth.fmIndex / 100.0) * Math.sin(basePhase * modRatio);
    const warpedPhase = basePhase + fmPhaseOffset;

    // Project coordinates onto the terrain using the warped phase data arrays
    const ox = orb.cx + orb.r * Math.cos(warpedPhase);
    const oz = orb.cz + orb.r * Math.sin(warpedPhase);
    
    const rawH = terrain(synth.waveNumber, ox, oz, synth.a);
    const finalY = rawH * synth.yScale;

    const normalizedY = (finalY + 5.0) / 10.0; 
    const sy = y0 + h - (normalizedY * h);

    if (sx === 0) ctx.moveTo(x0 + sx, sy);
    else ctx.lineTo(x0 + sx, sy);
  }
  ctx.stroke();
}
