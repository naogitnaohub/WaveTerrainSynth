// Compact per-LFO UI: a mini waveform-shape icon picker, a blinking LED (color = shape,
// blink period = the LFO's own rate), and rate/depth potentiometers. Kept separate
// from mod-matrix-ui.js (routing) and envelope-panel-ui.js (ADSR) -- one file per
// modulation-panel section, so adding a third LFO later is a data change here only.
import { STEPS } from '../core/config.js';
import { getLFO } from '../audio/engine.js';
import { LFO_SHAPES } from '../audio/modulation/lfo.js';
import { createPotentiometer } from './potentiometer.js';

export const LFO_IDS = ['lfo1', 'lfo2'];

const SHAPE_COLOR = { sine: '#4ade80', triangle: '#fb923c', square: '#facc15' };

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

  const potsRow = document.createElement('div');
  potsRow.className = 'lfo-pots-row';

  const ratePot = createPotentiometer({
    min: 0.05, max: 20, step: STEPS.lfoRate, value: lfo.rate, visualTicks: 11,
    label: 'RATE', formatValue: v => `${v.toFixed(2)}Hz`,
    onInput: v => { lfo.setRate(v); updateLed(); }
  });
  const depthPot = createPotentiometer({
    min: 0, max: 1, step: STEPS.lfoDepth, value: lfo.depth, visualTicks: 11,
    label: 'DEPTH', formatValue: v => v.toFixed(2),
    onInput: v => lfo.setDepth(v)
  });
  potsRow.append(ratePot.el, depthPot.el);

  header.append(title, led);
  block.append(header, shapesRow, potsRow);

  return block;
}

// Call once, after initAudio() has resolved (so the LFO nodes exist).
export function initLfoPanelUI() {
  const container = document.getElementById('lfo-panel');
  if (!container) return;
  container.innerHTML = '';
  LFO_IDS.forEach((id, i) => {
    // A thin vertical rule between LFO1 and LFO2 (and, via index.html, another one
    // between this whole panel and the ADSR envelope) -- a visual module boundary,
    // like the dividers between sections on a real modular synth panel.
    if (i > 0) {
      const divider = document.createElement('div');
      divider.className = 'module-divider';
      container.appendChild(divider);
    }
    container.appendChild(buildLfoBlock(id));
  });
}
