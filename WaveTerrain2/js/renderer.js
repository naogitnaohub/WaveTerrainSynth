import { CONFIG } from './config.js';
import { terrain, getGradientColor } from './terrain.js';
import { vsSource, fsSource, compileShader } from './shaders.js';
import { createProjectionViewMatrix } from './matrix.js';

const canvas = document.getElementById("canvas");
let gl = null, shaderProgram = null;
let positionBuffer = null, colorBuffer = null, indexBuffer = null, numIndices = 0;
let orbitBuffer = null, cursorBuffer = null;

export function initRenderer() {
  gl = canvas.getContext("webgl2");
  if (!gl) return;

  const vs = compileShader(gl, gl.VERTEX_SHADER, vsSource);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, fsSource);
  shaderProgram = gl.createProgram();
  gl.attachShader(shaderProgram, vs);
  gl.attachShader(shaderProgram, fs);
  gl.linkProgram(shaderProgram);

  orbitBuffer = gl.createBuffer();
  cursorBuffer = gl.createBuffer();

  buildTerrainMesh();
  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);
}

export function rebuildTerrainMesh() { if (gl) buildTerrainMesh(); }

function buildTerrainMesh() {
  const res = CONFIG.RES, step = CONFIG.SPAN / (res - 1), half = CONFIG.SPAN * 0.5;
  const vertices = [], colors = [], indices = [];

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

      const nx = -((hR - hL) / (2.0 * step)) * 3.5, nz = -((hU - hD) / (2.0 * step)) * 3.5;
      const nMag = Math.sqrt(nx * nx + 1.0 + nz * nz);
      const light = 0.15 + Math.max(0.0, (nx * -0.4 + 0.9 + nz * -0.3) / nMag) * 1.35;

      const matches = getGradientColor((h + 1.0) * 0.5, light).match(/\d+/g);
      if (matches && matches.length >= 3) {
        colors.push(parseInt(matches[0]) / 255, parseInt(matches[1]) / 255, parseInt(matches[2]) / 255);
      } else { colors.push(0, 0, 0); }
    }
  }

  for (let j = 0; j < res - 1; j++) {
    for (let i = 0; i < res - 1; i++) {
      const row1 = j * res + i, row2 = (j + 1) * res + i;
      indices.push(row1, row1 + 1, row2, row1 + 1, row2 + 1, row2);
    }
  }

  numIndices = indices.length;
  if (positionBuffer) gl.deleteBuffer(positionBuffer);
  positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);

  if (colorBuffer) gl.deleteBuffer(colorBuffer);
  colorBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.STATIC_DRAW);

  if (indexBuffer) gl.deleteBuffer(indexBuffer);
  indexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(indices), gl.STATIC_DRAW);
}

export function drawTerrain() {
  if (!gl) return;
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LESS);

  gl.useProgram(shaderProgram);
  gl.uniformMatrix4fv(gl.getUniformLocation(shaderProgram, "uMatrix"), false, createProjectionViewMatrix(canvas));
  gl.uniform1f(gl.getUniformLocation(shaderProgram, "uYScale"), CONFIG.synth.yScale);

  const posLoc = gl.getAttribLocation(shaderProgram, "aPosition");
  const colLoc = gl.getAttribLocation(shaderProgram, "aColor");

  gl.enableVertexAttribArray(posLoc);
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.vertexAttribPointer(posLoc, 3, gl.FLOAT, false, 0, 0);

  gl.enableVertexAttribArray(colLoc);
  gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
  gl.vertexAttribPointer(colLoc, 3, gl.FLOAT, false, 0, 0);

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
  gl.drawElements(gl.TRIANGLES, numIndices, gl.UNSIGNED_INT, 0);
}

export function drawOrbit(phase) {
  if (!gl) return;
  gl.useProgram(shaderProgram);
  gl.uniformMatrix4fv(gl.getUniformLocation(shaderProgram, "uMatrix"), false, createProjectionViewMatrix(canvas));
  gl.uniform1f(gl.getUniformLocation(shaderProgram, "uYScale"), 1.0);

  const posLoc = gl.getAttribLocation(shaderProgram, "aPosition"), colLoc = gl.getAttribLocation(shaderProgram, "aColor");
  const N = 96, orbitVertices = new Float32Array((N + 1) * 3), orbitColors = new Float32Array((N + 1) * 3);

  for (let i = 0; i <= N; i++) {
    const t = (i / N) * Math.PI * 2;
    const ox = CONFIG.orbit.cx + CONFIG.orbit.r * Math.cos(t), oz = CONFIG.orbit.cz + CONFIG.orbit.r * Math.sin(t);
    const oy = (terrain(CONFIG.synth.waveNumber, ox, oz, CONFIG.synth.a) * CONFIG.synth.yScale) + 0.04 + CONFIG.synth.lift;
    const vIdx = i * 3;
    orbitVertices[vIdx] = ox; orbitVertices[vIdx + 1] = oy; orbitVertices[vIdx + 2] = oz;
    orbitColors[vIdx] = 1; orbitColors[vIdx + 1] = 1; orbitColors[vIdx + 2] = 1;
  }

  gl.bindBuffer(gl.ARRAY_BUFFER, orbitBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, orbitVertices, gl.DYNAMIC_DRAW);
  gl.vertexAttribPointer(posLoc, 3, gl.FLOAT, false, 0, 0);

  const tCol = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, tCol);
  gl.bufferData(gl.ARRAY_BUFFER, orbitColors, gl.STREAM_DRAW);
  gl.vertexAttribPointer(colLoc, 3, gl.FLOAT, false, 0, 0);
  gl.drawArrays(gl.LINE_STRIP, 0, N + 1);
  gl.deleteBuffer(tCol);

  const cx = CONFIG.orbit.cx + CONFIG.orbit.r * Math.cos(phase), cz = CONFIG.orbit.cz + CONFIG.orbit.r * Math.sin(phase);
  const cy = (terrain(CONFIG.synth.waveNumber, cx, cz, CONFIG.synth.a) * CONFIG.synth.yScale) + 0.05 + CONFIG.synth.lift;
  const s = 0.15, cursorVertices = new Float32Array([cx-s, cy, cz, cx+s, cy, cz, cx, cy-s, cz, cx, cy+s, cz, cx, cy, cz-s, cx, cy, cz+s]);
  const cursorColors = new Float32Array(18).fill(0.5); // setup tracking colors

  gl.bindBuffer(gl.ARRAY_BUFFER, cursorBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, cursorVertices, gl.DYNAMIC_DRAW);
  gl.vertexAttribPointer(posLoc, 3, gl.FLOAT, false, 0, 0);

  const tCurCol = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, tCurCol);
  gl.bufferData(gl.ARRAY_BUFFER, cursorColors, gl.STREAM_DRAW);
  gl.vertexAttribPointer(colLoc, 3, gl.FLOAT, false, 0, 0);
  gl.drawArrays(gl.LINES, 0, 6);
  gl.deleteBuffer(tCurCol);
}

export function clearCanvas() {
  if (!gl) return;
  gl.clearColor(0.047, 0.043, 0.039, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
}

function resizeCanvas() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
