// Converts raw browser input  into changes to CONFIG + the audio engine. 
// MIDI (midi/midi.js) reuses syncUI() from here rather than duplicating the code :
// MIDI CC and a knob drag both end as one call.
import { CONFIG, STEPS, LIMITS, updateSynthParam, updateOrbitState } from '../core/config.js';
import { updateAudioSynth, updateAudioWaveform, resumeAudio, noteOn, noteOff } from '../audio/engine.js';
import { rebuildTerrainMesh } from '../render/renderer.js';
import { createPotentiometer } from './potentiometer.js';
import { registerMidiTarget } from '../midi/midi-map.js';

const keys = {}, mouse = { x: 0, y: 0 };
let isDragging = false;

// One entry per control: p = CONFIG.synth key to drive, f = how to
// format its display value,
// kind/mount/id = which widget it is and where it lives. `volume` is the one
// control that stays a <input type=range> (id points at its HTML
// element); everything else is a potentiometer built at startup and mounted
// into `mount`.
const GREEN = '#4ade80', YELLOW = '#facc15';
const UI_MAP = {
  "wave-select": { p: 'waveNumber', kind: 'pot', mount: 'wave-mount', label: 'WAVE', f: v => `${v}`, visualTicks: LIMITS.waveNumber.max - LIMITS.waveNumber.min + 1, color: GREEN, cb: v => { rebuildTerrainMesh(); updateAudioWaveform(v); } },
  "y-scale":     { p: 'yScale',     kind: 'pot', mount: 'yscale-mount', label: 'Y-SCALE',  f: v => v.toFixed(1), color: GREEN },
  "param-a":     { p: 'a',          kind: 'pot', mount: 'a-mount',      label: 'A',        f: v => v.toFixed(2), color: GREEN, cb: () => rebuildTerrainMesh() },
  "volume":      { p: 'volume',     kind: 'slider', f: v => `${~~(v * 100)}%` },
  "freq":        { p: 'frequency', kind: 'pot', mount: 'freq-mount',    label: 'FREQ',     f: v => `${~~v}Hz`, color: YELLOW },
  "fm-ratio":    { p: 'fmRatio',    kind: 'pot', mount: 'fmratio-mount', label: 'FM R', f: v => v.toFixed(2), color: YELLOW },
  "fm-index":    { p: 'fmInt',    kind: 'pot', mount: 'fmindex-mount', label: 'FM I', f: v => `${~~v}`, color: YELLOW }
};

const controls = {}; // id -> { kind: 'pot'|'slider', ref: potentiometer instance | <input> element }

// Steps the wave shape by one, wrapping at either end -- used by q/w hotkeys.
function stepWave(dir) {
  const n = CONFIG.synth.waveNumber;
  if (dir < 0) syncUI('wave-select', n === LIMITS.waveNumber.min ? LIMITS.waveNumber.max : n - 1);
  else syncUI('wave-select', n === LIMITS.waveNumber.max ? LIMITS.waveNumber.min : n + 1);
}

// The one function every input path (knob drag, hotkey, MIDI CC) calls to
// apply a new value: 
// - clamps and stores it in CONFIG
// - updates the control on screen position,
// - runs its extra callback if any
// - pushes everything to the audio engine.
export function syncUI(id, val) {
  const cfg = UI_MAP[id];
  if (!cfg) return;
  updateSynthParam(cfg.p, val);
  const actualVal = CONFIG.synth[cfg.p]; // re-read: updateSynthParam may have clamped `val`

  const control = controls[id];
  if (control?.kind === 'pot') control.ref.setValue(actualVal);
  else if (control?.kind === 'slider') control.ref.value = actualVal;

  const disp = document.getElementById(`${id}-display`); // only the volume slider still has one of these
  if (disp) disp.textContent = cfg.f(actualVal);
  if (cfg.cb) cfg.cb(actualVal);
  updateAudioSynth();
}

// Applies a { [CONFIG.synth key]: value } object (ex. preset)
// through the same syncUI() path like any other input
export function applySynthState(values) {
  Object.keys(UI_MAP).forEach(id => {
    const p = UI_MAP[id].p;
    if (values[p] !== undefined) syncUI(id, values[p]);
  });
}

