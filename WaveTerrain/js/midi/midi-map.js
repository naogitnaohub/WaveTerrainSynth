// midi-map.js made by CLaude (AI)

// MIDI-learn registry. Any control (pot, slider, fader, mod-matrix
// cell) registers itself once as a "target". A learn-mode toggle arms a
// target, then binds it by moving a physical MIDI CC knob.
// Has no dependency on ui/input.js
const STORAGE_KEY = 'waveterrain-midi-cc-map';

// id -> { min, max, setValue, el }
const targets = {};

// One binding table for both kinds of physical control, keyed so they can't
// collide: a bare number string ("74") is a CC number (kept as-is so existing
// saved mappings still work); "n"-prefixed ("n1") is a MIDI note number. The
// value is the target id either way.
function ccKey(cc) { return `${cc}`; }
function noteKey(note) { return `n${note}`; }

function readMap() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === null) return { 1: 'fm-index', 74: 'param-a', 7: 'volume' }; // first-run defaults, matches the old hardcoded CC_MAP
  try {
    return JSON.parse(raw) || {};
  } catch {
    return {};
  }
}

function writeMap() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(bindingMap));
}

const bindingMap = readMap();

let learnMode = false;
let armedId = null;
let listenersInstalled = false;

function setArmed(id) {
  if (armedId && targets[armedId]) targets[armedId].el.classList.remove('midi-armed');
  armedId = id;
  if (id && targets[id]) targets[id].el.classList.add('midi-armed');
}

// `label` is the CC##/N## badge text and tooltip -- computed by the caller
// (bindKeyToArmedTarget) from whichever key format was used.
function markMapped(id, key, label) {
  const t = targets[id];
  if (!t) return;
  t.el.classList.add('midi-mapped');
  t.el.dataset.midiKey = key;
  t.el.dataset.midiLabel = label;
  // Some targets (mod-matrix cells) already carry a meaningful title (e.g.
  // "lfo1 -> yScale"); preserve it instead of overwriting it with the MIDI
  // badge text -- the CSS ::after badge only renders on pots/cells, not
  // <input> faders/sliders, so the title is what those fall back to.
  if (t.el.dataset.baseTitle === undefined) t.el.dataset.baseTitle = t.el.title || '';
  const base = t.el.dataset.baseTitle;
  t.el.title = base ? `${base} (MIDI ${label})` : `MIDI ${label}`;
}

function clearMapped(id) {
  const t = targets[id];
  if (!t) return;
  t.el.classList.remove('midi-mapped');
  delete t.el.dataset.midiKey;
  delete t.el.dataset.midiLabel;
  if (t.el.dataset.baseTitle) t.el.title = t.el.dataset.baseTitle;
  else t.el.removeAttribute('title');
}

// Binds whichever key (CC key or note key) was just moved/pressed to the
// currently armed target -- shared by applyCc and applyNote below.
function bindKeyToArmedTarget(key, label) {
  const id = armedId;
  if (!id) return;

  const prevId = bindingMap[key];
  if (prevId !== undefined && prevId !== id) clearMapped(prevId); // this key pointed elsewhere -- that control is no longer mapped

  for (const existingKey of Object.keys(bindingMap)) {
    if (bindingMap[existingKey] === id) delete bindingMap[existingKey]; // a control can only hold one CC/note at a time
  }

  bindingMap[key] = id;
  writeMap();
  targets[id].el.classList.remove('midi-armed');
  markMapped(id, key, label);
  armedId = null;
}

function unmapTarget(id) {
  const key = Object.keys(bindingMap).find(k => bindingMap[k] === id);
  if (key === undefined) return;
  delete bindingMap[key];
  writeMap();
  clearMapped(id);
}

// Removes every mapping (CC and note) at once -- the "Clear All" button next
// to MIDI MAP. Only touches currently registered targets' visuals; writeMap()
// persists the now-empty map regardless.
function unmapAll() {
  Object.keys(bindingMap).forEach(key => delete bindingMap[key]);
  writeMap();
  Object.keys(targets).forEach(clearMapped);
}

