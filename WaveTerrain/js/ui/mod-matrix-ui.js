// Serum-style routing grid: one column per source, one row per destination, each
// cell a small vertical drag-bar (drag up/down sets depth, filled height shows it).
// Routing itself is still just modMatrix.route()/unroute() -- this file only turns
// pointer drags into calls on that existing API.
import * as modMatrix from '../audio/modulation/mod-matrix.js';

const SOURCE_COLOR = { envelope: '#60a5fa', lfo1: '#c864ec', lfo2: '#facc15' };
const SOURCE_LABEL = { envelope: 'ENV', lfo1: 'L1', lfo2: 'L2' };

// How far a cell's full height maps to for each destination -- these are musically
// reasonable "how far can this realistically wiggle" ranges, not the param's full
// min/max (e.g. fmIndex's absolute max is 500, but a route rarely wants that much).
const DEST_MAX_DEPTH = {
  frequency: 400, radius: 3, cx: 5, cz: 5, fmIndex: 400, fmRatio: 4, yScale: 5, a: 8, volume: 0.5
};

function buildCell(sourceId, destId) {
  const cell = document.createElement('div');
  cell.className = 'mm-cell';
  cell.style.color = SOURCE_COLOR[sourceId] || '#c864ec';
  cell.title = `${sourceId} -> ${destId}`;

  const fill = document.createElement('div');
  fill.className = 'mm-fill';
  cell.appendChild(fill);

  const maxDepth = DEST_MAX_DEPTH[destId] ?? 1;
  const initialFrac = Math.min(1, modMatrix.getDepth(sourceId, destId) / maxDepth);
  fill.style.height = `${initialFrac * 100}%`;

  // Turns a pointer Y position into a 0..1 fraction of the cell's height, top = 1
  // (max depth) and bottom = 0 -- the `1 - ...` flips the normal top-to-bottom pixel
  // coordinate so "drag up" reads as "increase", matching a real fader/knob.
  // Dragging all the way down (near 0) removes the route entirely instead of leaving
  // a route with a depth of ~0, keeping the matrix's routing list accurate.
  const applyFromEvent = e => {
    const rect = cell.getBoundingClientRect();
    const frac = Math.max(0, Math.min(1, 1 - (e.clientY - rect.top) / rect.height));
    fill.style.height = `${frac * 100}%`;
    if (frac < 0.02) modMatrix.unroute(sourceId, destId);
    else modMatrix.route(sourceId, destId, frac * maxDepth);
  };

  // setPointerCapture keeps this cell receiving pointermove events for the rest of
  // the drag even if the cursor strays outside its small 22x15px box -- without it,
  // a fast drag would "escape" the cell and stop updating.
  cell.addEventListener('pointerdown', e => {
    cell.setPointerCapture(e.pointerId);
    applyFromEvent(e);
  });
  cell.addEventListener('pointermove', e => {
    if (e.buttons === 1) applyFromEvent(e); // only while the primary button is held
  });

  return cell;
}

// Call once, after initAudio() has resolved (so the matrix registry is populated).
export function initModMatrixUI() {
  const grid = document.getElementById('matrix-panel');
  if (!grid) return;
  grid.innerHTML = '';

  const sourceIds = modMatrix.listSources();
  const destIds = modMatrix.listDestinations();
  grid.style.gridTemplateColumns = `62px repeat(${sourceIds.length}, 22px)`;

  grid.appendChild(document.createElement('div')).className = 'mm-corner';
  sourceIds.forEach(id => {
    const header = document.createElement('div');
    header.className = 'mm-col-header';
    header.style.color = SOURCE_COLOR[id] || '#c864ec';
    header.textContent = SOURCE_LABEL[id] || id;
    grid.appendChild(header);
  });

  destIds.forEach(destId => {
    const label = document.createElement('div');
    label.className = 'mm-row-label';
    label.textContent = destId;
    grid.appendChild(label);

    sourceIds.forEach(sourceId => grid.appendChild(buildCell(sourceId, destId)));
  });
}