// Builds the potentiometers and wires the volume slider. Call once at
// startup -- unlike the modulation panel's controls, these don't need audio
// to exist yet, only their mount points in the DOM.
export function initMainControls() {
  Object.keys(UI_MAP).forEach(id => {
    const cfg = UI_MAP[id];

    const limits = LIMITS[cfg.p] || { min: 0, max: 1 };

    if (cfg.kind === 'slider') {
      const el = document.getElementById(id);
      if (!el) return;
      if (STEPS[cfg.p] !== undefined) el.step = STEPS[cfg.p];
      el.oninput = function() { syncUI(id, parseFloat(this.value)); };
      controls[id] = { kind: 'slider', ref: el };
      registerMidiTarget(id, { min: limits.min, max: limits.max, setValue: v => syncUI(id, v), el });
      syncUI(id, CONFIG.synth[cfg.p]);
      return;
    }

    const mount = document.getElementById(cfg.mount);
    if (!mount) return;
    const pot = createPotentiometer({
      min: limits.min, max: limits.max, step: STEPS[cfg.p] ?? 1,
      value: CONFIG.synth[cfg.p], visualTicks: cfg.visualTicks ?? 11,
      label: cfg.label, formatValue: cfg.f, color: cfg.color,
      onInput: v => syncUI(id, v)
    });
    mount.appendChild(pot.el);
    controls[id] = { kind: 'pot', ref: pot };
    registerMidiTarget(id, { min: limits.min, max: limits.max, setValue: v => syncUI(id, v), el: pot.el });
  });
}

export function initInputHandlers() {
  const win = window;

  // Spacebar doubles as a "note" gate for testing without a MIDI controller --
  // noteOn/noteOff is the same entry point a MIDI note-on/note-off calls.
  win.addEventListener("keydown", e => {
    keys[e.key] = true;
    if (e.code === "Space" && !e.repeat) {
      e.preventDefault(); // stop the page from scrolling
      resumeAudio();
      noteOn();
    }
  });
  win.addEventListener("keyup", e => {
    keys[e.key] = false;
    if (e.code === "Space") {
      e.preventDefault();
      noteOff();
    }
  });
  win.addEventListener("mousedown", e => e.target.id === "canvas" && (isDragging = true, mouse.x = e.clientX, mouse.y = e.clientY));
  win.addEventListener("mouseup", () => isDragging = false);

  win.addEventListener("mousemove", e => {
    if (!isDragging) return;
    CONFIG.view.angleY += (e.clientX - mouse.x) * 0.007;
    CONFIG.view.angleX += (e.clientY - mouse.y) * 0.007;
    mouse.x = e.clientX; mouse.y = e.clientY;
  });

  win.addEventListener("wheel", e => {
    if (e.target.id === "canvas") e.preventDefault(), CONFIG.view.zoom = Math.max(0.4, Math.min(2.5, CONFIG.view.zoom + (e.deltaY < 0 ? 0.08 : -0.08)));
  }, { passive: false }); // passive: false -- required for preventDefault() to work on wheel
}

// Called once per animation frame (see main.js -> loop()), not directly from
// the keydown handler, so a held key repeats smoothly at the frame rate
// instead of the OS's slower, inconsistent keyboard-repeat rate. `keys` tracks
// which keys are currently held, updated by the keydown/keyup listeners above.
export function processInputs() {
  let dx = 0, dz = 0, dr = 0, sy = CONFIG.synth;
  if (keys["ArrowUp"]) dz -= 0.28;    if (keys["ArrowDown"]) dz += 0.28;
  if (keys["ArrowLeft"]) dx -= 0.28;  if (keys["ArrowRight"]) dx += 0.28;
  if (keys["+"] || keys["="]) dr += 0.1; if (keys["-"] || keys["_"]) dr -= 0.1;

  if (dx || dz || dr) updateOrbitState(dx, dz, dr), updateAudioSynth();

  // Hotkey table: each pair of keys nudges one parameter down/up
  if (keys["1"]) syncUI("freq", sy.frequency - STEPS.frequency);     if (keys["2"]) syncUI("freq", sy.frequency + STEPS.frequency);
  if (keys["4"]) syncUI("fm-index", sy.fmInt - STEPS.fmInt);   if (keys["5"]) syncUI("fm-index", sy.fmInt + STEPS.fmInt);
  if (keys["7"]) syncUI("fm-ratio", sy.fmRatio - STEPS.fmRatio);if (keys["8"]) syncUI("fm-ratio", sy.fmRatio + STEPS.fmRatio);
  if (keys["3"]) syncUI("y-scale", sy.yScale - STEPS.yScale);   if (keys["6"]) syncUI("y-scale", sy.yScale + STEPS.yScale);
  if (keys["0"]) syncUI("volume", sy.volume - STEPS.volume);   if (keys["9"]) syncUI("volume", sy.volume + STEPS.volume);
  if (keys["o"] || keys["O"]) syncUI("param-a", sy.a - STEPS.a);
  if (keys["p"] || keys["P"]) syncUI("param-a", sy.a + STEPS.a);

  if (keys["q"] || keys["Q"]) { keys["q"] = keys["Q"] = false; stepWave(-1); }
  if (keys["w"] || keys["W"]) { keys["w"] = keys["W"] = false; stepWave(1); }
}
