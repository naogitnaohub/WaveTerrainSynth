// renderer.js written by Claude (AI)
//  terrain renderer: visual only, has zero influence on the sound.
//
// Uploads the terrain as a triangle mesh and runs two small GPU programs
// ("shaders") -- one that positions each vertex on screen, one that colors
// each pixel -- while the GPU rasterizes the rest. Reads the same
// evaluateTerrain() the audio worklet uses, to draw the surface.
import { CONFIG } from '../core/config.js';
import { evaluateTerrain } from '../terrain/terrain-core.js';
import { getGradientColor } from '../terrain/terrain-color.js';

const canvas = document.getElementById("canvas");
let gl = null, program = null, uMatLoc, uYSLoc, uColorLoc, uUseUniformLoc, aPosLoc, aColLoc;
let posBuf = null, colBuf = null, idxBuf = null, orbBuf = null, numIndices = 0;

// Reusable static arrays, so no allocations happen at runtime once the mesh exists.
let cacheRes = 0;
let vertexArray = null, colorArray = null, indexArray = null;
const ringPoints = new Float32Array(129 * 3); // typed array: fixed-size packed numbers -- x,y,z per ring point

// Vertex shader: runs once per vertex, on the GPU. Receives this vertex's
// position (aPos) and color (aCol) as "attributes" (per-vertex data), plus two
// "uniforms" (constant for the whole draw call): uMat is the combined
// camera/projection matrix (see getMatrix() below), uYS is the y-scale knob.
// Decides where this vertex lands on screen (gl_Position) and passes its color
// to the fragment shader (vCol).
const vsSource = `#version 300 es
  in vec3 aPos; in vec3 aCol; uniform mat4 uMat; uniform float uYS; out vec3 vCol;
  void main() {
    gl_Position = uMat * vec4(aPos.x, aPos.y * uYS, aPos.z, 1.0);
    vCol = aCol;
  }`;

// Fragment shader: runs once per pixel the GPU rasterizes. Uses the
// interpolated per-vertex color (the terrain mesh), or a flat uniform color
// (uUseUniformCol -- used for the orbit ring, drawn as one solid color instead).
const fsSource = `#version 300 es
  precision highp float; in vec3 vCol; uniform vec3 uColor; uniform bool uUseUniformCol; out vec4 fCol;
  void main() {
    fCol = uUseUniformCol ? vec4(uColor, 1.0) : vec4(vCol, 1.0);
  }`;

// One-time WebGL setup: compiles the shaders above into a GPU "program",
// caches the handles needed every frame, and builds the initial mesh.
export function initRenderer() {
  if (!(gl = canvas.getContext("webgl2"))) return;

  const vs = gl.createShader(gl.VERTEX_SHADER); gl.shaderSource(vs, vsSource); gl.compileShader(vs);
  const fs = gl.createShader(gl.FRAGMENT_SHADER); gl.shaderSource(fs, fsSource); gl.compileShader(fs);

  program = gl.createProgram(); gl.attachShader(program, vs); gl.attachShader(program, fs); gl.linkProgram(program);

  // Cache uniform/attribute locations upfront -- looking them up isn't free,
  // so this must not happen inside the per-frame draw loop.
  uMatLoc = gl.getUniformLocation(program, "uMat");
  uYSLoc = gl.getUniformLocation(program, "uYS");
  uColorLoc = gl.getUniformLocation(program, "uColor");
  uUseUniformLoc = gl.getUniformLocation(program, "uUseUniformCol");
  aPosLoc = gl.getAttribLocation(program, "aPos");
  aColLoc = gl.getAttribLocation(program, "aCol");

  orbBuf = gl.createBuffer();
  posBuf = gl.createBuffer();
  colBuf = gl.createBuffer();
  idxBuf = gl.createBuffer();

  buildTerrainMesh();
  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);
}

// Called whenever the wave shape or `a` changes -- the mesh has to be
// recomputed (unlike frequency/volume/etc., which affect audio and the
// y-scale uniform only, not vertex positions).
export function rebuildTerrainMesh() { if (gl) buildTerrainMesh(); }

