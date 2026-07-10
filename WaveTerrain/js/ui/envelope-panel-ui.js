// Four ADSR faders into #env-panel
import { STEPS } from '../core/config.js';
import { getEnvelope } from '../audio/engine.js';

const FADERS = [
  { id: 'attack',  label: 'A', min: 0.001, max: 2, step: STEPS.attack,  get: e => e.attack,  set: (e, v) => e.setAttack(v) },
  { id: 'decay',   label: 'D', min: 0.001, max: 2, step: STEPS.decay,   get: e => e.decay,   set: (e, v) => e.setDecay(v) },
  { id: 'sustain', label: 'S', min: 0,     max: 1, step: STEPS.sustain, get: e => e.sustain, set: (e, v) => e.setSustain(v) },
  { id: 'release', label: 'R', min: 0.001, max: 3, step: STEPS.release, get: e => e.release, set: (e, v) => e.setRelease(v) }
];

// Decorative reference lines running the length of the fader
function buildTicks(count = 11) {
  const ticks = document.createElement('div');
  ticks.className = 'vfader-ticks';
  for (let i = 0; i < count; i++) ticks.appendChild(document.createElement('span'));
  return ticks;
}

// Call once, after initAudio() has resolved (so the envelope node exists). This
// module builds its own DOM (document.createElement + appendChild) instead of
// editing pre-written HTML, driven by the FADERS table above -- that's what makes
// adding a 5th envelope stage later a one-line change here rather than modify
// index.html too.
export function initEnvelopePanelUI() {
  const container = document.getElementById('env-panel');
  const envelope = getEnvelope();
  if (!container || !envelope) return;
  container.innerHTML = '';

  for (const f of FADERS) {
    const col = document.createElement('div');
    col.className = 'env-fader-col';

    const input = document.createElement('input');
    input.type = 'range';
    input.className = 'vfader';
    input.min = f.min; input.max = f.max; input.step = f.step;
    input.value = f.get(envelope);

    input.oninput = () => f.set(envelope, parseFloat(input.value));

    const faderWithTicks = document.createElement('div');
    faderWithTicks.className = 'vfader-with-ticks';
    faderWithTicks.append(buildTicks(), input);

    const letter = document.createElement('span');
    letter.className = 'env-fader-label';
    letter.textContent = f.label;

    col.append(faderWithTicks, letter);
    container.appendChild(col);
  }
}
