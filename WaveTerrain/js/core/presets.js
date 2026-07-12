// Save/load/delete a preset: synth params, orbit position, envelope, LFOs, and mod-matrix routes. 
// Export/import takes the whole preset library as one .json file. 
// Storage: one localStorage entry holding { [name]: presetData }.

import { CONFIG, setOrbitState } from './config.js';
import { getEnvelope, getLFO, updateAudioSynth } from '../audio/engine.js';
import * as modMatrix from '../audio/modulation/mod-matrix.js'; // namespace import: every export available as modMatrix.xxx
import { applySynthState } from '../ui/input.js';
import { LFO_IDS } from '../ui/lfo-panel-ui.js';

const STORAGE_KEY = 'waveterrain-presets';

function readStore() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {}; // corrupted/missing storage: fall back to empty instead of throwing
  }
}

function writeStore(store) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

// Snapshot of everything a preset stores, as one plain JSON-serializable object.
function collectState() {
  const envelope = getEnvelope();
  return {
    synth: { ...CONFIG.synth }, // spread: shallow copy, so later CONFIG edits can't mutate this saved snapshot
    orbit: { ...CONFIG.orbit },
    envelope: envelope
      ? { attack: envelope.attack, decay: envelope.decay, sustain: envelope.sustain, release: envelope.release }
      : null,
    lfos: Object.fromEntries(LFO_IDS.map(id => { // builds { lfo1: {...}, lfo2: {...} } from the id list
      const lfo = getLFO(id);
      return [id, lfo ? { rate: lfo.rate, type: lfo.type, depth: lfo.depth } : null];
    })),
    routes: modMatrix.getAllRoutes()
  };
}

// Restores a snapshot (from collectState(), i.e. a loaded preset) into the app.
function applyState(state) {
  if (state.synth) applySynthState(state.synth);

  if (state.orbit) {
    setOrbitState(state.orbit.cx, state.orbit.cz, state.orbit.r);
    updateAudioSynth(); // setOrbitState only writes CONFIG -- push it to the worklet too
  }

  const envelope = getEnvelope();
  if (envelope && state.envelope) {
    envelope.setAttack(state.envelope.attack);
    envelope.setDecay(state.envelope.decay);
    envelope.setSustain(state.envelope.sustain);
    envelope.setRelease(state.envelope.release);
  }

  LFO_IDS.forEach(id => {
    const lfo = getLFO(id);
    const saved = state.lfos && state.lfos[id];
    if (!lfo || !saved) return;
    lfo.setRate(saved.rate);
    lfo.setType(saved.type);
    lfo.setDepth(saved.depth);
  });

  modMatrix.clearAllRoutes();
  (state.routes || []).forEach(({ source, dest, depth }) => modMatrix.route(source, dest, depth)); // destructured callback param
}

export function listPresetNames() {
  return Object.keys(readStore()).sort();
}

export function savePreset(name) {
  if (!name) return;
  const store = readStore();
  store[name] = collectState();
  writeStore(store);
}

export function loadPreset(name) {
  const store = readStore();
  if (store[name]) applyState(store[name]);
}

export function deletePreset(name) {
  const store = readStore();
  delete store[name];
  writeStore(store);
}

// Downloads the whole preset library as one .json file.
export function exportToFile() {
  const blob = new Blob([JSON.stringify(readStore(), null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob); // temporary in-memory URL pointing at the blob
  const a = document.createElement('a');
  a.href = url;
  a.download = 'waveterrain-presets.json';
  a.click(); // triggers the browser's download without the element ever being shown
  URL.revokeObjectURL(url); // frees the blob URL now that the download has started
}

// Merges an exported file back in -- an imported preset with the same name as
// an existing one overwrites it. Returns the merged list of names for the UI.
export async function importFromFile(file) {
  const text = await file.text(); // File.text(): reads the file's contents as a string
  const incoming = JSON.parse(text);
  const store = readStore();
  Object.assign(store, incoming); // merges incoming keys into store, overwriting collisions
  writeStore(store);
  return listPresetNames();
}