// Builds a flat RES x RES grid of (x, height, z) points -- height from
// evaluateTerrain(), the same formula the audio worklet samples -- plus a
// matching triangle index list (two triangles per grid square) and a color
// per vertex.
function buildTerrainMesh() {
  const res = CONFIG.RES, step = CONFIG.SPAN / (res - 1), half = CONFIG.SPAN * 0.5, style = CONFIG.style;
  const synth = CONFIG.synth, wave = synth.waveNumber, sa = synth.a;

  // (Re)allocate the flat buffers only when resolution actually changes
  if (cacheRes !== res) {
    cacheRes = res;
    vertexArray = new Float32Array(res * res * 3);
    colorArray = new Float32Array(res * res * 3);

    const totalIndices = (res - 1) * (res - 1) * 6;
    indexArray = new Uint32Array(totalIndices);

    let idx = 0;
    for (let j = 0; j < res - 1; j++) {
      for (let i = 0; i < res - 1; i++) {
        const r1 = j * res + i, r2 = (j + 1) * res + i;
        indexArray[idx++] = r1;     indexArray[idx++] = r1 + 1; indexArray[idx++] = r2;
        indexArray[idx++] = r1 + 1; indexArray[idx++] = r2 + 1; indexArray[idx++] = r2;
      }
    }
    numIndices = indexArray.length;
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indexArray, gl.STATIC_DRAW);
  }

  const mag = Math.sqrt(style.lightDir.x**2 + style.lightDir.y**2 + style.lightDir.z**2) || 1;
  const lx = style.lightDir.x / mag, ly = style.lightDir.y / mag, lz = style.lightDir.z / mag; // normalized light direction

  const invTwoStep = 1.0 / (2.0 * step);

  let vIdx = 0, cIdx = 0;
  const rgbCache = new Map(); // avoids re-parsing the same "rgb(...)" string twice

  for (let j = 0; j < res; j++) {
    const z = -half + j * step;
    for (let i = 0; i < res; i++) {
      const x = -half + i * step;
      const h = evaluateTerrain(wave, x, z, sa);

      vertexArray[vIdx++] = x;
      vertexArray[vIdx++] = h;
      vertexArray[vIdx++] = z;

      // Fake lighting without true per-vertex normals: sample terrain height
      // just next to this point in both directions (hL/hR/hD/hU), and use the
      // *slope* between them as a stand-in for the surface's tilt. (nx, nz) .
      // lightDir (simplified, since ny is implicitly ~1) is "how directly this
      // patch faces the light" -- Lambertian-style shading.
      const hL = evaluateTerrain(wave, x - step, z, sa);
      const hR = evaluateTerrain(wave, x + step, z, sa);
      const hD = evaluateTerrain(wave, x, z - step, sa);
      const hU = evaluateTerrain(wave, x, z + step, sa);

      const nx = -((hR - hL) * invTwoStep) * style.slopeSharpness;
      const nz = -((hU - hD) * invTwoStep) * style.slopeSharpness;
      const light = style.ambientShadow + Math.max(0.0, (nx * lx + ly + nz * lz) / Math.sqrt(nx * nx + 1.0 + nz * nz)) * style.lightContrast;

      const gradStr = getGradientColor((h + 1.0) * 0.5, light);
      let rgb = rgbCache.get(gradStr);
      if (!rgb) {
        const matches = gradStr.match(/\d+/g); // regex: pulls the three numbers out of "rgb(r,g,b)"
        rgb = [parseInt(matches[0]) / 255, parseInt(matches[1]) / 255, parseInt(matches[2]) / 255];
        rgbCache.set(gradStr, rgb);
      }
      colorArray[cIdx++] = rgb[0];
      colorArray[cIdx++] = rgb[1];
      colorArray[cIdx++] = rgb[2];
    }
  }

  gl.bindBuffer(gl.ARRAY_BUFFER, posBuf); gl.bufferData(gl.ARRAY_BUFFER, vertexArray, gl.DYNAMIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, colBuf); gl.bufferData(gl.ARRAY_BUFFER, colorArray, gl.DYNAMIC_DRAW);
}

// Draws the already-built mesh. Called every frame from main.js's loop() --
// cheap, since it just re-binds existing GPU buffers and issues one draw
// call; the actual vertex data only changes when rebuildTerrainMesh() runs.
export function drawTerrain() {
  if (!gl) return;
  gl.viewport(0, 0, canvas.width, canvas.height); gl.enable(gl.DEPTH_TEST); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  gl.useProgram(program);
  gl.uniform1i(uUseUniformLoc, 0);
  gl.uniformMatrix4fv(uMatLoc, false, getMatrix());
  gl.uniform1f(uYSLoc, CONFIG.synth.yScale);

  gl.enableVertexAttribArray(aPosLoc); gl.bindBuffer(gl.ARRAY_BUFFER, posBuf); gl.vertexAttribPointer(aPosLoc, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(aColLoc); gl.bindBuffer(gl.ARRAY_BUFFER, colBuf); gl.vertexAttribPointer(aColLoc, 3, gl.FLOAT, false, 0, 0);

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf); gl.drawElements(gl.TRIANGLES, numIndices, gl.UNSIGNED_INT, 0);
}

