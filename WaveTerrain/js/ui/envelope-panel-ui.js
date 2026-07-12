// ADSR envelope UI: four vertical faders (attack/decay/sustain/release) into #env-panel.
import { STEPS } from '../core/config.js';
import { getEnvelope } from '../audio/engine.js';
import { registerMidiTarget } from '../midi/midi-map.js';

// Table-driven: adding a 5th stage later is one line to change here, not index.html
const FADERS = [
  { id: 'attack',  label: 'A', min: 0.001, max: 2, step: STEPS.attack,  get: e => e.attack,  set: (e, v) => e.setAttack(v) },
  { id: 'decay',   label: 'D', min: 0.001, max: 2, step: STEPS.decay,   get: e => e.decay,   set: (e, v) => e.setDecay(v) },
  { id: 'sustain', label: 'S', min: 0,     max: 1, step: STEPS.sustain, get: e => e.sustain, set: (e, v) => e.setSustain(v) },
  { id: 'release', label: 'R', min: 0.001, max: 3, step: STEPS.release, get: e => e.release, set: (e, v) => e.setRelease(v) }
];

// Decorative lines along the length of  fader
function buildTicks(count = 11) {
  const ticks = document.createElement('div');
  ticks.className = 'vfader-ticks';
  for (let i = 0; i < count; i++) ticks.appendChild(document.createElement('span'));
  return ticks;
}

// Call once, after initAudio() has resolved (so the envelope node exists).
// Builds its own DOM (createElement + appendChild) from the FADERS table
// above (no editing pre-written HTML)
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

    registerMidiTarget(`env-${f.id}`, {
      min: f.min, max: f.max, el: input,
      setValue: v => { f.set(envelope, v); input.value = v; }
    });

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
