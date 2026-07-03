import { CONFIG } from './config.js';
import { terrain, getGradientColor } from './terrain.js';

const canvas = document.getElementById("canvas");
let gl = null, program = null;
let posBuf = null, colBuf = null, idxBuf = null, orbBuf = null, curBuf = null, numIndices = 0;

const vsSource = `#version 300 es
  in vec3 aPos; in vec3 aCol; uniform mat4 uMat; uniform float uYS; out vec3 vCol;
  void main() { 
    gl_Position = uMat * vec4(aPos.x, aPos.y * uYS, aPos.z, 1.0); 
    vCol = aCol; 
  }`;

const fsSource = `#version 300 es
  precision highp float; in vec3 vCol; uniform vec3 uColor; uniform bool uUseUniformCol; out vec4 fCol; 
  void main() { 
    fCol = uUseUniformCol ? vec4(uColor, 1.0) : vec4(vCol, 1.0); 
  }`;

export function initRenderer() {
  gl = canvas.getContext("webgl2");
  if (!gl) return;

  const vs = gl.createShader(gl.VERTEX_SHADER); gl.shaderSource(vs, vsSource); gl.compileShader(vs);
  const fs = gl.createShader(gl.FRAGMENT_SHADER); gl.shaderSource(fs, fsSource); gl.compileShader(fs);
  
  program = gl.createProgram(); gl.attachShader(program, vs); gl.attachShader(program, fs); gl.linkProgram(program);

  orbBuf = gl.createBuffer(); curBuf = gl.createBuffer();
  buildTerrainMesh();
  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);
}

export function rebuildTerrainMesh() { if (gl) buildTerrainMesh(); }

function buildTerrainMesh() {
  const res = CONFIG.RES, step = CONFIG.SPAN / (res - 1), half = CONFIG.SPAN * 0.5, style = CONFIG.style;
  const vertices = [], colors = [], indices = [];

  const mag = Math.sqrt(style.lightDir.x**2 + style.lightDir.y**2 + style.lightDir.z**2);
  const lx = style.lightDir.x / mag, ly = style.lightDir.y / mag, lz = style.lightDir.z / mag;

  for (let j = 0; j < res; j++) {
    const z = -half + j * step;
    for (let i = 0; i < res; i++) {
      const x = -half + i * step;
      const h = terrain(CONFIG.synth.waveNumber, x, z, CONFIG.synth.a);
      vertices.push(x, h, z);

      const hL = terrain(CONFIG.synth.waveNumber, x - step, z, CONFIG.synth.a);
      const hR = terrain(CONFIG.synth.waveNumber, x + step, z, CONFIG.synth.a);
      const hD = terrain(CONFIG.synth.waveNumber, x, z - step, CONFIG.synth.a);
      const hU = terrain(CONFIG.synth.waveNumber, x, z + step, CONFIG.synth.a);

      const nx = -((hR - hL) / (2.0 * step)) * style.slopeSharpness;
      const nz = -((hU - hD) / (2.0 * step)) * style.slopeSharpness;
      const nMag = Math.sqrt(nx * nx + 1.0 + nz * nz);
      const light = style.ambientShadow + Math.max(0.0, (nx * lx + ly + nz * lz) / nMag) * style.lightContrast;

      const matches = getGradientColor((h + 1.0) * 0.5, light).match(/\d+/g);
      colors.push(parseInt(matches[0])/255, parseInt(matches[1])/255, parseInt(matches[2])/255);
    }
  }

  for (let j = 0; j < res - 1; j++) {
    for (let i = 0; i < res - 1; i++) {
      const r1 = j * res + i, r2 = (j + 1) * res + i;
      indices.push(r1, r1 + 1, r2, r1 + 1, r2 + 1, r2);
    }
  }

  numIndices = indices.length;
  if (posBuf) [posBuf, colBuf, idxBuf].forEach(b => gl.deleteBuffer(b));
  
  gl.bindBuffer(gl.ARRAY_BUFFER, (posBuf = gl.createBuffer())); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, (colBuf = gl.createBuffer())); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.STATIC_DRAW);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, (idxBuf = gl.createBuffer())); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(indices), gl.STATIC_DRAW);
}

