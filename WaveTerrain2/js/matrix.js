import { CONFIG } from './config.js';

export function createProjectionViewMatrix(canvas) {
  const radY = CONFIG.view.angleY, radX = CONFIG.view.angleX, zoom = CONFIG.view.zoom;
  const fov = Math.PI / 4.0, aspect = canvas.width / canvas.height;
  const f = 1.0 / Math.tan(fov / 2.0), near = 0.1, far = 100.0, nf = 1.0 / (near - far);

  const proj = [
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (far + near) * nf, -1,
    0, 0, (2.0 * far * near) * nf, 0
  ];

  const cosY = Math.cos(radY), sinY = Math.sin(radY);
  const cosX = Math.cos(radX), sinX = Math.sin(radX);
  const cx = 22.0 * sinY * cosX / zoom, cz = 22.0 * cosY * cosX / zoom, cy = 22.0 * sinX / zoom;

  const zmag = Math.sqrt(cx*cx + cy*cy + cz*cz);
  const vx = cx/zmag, vy = cy/zmag, vz = cz/zmag;

  let rx = vz, rz = -vx; // cross product with [0,1,0] simplified
  const rmag = Math.sqrt(rx*rx + rz*rz);
  rx /= rmag; rz /= rmag;

  const upx = vy * rz, upy = vz * rx - vx * rz, upz = -vy * rx;

  const view = [
    rx, upx, vx, 0,
    0, upy, vy, 0,
    rz, upz, vz, 0,
    0, 0, -(vx*cx + vy*cy + vz*cz), 1
  ];

  const out = new Float32Array(16);
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) { sum += view[i * 4 + k] * proj[k * 4 + j]; }
      out[i * 4 + j] = sum;
    }
  }
  return out;
}