// Draws the ring showing where the audio orbit currently sits on the terrain
// -- a visual echo of the same circle the worklet's phase accumulator walks
// around (terrain-processor.js), recomputed here on the CPU for display.
// `phase` is currently unused (the ring's shape doesn't animate frame to
// frame -- only its position/radius do, when the orbit moves).
export function drawOrbit(phase) {
  if (!gl) return;
  const style = CONFIG.style, orb = CONFIG.orbit, synth = CONFIG.synth;

  gl.useProgram(program);
  gl.uniformMatrix4fv(uMatLoc, false, getMatrix());
  gl.uniform1f(uYSLoc, 1.0);
  gl.uniform1i(uUseUniformLoc, 1);
  gl.uniform3f(uColorLoc, style.orbitColor.r, style.orbitColor.g, style.orbitColor.b);

  gl.depthRange(0.0, 0.95); // biased slightly toward the camera, so the ring never z-fights with the mesh

  const SEGMENTS = 128, wave = synth.waveNumber, sa = synth.a, sy = synth.yScale, lift = 0.04 + synth.lift;
  const { cx, cz, r } = orb;

  let idx = 0;
  for (let i = 0; i <= SEGMENTS; i++) {
    const t = (i * 0.04908738521); // (2*pi) / 128, precomputed
    const x = cx + r * Math.cos(t);
    const z = cz + r * Math.sin(t);

    ringPoints[idx++] = x;
    ringPoints[idx++] = (evaluateTerrain(wave, x, z, sa) * sy) + lift;
    ringPoints[idx++] = z;
  }

  gl.bindBuffer(gl.ARRAY_BUFFER, orbBuf); gl.bufferData(gl.ARRAY_BUFFER, ringPoints, gl.DYNAMIC_DRAW);
  gl.enableVertexAttribArray(aPosLoc);   gl.vertexAttribPointer(aPosLoc, 3, gl.FLOAT, false, 0, 0);
  gl.disableVertexAttribArray(aColLoc); // ring uses the flat uniform color, not per-vertex color
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

  gl.drawArrays(gl.LINE_STRIP, 0, 129);
  gl.depthRange(0.0, 1.0);
}

export function clearCanvas() {
  if (!gl) return;
  const hex = CONFIG.style.clearColor;
  gl.clearColor(parseInt(hex.slice(1, 3), 16) / 255, parseInt(hex.slice(3, 5), 16) / 255, parseInt(hex.slice(5, 7), 16) / 255, 1.0);
}

// The control panel occupies a fixed-width strip on the right, so the 3D
// view's center should be the center of the *remaining* space, not the whole
// window -- otherwise the terrain reads as off-center. Reads the panel's
// actual left edge (not just its width) so this stays correct if the panel's
// width *or* its right-edge offset changes in style.css -- using width alone
// ignored the panel's `right: 20px` gap and left the canvas overlapping 20px
// under the panel instead of ending flush with its left edge.
function availableWidth() {
  const panel = document.getElementById('control-panel');
  return panel ? panel.getBoundingClientRect().left : window.innerWidth;
}

function resizeCanvas() {
  const w = availableWidth(), h = window.innerHeight;
  canvas.width = w; canvas.height = h;
  canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
}

// Builds the camera matrix: a perspective projection (how 3D points squash
// onto a 2D screen, given field-of-view and aspect ratio) combined with a
// view transform derived from CONFIG.view's orbit-camera angles (angleY =
// horizontal, angleX = vertical, zoom). Standard 3D-graphics math: spherical
// coordinates -> a camera basis -> a 4x4 matrix. Every vertex is multiplied by
// this one matrix (see the vertex shader above) to land correctly on screen.
function getMatrix() {
  const f = 2.414213562, nf = -0.01001001; // precomputed 1/tan(pi/8) and 1/(0.1 - 100)
  const proj = [f / (canvas.width / canvas.height), 0, 0, 0, 0, f, 0, 0, 0, 0, -1.002002, -1, 0, 0, -0.2002002, 0];
  const { angleY, angleX, zoom } = CONFIG.view;
  const cosY = Math.cos(angleY), sinY = Math.sin(angleY), cosX = Math.cos(angleX), sinX = Math.sin(angleX);
  const cx = 22.0 * sinY * cosX / zoom, cz = 22.0 * cosY * cosX / zoom, cy = 22.0 * sinX / zoom;
  const zm = Math.sqrt(cx * cx + cy * cy + cz * cz) || 1;
  const vx = cx / zm, vy = cy / zm, vz = cz / zm;
  let rx = vz, rz = -vx, rm = Math.sqrt(rx * rx + rz * rz) || 1; rx /= rm; rz /= rm;
  const view = [rx, vy * rz, vx, 0, 0, vz * rx - vx * rz, vy, 0, rz, -vy * rx, vz, 0, 0, 0, -(vx * cx + vy * cy + vz * cz), 1];
  const out = new Float32Array(16);
  for (let i = 0; i < 4; i++) { for (let j = 0; j < 4; j++) { let s = 0; for (let k = 0; k < 4; k++) s += view[i * 4 + k] * proj[k * 4 + j]; out[i * 4 + j] = s; } }
  return out;
}