export function drawTerrain() {
  if (!gl) return;
  gl.viewport(0, 0, canvas.width, canvas.height); gl.enable(gl.DEPTH_TEST); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  gl.useProgram(program);
  // Add this line inside drawTerrain() right after gl.useProgram(program);
  gl.uniform1i(gl.getUniformLocation(program, "uUseUniformCol"), 0);

  gl.uniformMatrix4fv(gl.getUniformLocation(program, "uMat"), false, getMatrix());
  gl.uniform1f(gl.getUniformLocation(program, "uYS"), CONFIG.synth.yScale);

  const pL = gl.getAttribLocation(program, "aPos"), cL = gl.getAttribLocation(program, "aCol");
  gl.enableVertexAttribArray(pL); gl.bindBuffer(gl.ARRAY_BUFFER, posBuf); gl.vertexAttribPointer(pL, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(cL); gl.bindBuffer(gl.ARRAY_BUFFER, colBuf); gl.vertexAttribPointer(cL, 3, gl.FLOAT, false, 0, 0);

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf); gl.drawElements(gl.TRIANGLES, numIndices, gl.UNSIGNED_INT, 0);
}

export function drawOrbit(phase) {
  if (!gl) return;
  const style = CONFIG.style, orb = CONFIG.orbit, synth = CONFIG.synth;
  
  gl.useProgram(program);
  gl.uniformMatrix4fv(gl.getUniformLocation(program, "uMat"), false, getMatrix());
  gl.uniform1f(gl.getUniformLocation(program, "uYS"), 1.0); 

  // Tell the shader to use our pink config uniform color instead of vertex attributes
  gl.uniform1i(gl.getUniformLocation(program, "uUseUniformCol"), 1);
  gl.uniform3f(gl.getUniformLocation(program, "uColor"), style.orbitColor.r, style.orbitColor.g, style.orbitColor.b);

  gl.depthRange(0.0, 0.95);

  // Generate simple 3D coordinates for a round circle loop
  const SEGMENTS = 128;
  const ringPoints = new Float32Array((SEGMENTS + 1) * 3);

  for (let i = 0; i <= SEGMENTS; i++) {
    const t = (i / SEGMENTS) * Math.PI * 2;
    const x = orb.cx + orb.r * Math.cos(t);
    const z = orb.cz + orb.r * Math.sin(t);
    const y = (terrain(synth.waveNumber, x, z, synth.a) * synth.yScale) + 0.04 + synth.lift;
    
    const idx = i * 3;
    ringPoints[idx] = x;
    ringPoints[idx + 1] = y;
    ringPoints[idx + 2] = z;
  }

  // Safely stream only positions into our separate orbit buffer
  gl.bindBuffer(gl.ARRAY_BUFFER, orbBuf);
  gl.bufferData(gl.ARRAY_BUFFER, ringPoints, gl.DYNAMIC_DRAW);

  const pL = gl.getAttribLocation(program, "aPos");
  gl.enableVertexAttribArray(pL);
  gl.vertexAttribPointer(pL, 3, gl.FLOAT, false, 0, 0);

  // Turn off the vertex color attribute entirely for this draw call
  const cL = gl.getAttribLocation(program, "aCol");
  gl.disableVertexAttribArray(cL);

  // Unbind index elements to prevent drawing terrain shapes
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null); 

  // Draw a clean line
  gl.drawArrays(gl.LINE_STRIP, 0, SEGMENTS + 1);
  gl.depthRange(0.0, 1.0);
}



export function clearCanvas() {
  if (!gl) return;
  // Parse style hex color string cleanly into fractional WebGL vectors
  const hex = CONFIG.style.clearColor;
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  
  gl.clearColor(r, g, b, 1.0);
}

function resizeCanvas() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }

function getMatrix() {
  const f = 1.0 / Math.tan(Math.PI / 8.0), nf = 1.0 / (0.1 - 100.0);
  const proj = [f/(canvas.width/canvas.height), 0, 0, 0, 0, f, 0, 0, 0, 0, 100.1*nf, -1, 0, 0, 20.0*nf, 0];
  const cosY = Math.cos(CONFIG.view.angleY), sinY = Math.sin(CONFIG.view.angleY), cosX = Math.cos(CONFIG.view.angleX), sinX = Math.sin(CONFIG.view.angleX);
  const cx = 22.0*sinY*cosX/CONFIG.view.zoom, cz = 22.0*cosY*cosX/CONFIG.view.zoom, cy = 22.0*sinX/CONFIG.view.zoom, zm = Math.sqrt(cx*cx+cy*cy+cz*cz);
  const vx = cx/zm, vy = cy/zm, vz = cz/zm; let rx = vz, rz = -vx, rm = Math.sqrt(rx*rx+rz*rz); rx /= rm; rz /= rm;
  const view = [rx, vy*rz, vx, 0, 0, vz*rx-vx*rz, vy, 0, rz, -vy*rx, vz, 0, 0, 0, -(vx*cx+vy*cy+vz*cz), 1];
  const out = new Float32Array(16);
  for (let i = 0; i < 4; i++) { for (let j = 0; j < 4; j++) { let s = 0; for (let k = 0; k < 4; k++) s += view[i*4+k] * proj[k*4+j]; out[i*4+j] = s; } }
  return out;
}
