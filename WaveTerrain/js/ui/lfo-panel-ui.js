// LFO panel UI: a waveform-shape icon picker, a blinking LED (color = shape,
// blink period = LFO rate), and rate/depth potentiometers.
import { STEPS } from '../core/config.js';
import { getLFO } from '../audio/engine.js';
import { LFO_SHAPES } from '../audio/modulation/lfo.js';
import { createPotentiometer } from './potentiometer.js';
import { registerMidiTarget } from '../midi/midi-map.js';

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

  // The LED's blink is a CSS animation (see the lfo-blink @keyframes in
  // style.css); this just keeps its color and animation-duration (1/rate =
  // the LFO's period in seconds) in sync when shape or rate change.
  const led = document.createElement('span');
  led.className = 'lfo-led';
  const updateLed = () => {
    const color = SHAPE_COLOR[lfo.type];
    led.style.background = color;
    led.style.color = color; // the CSS glow (box-shadow) uses currentColor, so this drives it too
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

  registerMidiTarget(`${id}-rate`, {
    min: 0.05, max: 20, el: ratePot.el,
    setValue: v => { lfo.setRate(v); ratePot.setValue(v); updateLed(); }
  });
  registerMidiTarget(`${id}-depth`, {
    min: 0, max: 1, el: depthPot.el,
    setValue: v => { lfo.setDepth(v); depthPot.setValue(v); }
  });

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
    if (i > 0) { // vertical line btw LFO1 and LFO2
      const divider = document.createElement('div');
      divider.className = 'module-divider';
      container.appendChild(divider);
    }
    container.appendChild(buildLfoBlock(id));
  });
}
