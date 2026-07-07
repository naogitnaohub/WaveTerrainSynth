// Compact per-LFO UI: a mini waveform-shape icon picker, a blinking LED (color = shape,
// blink period = the LFO's own rate), and small rate/depth faders. Kept separate from
// mod-matrix-ui.js (routing) and envelope-panel-ui.js (ADSR) -- one file per
// modulation-panel section, so adding a third LFO later is a data change here only.
import { getLFO } from '../audio/engine.js';
import { LFO_SHAPES } from '../audio/modulation/lfo.js';

const LFO_IDS = ['lfo1', 'lfo2'];

const SHAPE_COLOR = { sine: '#4ade80', triangle: '#fb923c', square: '#f472b6' };

const SHAPE_ICON_PATHS = {
  sine: '<path d="M1 6 C2 1 4 1 6 6 C8 11 10 11 11 6" />',
  triangle: '<polyline points="1,9 3.5,2 6,9 8.5,2 11,9" />',
  square: '<polyline points="1,3 4,3 4,9 7,9 7,3 10,3" />'
};

function buildShapeButton(shape, lfo, buttons, updateLed) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'shape-btn' + (lfo.type === shape ? ' active' : '');
  btn.title = shape;
  btn.innerHTML = `<svg viewBox="0 0 12 12">${SHAPE_ICON_PATHS[shape]}</svg>`;
  btn.onclick = () => {
    lfo.setType(shape);
    Object.entries(buttons).forEach(([s, b]) => b.classList.toggle('active', s === shape));
    updateLed();
  };
  return btn;
}

function buildMiniFader(formatLabel, min, max, step, value, onInput) {
  const row = document.createElement('div');
  row.className = 'lfo-fader-row';

  const input = document.createElement('input');
  input.type = 'range';
  input.className = 'mini-slider';
  input.min = min; input.max = max; input.step = step; input.value = value;

  const valueLabel = document.createElement('span');
  valueLabel.className = 'env-fader-value';
  valueLabel.textContent = formatLabel(value);

  input.oninput = () => {
    const v = parseFloat(input.value);
    onInput(v);
    valueLabel.textContent = formatLabel(v);
  };

  row.append(input, valueLabel);
  return row;
}

function buildLfoBlock(id) {
  const lfo = getLFO(id);
  const block = document.createElement('div');
  block.className = 'lfo-block';
  if (!lfo) return block;

  const header = document.createElement('div');
  header.className = 'lfo-block-header';

  const title = document.createElement('span');
  title.className = 'env-fader-label';
  title.textContent = id.toUpperCase();

  // The LED's actual blinking is a CSS animation (see the lfo-blink @keyframes in
  // style.css); this function just keeps its color (by shape) and animation-duration
  // (1 / rate = the LFO's period in seconds) in sync whenever the shape or rate changes.
  const led = document.createElement('span');
  led.className = 'lfo-led';
  const updateLed = () => {
    const color = SHAPE_COLOR[lfo.type];
    led.style.background = color;
    led.style.color = color; // box-shadow in CSS uses currentColor, so this drives the glow too
    led.style.animationDuration = `${1 / lfo.rate}s`;
  };
  updateLed();

  const shapesRow = document.createElement('div');
  shapesRow.className = 'shape-btn-row';
  const buttons = {};
  LFO_SHAPES.forEach(shape => {
    const btn = buildShapeButton(shape, lfo, buttons, updateLed);
    buttons[shape] = btn;
    shapesRow.appendChild(btn);
  });

  header.append(title, led);
  block.append(
    header,
    shapesRow,
    buildMiniFader(v => `${v.toFixed(2)}Hz`, 0.05, 20, 0.05, lfo.rate, v => { lfo.setRate(v); updateLed(); }),
    buildMiniFader(v => v.toFixed(2), 0, 1, 0.01, lfo.depth, v => lfo.setDepth(v))
  );

  return block;
}

// Call once, after initAudio() has resolved (so the LFO nodes exist).
export function initLfoPanelUI() {
  const container = document.getElementById('lfo-panel');
  if (!container) return;
  container.innerHTML = '';
  LFO_IDS.forEach(id => container.appendChild(buildLfoBlock(id)));
}
