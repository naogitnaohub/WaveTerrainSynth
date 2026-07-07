// Owns the AudioContext and the node graph. No UI/input listeners belong here --
// noteOn/noteOff are the generic gate this module exposes; who calls them (spacebar,
// MIDI, ...) is an input-layer concern, wired up in ui/input.js.
//
// Background if the Web Audio API is new to you: an AudioContext is the audio engine
// itself (it owns the real-time thread and the hardware output). You build sound by
// creating small AudioNodes (oscillators, gains, filters, ...) and .connect()-ing them
// into a graph, exactly like patching cables between modules on a modular synth --
// audio literally flows from node to node once connected, sample by sample, with no
// JavaScript in the loop for native nodes. initAudio() below builds that whole patch
// once; everything after it just tweaks values on the nodes that already exist.
import { CONFIG } from '../core/config.js';
import { Envelope } from './modulation/envelope.js';
import { createLFO } from './modulation/lfo.js';
import { initModMatrix, registerSource, registerDestination } from './modulation/mod-matrix.js';

let audioCtx = null;
let terrainNode = null;
let ampGainNode = null;
let masterEffectsNode = null; // Placeholder stage for future master delay/reverb additions
let masterGainNode = null;
let envelope = null;
const lfos = {}; // id -> LFO, e.g. lfos.lfo1

export async function initAudio() {
  if (audioCtx) return; // already built -- initAudio() can be called again safely (e.g. on a second click)
  audioCtx = new (window.AudioContext || window.webkitAudioContext)(); // Safari still needs the webkit- prefix

  // An AudioWorklet runs custom DSP code on the dedicated real-time audio thread
  // (separate from the UI thread that runs this file). addModule() loads that code --
  // see terrain-processor.js, which is where the actual sample-by-sample synthesis
  // happens. It's a real file (not a Blob string) so it can import the shared terrain
  // math instead of keeping a second hand-synced copy.
  await audioCtx.audioWorklet.addModule('./js/audio/worklet/terrain-processor.js');

  // Now that the processor is registered, we can instantiate it as a node like any
  // other. Its tunable inputs (frequency, radius, a, ...) show up as AudioParams,
  // declared in the processor's parameterDescriptors -- see updateAudioSynth() below
  // for how CONFIG values get pushed into them.
  terrainNode = new AudioWorkletNode(audioCtx, 'wave-terrain-processor', {
    channelCount: 2,
    outputChannelCount: [2]
  });

  // Base gain stays at 0; the envelope's ConstantSource output is connected straight
  // into this AudioParam and adds on top of it, so gain == envelope value. (A
  // ConstantSourceNode is just a node whose output is always some fixed value --
  // here that value is automated over time to trace out the ADSR shape; see
  // envelope.js.)
  ampGainNode = audioCtx.createGain();
  ampGainNode.gain.value = 0.0;
  envelope = new Envelope(audioCtx, { attack: 0.05, decay: 0.2, sustain: 0.6, release: 0.4 });
  envelope.connect(ampGainNode.gain);

  masterEffectsNode = audioCtx.createGain();
  masterEffectsNode.gain.value = 1.0;

  masterGainNode = audioCtx.createGain();
  masterGainNode.gain.value = CONFIG.synth.volume;

  // A DynamicsCompressor here acts as a brick-wall limiter: with threshold at -1dB
  // and knee at 0, anything that would clip just gets squashed instead, which is a
  // cheap safety net against nasty digital clipping while experimenting with FM/mod depths.
  const limiter = audioCtx.createDynamicsCompressor();
  limiter.threshold.setValueAtTime(-1.0, audioCtx.currentTime);
  limiter.knee.setValueAtTime(0.0, audioCtx.currentTime);

  // This is the actual signal chain, written top to bottom: terrain synth -> envelope
  // gate -> (future effects slot) -> master volume -> limiter -> speakers.
  terrainNode.connect(ampGainNode);
  ampGainNode.connect(masterEffectsNode);
  masterEffectsNode.connect(masterGainNode);
  masterGainNode.connect(limiter);
  limiter.connect(audioCtx.destination); // destination = the actual audio hardware output

  lfos.lfo1 = createLFO(audioCtx, { rate: 4.0, type: 'sine', depth: 1.0 });
  lfos.lfo2 = createLFO(audioCtx, { rate: 0.5, type: 'triangle', depth: 1.0 });

  // Register every source (envelope, LFOs) and modulatable destination (the
  // worklet's AudioParams + master volume) once, up front, so routing them together
  // later is just a mod-matrix route() call -- see modulation/mod-matrix.js.
  initModMatrix(audioCtx);
  registerSource('envelope', envelope);
  registerSource('lfo1', lfos.lfo1);
  registerSource('lfo2', lfos.lfo2);
  const p = terrainNode.parameters;
  registerDestination('frequency', p.get('frequency'));
  registerDestination('radius', p.get('radius'));
  registerDestination('cx', p.get('cx'));
  registerDestination('cz', p.get('cz'));
  registerDestination('fmIndex', p.get('fmIndex'));
  registerDestination('fmRatio', p.get('fmRatio'));
  registerDestination('yScale', p.get('yScale'));
  registerDestination('a', p.get('a'));
  registerDestination('volume', masterGainNode.gain);
}

// Pushes the current CONFIG values onto the worklet's AudioParams. Called every time
// a slider/hotkey/MIDI-CC changes something -- see ui/input.js's syncUI(). Setting
// `.value` directly (rather than an automation method like setValueAtTime) is fine
// here: these are user-driven, occasional changes, not something that needs
// sample-accurate timing the way the envelope/LFOs do.
export function updateAudioSynth() {
  if (!terrainNode || !audioCtx) return;
  const p = terrainNode.parameters;
  const sy = CONFIG.synth;

  p.get('cx').value = CONFIG.orbit.cx;
  p.get('cz').value = CONFIG.orbit.cz;
  p.get('radius').value = CONFIG.orbit.r;
  p.get('frequency').value = sy.frequency;
  p.get('fmIndex').value = sy.fmIndex;
  p.get('fmRatio').value = sy.fmRatio || 2.0;
  p.get('yScale').value = sy.yScale;
  p.get('a').value = sy.a;

  masterGainNode.gain.value = sy.volume;
}

// The wave shape (1-5) isn't a continuous value like the AudioParams above, so it
// can't be an AudioParam -- instead we send it as a one-off message through the
// worklet's message port, which the processor reads in its own onmessage handler
// (see terrain-processor.js). This is the standard way to send occasional,
// non-audio-rate data from the main thread into an AudioWorkletProcessor.
export function updateAudioWaveform(waveNumber) {
  if (!terrainNode) return;
  terrainNode.port.postMessage({ type: 'SET_WAVE', value: waveNumber });
}

// Browsers start a new AudioContext in a "suspended" state until a user gesture
// unlocks it (the same autoplay-policy rule mentioned in main.js). Safe to call this
// any time; it's a no-op once the context is already running.
export function resumeAudio() {
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

// The generic "play a note" / "release a note" entry points. Deliberately not called
// triggerAttackDecay()/spacebarDown() or anything input-specific: the spacebar (see
// ui/input.js) and MIDI (see midi/midi.js) both just call these two functions.
export function noteOn(velocity = 1.0) {
  if (!envelope) return;
  envelope.noteOn(velocity);
}

export function noteOff() {
  if (!envelope) return;
  envelope.noteOff();
}

export function getLFO(id) {
  return lfos[id];
}

export function getEnvelope() {
  return envelope;
}