// Called once per control, wherever it's built (ui/input.js, lfo-panel-ui.js,
// envelope-panel-ui.js, mod-matrix-ui.js). Tags `el` so the document-level
// learn-mode listeners can find it, and restores its mapped indicator if it
// was already bound in a past session.
export function registerMidiTarget(id, { min, max, setValue, el }) {
  targets[id] = { min, max, setValue, el };
  el.dataset.midiId = id;
  const key = Object.keys(bindingMap).find(k => bindingMap[k] === id);
  if (key !== undefined) markMapped(id, key, key.startsWith('n') ? `N${key.slice(1)}` : `CC${key}`);
}

function applyToTarget(id, value7bit) {
  const target = id && targets[id];
  if (!target) return;
  target.setValue(target.min + (value7bit / 127) * (target.max - target.min)); // 0-127 -> [min, max]
}

// Applies an incoming CC message: while learn mode is armed, binds it;
// otherwise looks up the mapping and pushes the value through. Called by midi.js.
export function applyCc(cc, value7bit) {
  if (learnMode && armedId) {
    bindKeyToArmedTarget(ccKey(cc), `CC${cc}`);
    return;
  }
  applyToTarget(bindingMap[ccKey(cc)], value7bit);
}

// Applies an incoming note message (on or off): while learn mode is armed,
// binds the note number -- lets a controller's fixed-note buttons (e.g. Akai
// MIDI Mix mute buttons, always Note 1/4/7/..., not switchable to CC) be
// repurposed as a control instead of always playing that note's pitch.
// Otherwise, if the note is mapped, pushes the value through on press
// (velocity > 0), does nothing on release, same as a momentary button.
// Returns whether the note was consumed -- if false, midi.js falls through to
// its normal "play this note" handling.
export function applyNote(note, velocity) {
  if (learnMode && armedId) {
    bindKeyToArmedTarget(noteKey(note), `N${note}`);
    return true;
  }
  const id = bindingMap[noteKey(note)];
  if (id === undefined) return false;
  if (velocity > 0) applyToTarget(id, velocity);
  return true;
}

function installListeners() {
  if (listenersInstalled) return;
  listenersInstalled = true;

  // Capture phase: fires before a pot/fader's own bubble-phase drag listener,
  // so it can swallow the event and arm the control instead of letting it drag.
  document.addEventListener('pointerdown', e => {
    if (!learnMode) return;
    const el = e.target.closest('[data-midi-id]'); // closest(): nearest matching ancestor, or the element itself
    if (!el) return;
    e.stopPropagation();
    e.preventDefault();
    setArmed(el.dataset.midiId);
  }, true); // true: listen during the capture phase, not the bubble phase

  document.addEventListener('contextmenu', e => {
    if (!learnMode) return;
    const el = e.target.closest('[data-midi-id]');
    if (!el) return;
    e.preventDefault();
    unmapTarget(el.dataset.midiId);
  }, true);
}

export function setLearnMode(active) {
  learnMode = active;
  document.getElementById('control-panel')?.classList.toggle('midi-learn-mode', active);
  if (!active) setArmed(null);
}

// Called once at startup (needs only the DOM, not audio) to wire the toggle
// button and the "clear all" button next to it. A single mapping is removed
// by right-clicking its control while in learn mode (see installListeners'
// contextmenu handler above); clearing everything at once skips that
// per-control step but asks for confirmation first, since unlike a single
// unmap it can't be undone.
export function initMidiLearnButton() {
  const btn = document.getElementById('midi-map-btn');
  if (btn) {
    installListeners();
    btn.onclick = () => {
      setLearnMode(!learnMode);
      btn.classList.toggle('active', learnMode);
    };
  }

  const clearBtn = document.getElementById('midi-clear-btn');
  if (clearBtn) {
    clearBtn.onclick = () => {
      if (Object.keys(bindingMap).length === 0) return;
      if (confirm('Clear all MIDI mappings? This cannot be undone.')) unmapAll();
    };
  }
}
