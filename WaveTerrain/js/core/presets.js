// Save/load a preset "patch": synth params, orbit position, envelope, LFOs, and
// the mod matrix routings.
// Storage is a single  localStorage entry holding { [name]: presetData }

import { CONFIG, setOrbitState } from './config.js';
import { getEnvelope, getLFO, updateAudioSynth } from '../audio/engine.js';
import * as modMatrix from '../audio/modulation/mod-matrix.js';
import { applySynthState } from '../ui/input.js';
import { LFO_IDS } from '../ui/lfo-panel-ui.js';

const STORAGE_KEY = 'waveterrain-presets';

function readStore() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {}; // corrupted/missing storage don't crash the app, but start empty
  }
}

function writeStore(store) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

// Snapshot  as plain json data.
function collectState() {
  const envelope = getEnvelope();
  return {
    synth: { ...CONFIG.synth },
    orbit: { ...CONFIG.orbit },
    envelope: envelope
      ? { attack: envelope.attack, decay: envelope.decay, sustain: envelope.sustain, release: envelope.release }
      : null,
    lfos: Object.fromEntries(LFO_IDS.map(id => {
      const lfo = getLFO(id);
      return [id, lfo ? { rate: lfo.rate, type: lfo.type, depth: lfo.depth } : null];
    })),
    routes: modMatrix.getAllRoutes()
  };
}

// Push a snapshot (from collectState(), i.e. a loaded preset) back into the app.
function applyState(state) {
  if (state.synth) applySynthState(state.synth);

  if (state.orbit) {
    setOrbitState(state.orbit.cx, state.orbit.cz, state.orbit.r);
    updateAudioSynth(); // setOrbitState only touches CONFIG -- this pushes it to the worklet
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
  (state.routes || []).forEach(({ source, dest, depth }) => modMatrix.route(source, dest, depth));
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

// Downloads the whole preset library as one .json file
export function exportToFile() {
  const blob = new Blob([JSON.stringify(readStore(), null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'waveterrain-presets.json';
  a.click();
  URL.revokeObjectURL(url);
}

// Merges an exported file back in (by name -- an imported preset with the same name
// as an existing one overwrites it). Returns the merged preset names for the UI to
// update its list
export async function importFromFile(file) {
  const text = await file.text();
  const incoming = JSON.parse(text);
  const store = readStore();
  Object.assign(store, incoming);
  writeStore(store);
  return listPresetNames();
}
