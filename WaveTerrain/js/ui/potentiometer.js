// potentiometer.js written by CLAUDE (AI)

// Custom SVG rotary knob, driven by vertical drag.
// Maps a fixed pixel distance (DRAG_RANGE_PX) across the full [min, max] range.
// Intentionally has no "click-to-jump" behavior.

const SWEEP_DEG = 270;       // -135deg (min) to +135deg (max), the knob's visual range
const DRAG_RANGE_PX = 150;   // vertical drag distance (px) spanning the full min..max range
const SVG_NS = 'http://www.w3.org/2000/svg'; // SVG elements need this namespace; regular HTML elements don't

function angleFor(min, max, value) {
  const frac = max === min ? 0 : (value - min) / (max - min);
  return (-SWEEP_DEG / 2 + frac * SWEEP_DEG) * (Math.PI / 180); // degrees -> radians, for Math.sin/cos below
}

export function createPotentiometer({ min, max, step = 1, value, visualTicks = 11, label, formatValue, onInput, color }) {
  const wrap = document.createElement('div');
  wrap.className = 'pot';
  if (color) wrap.style.color = color;

  const svg = document.createElementNS(SVG_NS, 'svg'); // createElementNS: required for SVG tags, createElement is HTML-only
  svg.setAttribute('viewBox', '0 0 44 44');
  svg.classList.add('pot-svg');

  const track = document.createElementNS(SVG_NS, 'circle');
  track.setAttribute('cx', 22); track.setAttribute('cy', 22); track.setAttribute('r', 16);
  track.classList.add('pot-track');
  svg.appendChild(track);

  // Tick marks around the dial, evenly spaced across the sweep
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

  const pointer = document.createElementNS(SVG_NS, 'line'); // the needle showing the current value
  pointer.setAttribute('x1', 22); pointer.setAttribute('y1', 22);
  pointer.classList.add('pot-pointer');
  svg.appendChild(pointer);

  wrap.appendChild(svg);

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

  let current = value; // closure variable: this knob's live value, private to this instance

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

  // Internal setter used while dragging -- quantizes, re-renders, notifies onInput.
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
    svg.setPointerCapture(e.pointerId); // keeps receiving pointermove even if the cursor leaves the SVG
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
    get value() { return current; }, // getter: reads like a plain property, runs this code when accessed
    // External setter (preset load, MIDI CC, hotkeys) -- does NOT call
    // onInput, same as setting a native <input>'s .value property doesn't
    // fire its own 'input' event. The caller is the source of truth pushing a
    // value in here, not reacting to one coming out.
    setValue(v) {
      current = quantize(v);
      render();
    }
  };
}
