// Serum-style routing grid: one row per source (only 3 -- L1/L2/ENV -- so each can be
// tall, giving a much bigger drag range per cell than a per-destination-row layout
// would), one column per destination, each cell a small vertical drag-bar (drag up/
// down sets depth, filled height shows it). Routing itself is still just
// modMatrix.route()/unroute() -- this file only turns pointer drags into calls on
// that existing API.
import * as modMatrix from '../audio/modulation/mod-matrix.js';

// Pastel palette matching CONFIG.style.terrainPalette's own green -> gold -> orange
// hues, so the matrix visually belongs with the terrain rather than being an
// unrelated UI color scheme. Not the same system as lfo-panel-ui.js's SHAPE_COLOR
// (which colors the LEDs by waveform shape) -- these color *sources* (rows), that
// colors *shapes*, and they're independent of each other.
const SOURCE_COLOR = { lfo1: '#a8e6b0', lfo2: '#f0e08a', envelope: '#f2b880' };
const SOURCE_LABEL = { lfo1: 'L1', lfo2: 'L2', envelope: 'ENV' };
// Row order top-to-bottom -- envelope goes last. Falls back to appending any
// registered source not listed here, so a new source doesn't silently disappear from
// the matrix if this list isn't updated to match.
const SOURCE_ORDER = ['lfo1', 'lfo2', 'envelope'];

// How far a cell's full height maps to for each destination -- these are musically
// reasonable "how far can this realistically wiggle" ranges, not the param's full
// min/max (e.g. fmIndex's absolute max is 500, but a route rarely wants that much).
const DEST_MAX_DEPTH = {
  frequency: 400, radius: 3, cx: 5, cz: 5, fmIndex: 400, fmRatio: 4, yScale: 5, a: 8, volume: 0.5
};

// Short, all-caps column labels, colored to match whichever themed control-panel row
// owns that parameter (see style.css's .row-green/.row-yellow and ui/input.js's
// UI_MAP) -- so e.g. FREQ's column header is the same yellow as the Frequency knob.
// Params with no dedicated control (radius/cx/cz never had one, before or after this
// redesign) get a neutral gray instead of falsely borrowing a row's color.
const GREEN = '#4ade80', YELLOW = '#facc15', NEUTRAL = '#8a8a8a';
const DEST_INFO = {
  frequency: { label: 'FREQ', color: YELLOW },
  fmRatio:   { label: 'FMR',  color: YELLOW },
  fmIndex:   { label: 'FMI',  color: YELLOW },
  yScale:    { label: 'YSC',  color: GREEN },
  a:         { label: 'A',    color: GREEN },
  volume:    { label: 'VOL',  color: 'rgb(242, 64, 217)' },
  radius:    { label: 'RAD',  color: NEUTRAL },
  cx:        { label: 'CX',   color: NEUTRAL },
  cz:        { label: 'CZ',   color: NEUTRAL }
};

// Column order matches the left-to-right order the corresponding controls appear in
// at the top of the panel (Y-Scale/A, then Frequency/FM Ratio/FM Intensity), then
// Volume (has its own control, the big slider), then radius/cx/cz last since they
// have no dedicated control at all. Falls back to appending any registered
// destination not listed here, so a new destination doesn't silently disappear.
const DEST_ORDER = ['yScale', 'a', 'frequency', 'fmRatio', 'fmIndex', 'volume', 'radius', 'cx', 'cz'];

function buildCell(sourceId, destId) {
  const cell = document.createElement('div');
  cell.className = 'mm-cell';
  cell.style.color = SOURCE_COLOR[sourceId] || 'rgb(242, 64, 217)';
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
  // the drag even if the cursor strays outside its box -- without it, a fast drag
  // would "escape" the cell and stop updating.
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

  const registered = modMatrix.listSources();
  const sourceIds = [...SOURCE_ORDER.filter(id => registered.includes(id)), ...registered.filter(id => !SOURCE_ORDER.includes(id))];
  const registeredDest = modMatrix.listDestinations();
  const destIds = [...DEST_ORDER.filter(id => registeredDest.includes(id)), ...registeredDest.filter(id => !DEST_ORDER.includes(id))];
  // Only 3 rows needed now, so each one gets a generous 60px of drag range instead of
  // the ~19px it had when destinations were the rows -- a structural replacement for
  // the precision-mode fine-tuning that was removed. Columns are 1fr (not a fixed
  // px width) so the grid stretches to fill the rest of the matrix row's width
  // (see .matrix-grid's flex:1 in style.css) instead of leaving dead space.
  grid.style.gridTemplateColumns = `44px repeat(${destIds.length}, 1fr)`;
  grid.style.gridTemplateRows = `20px repeat(${sourceIds.length}, 60px)`;

  // The grid's top-left corner cell doubles as the Bypass toggle -- no label text,
  // just the checkbox itself (title attribute covers hover/accessibility), so it
  // reads as a small module switch rather than a labeled control.
  const corner = document.createElement('div');
  corner.className = 'mm-corner';
  const bypassBox = document.createElement('input');
  bypassBox.type = 'checkbox';
  bypassBox.title = 'Bypass';
  bypassBox.checked = modMatrix.isBypassed();
  bypassBox.onchange = () => modMatrix.setBypass(bypassBox.checked);
  corner.appendChild(bypassBox);
  grid.appendChild(corner);
  destIds.forEach(destId => {
    const header = document.createElement('div');
    header.className = 'mm-col-header';
    const info = DEST_INFO[destId];
    header.style.color = info?.color || NEUTRAL;
    header.textContent = info?.label || destId.toUpperCase();
    grid.appendChild(header);
  });

  sourceIds.forEach(sourceId => {
    const label = document.createElement('div');
    label.className = 'mm-row-label';
    label.style.color = SOURCE_COLOR[sourceId] || 'rgb(242, 64, 217)';
    label.textContent = SOURCE_LABEL[sourceId] || sourceId;
    grid.appendChild(label);

    destIds.forEach(destId => grid.appendChild(buildCell(sourceId, destId)));
  });
}
