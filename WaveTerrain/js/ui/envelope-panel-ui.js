// Builds the four ADSR faders into #env-panel. Kept as its own file, separate from
// lfo-panel-ui.js / mod-matrix-ui.js, so each modulation-panel section stays a
// one-file, one-concern unit -- easy to find, easy to extend independently.
import { getEnvelope } from '../audio/engine.js';

const FADERS = [
  { id: 'attack',  label: 'A', min: 0.001, max: 2, step: 0.001, get: e => e.attack,  set: (e, v) => e.setAttack(v) },
  { id: 'decay',   label: 'D', min: 0.001, max: 2, step: 0.001, get: e => e.decay,   set: (e, v) => e.setDecay(v) },
  { id: 'sustain', label: 'S', min: 0,     max: 1, step: 0.01,  get: e => e.sustain, set: (e, v) => e.setSustain(v) },
  { id: 'release', label: 'R', min: 0.001, max: 3, step: 0.001, get: e => e.release, set: (e, v) => e.setRelease(v) }
];

function formatValue(id, v) {
  return id === 'sustain' ? v.toFixed(2) : `${v.toFixed(2)}s`;
}

// Call once, after initAudio() has resolved (so the envelope node exists). This
// module builds its own DOM (document.createElement + appendChild) instead of
// editing pre-written HTML, driven by the FADERS table above -- that's what makes
// adding a 5th envelope stage later a one-line change here rather than an edit in
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

    const valueLabel = document.createElement('span');
    valueLabel.className = 'env-fader-value';
    valueLabel.textContent = formatValue(f.id, f.get(envelope));

    input.oninput = () => {
      const v = parseFloat(input.value);
      f.set(envelope, v);
      valueLabel.textContent = formatValue(f.id, v);
    };

    const letter = document.createElement('span');
    letter.className = 'env-fader-label';
    letter.textContent = f.label;

    col.append(input, letter, valueLabel);
    container.appendChild(col);
  }
}
