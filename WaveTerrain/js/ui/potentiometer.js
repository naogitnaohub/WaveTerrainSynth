// A rotary knob control -- there's no native HTML equivalent, so this is a small SVG
// (a track arc, tick marks, a pointer line) driven entirely by vertical drag: dragging
// up increases the value, down decreases it, a fixed pixel distance (DRAG_RANGE_PX)
// spans the whole min..max range, same idea as a real knob or a DAW plugin's. There's
// deliberately no "click to jump" the way a linear slider has -- a circle has no
// natural click-to-position mapping, so knobs (real or virtual) don't support that.
//
// `step` always controls snapping (like every other control in this app, from
// core/config.js's STEPS table). `visualTicks` is purely cosmetic -- how many tick
// marks to draw around the arc -- except for a fully discrete control (e.g. the wave
// selector) where passing visualTicks equal to the number of valid steps makes the
// ticks line up exactly with where the knob will actually stop.
const SWEEP_DEG = 270;       // -135deg (min) to +135deg (max) -- the standard knob range
const DRAG_RANGE_PX = 150;   // vertical drag distance (px) that spans the full min..max range
const SVG_NS = 'http://www.w3.org/2000/svg';

function angleFor(min, max, value) {
  const frac = max === min ? 0 : (value - min) / (max - min);
  return (-SWEEP_DEG / 2 + frac * SWEEP_DEG) * (Math.PI / 180);
}

export function createPotentiometer({ min, max, step = 1, value, visualTicks = 11, label, formatValue, onInput, color }) {
  const wrap = document.createElement('div');
  wrap.className = 'pot';
  // Optional: color this one control explicitly (e.g. several differently-themed
  // pots sharing one row-section) rather than relying on an ancestor row's color --
  // pot-value/pot-label/pot-pointer all use `color: inherit`/`currentColor`, so this
  // one assignment re-themes the whole control.
  if (color) wrap.style.color = color;

  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 44 44');
  svg.classList.add('pot-svg');

  const track = document.createElementNS(SVG_NS, 'circle');
  track.setAttribute('cx', 22); track.setAttribute('cy', 22); track.setAttribute('r', 16);
  track.classList.add('pot-track');
  svg.appendChild(track);

  for (let i = 0; i < visualTicks; i++) {
    const t = visualTicks === 1 ? 0 : i / (visualTicks - 1);
    const angle = (-SWEEP_DEG / 2 + t * SWEEP_DEG) * (Math.PI / 180);
    const tick = document.createElementNS(SVG_NS, 'line');
    tick.setAttribute('x1', 22 + Math.sin(angle) * 17.5);
    tick.setAttribute('y1', 22 - Math.cos(angle) * 17.5);
    tick.setAttribute('x2', 22 + Math.sin(angle) * 20.5);
    tick.setAttribute('y2', 22 - Math.cos(angle) * 20.5);
    tick.classList.add('pot-tick');
    svg.appendChild(tick);
  }

  const pointer = document.createElementNS(SVG_NS, 'line');
  pointer.setAttribute('x1', 22); pointer.setAttribute('y1', 22);
  pointer.classList.add('pot-pointer');
  svg.appendChild(pointer);

  wrap.appendChild(svg);

  // Value + label sit beside the knob (not underneath) to keep each control's total
  // height close to just the knob's own height -- rows of these stay compact.
  const text = document.createElement('div');
  text.className = 'pot-text';

  const valueLabel = document.createElement('span');
  valueLabel.className = 'pot-value';
  text.appendChild(valueLabel);

  if (label) {
    const labelEl = document.createElement('span');
    labelEl.className = 'pot-label';
    labelEl.textContent = label;
    text.appendChild(labelEl);
  }

  wrap.appendChild(text);

  let current = value;

  function render() {
    const angle = angleFor(min, max, current);
    pointer.setAttribute('x2', 22 + Math.sin(angle) * 13);
    pointer.setAttribute('y2', 22 - Math.cos(angle) * 13);
    valueLabel.textContent = formatValue ? formatValue(current) : current.toFixed(2);
  }

  function quantize(v) {
    v = Math.max(min, Math.min(max, v));
    return step > 0 ? Math.round(v / step) * step : v;
  }

  // Internal setter (drag) -- quantizes, re-renders, and notifies onInput.
  function updateFromDrag(v) {
    current = quantize(v);
    render();
    if (onInput) onInput(current);
  }

  let dragStartY = 0, dragStartValue = 0, dragging = false;
  svg.addEventListener('pointerdown', e => {
    dragging = true;
    dragStartY = e.clientY;
    dragStartValue = current;
    svg.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  svg.addEventListener('pointermove', e => {
    if (!dragging) return;
    const dy = dragStartY - e.clientY; // dragging up increases the value
    updateFromDrag(dragStartValue + (dy / DRAG_RANGE_PX) * (max - min));
  });
  svg.addEventListener('pointerup', () => { dragging = false; });
  svg.addEventListener('pointercancel', () => { dragging = false; });

  render();

  return {
    el: wrap,
    get value() { return current; },
    // External setter (preset load, MIDI CC, hotkeys) -- does NOT call onInput, same
    // as setting a native <input>'s .value property doesn't fire its own 'input'
    // event. The caller is expected to already be the source of truth pushing a value
    // in, not reacting to one.
    setValue(v) {
      current = quantize(v);
      render();
    }
  };
}
