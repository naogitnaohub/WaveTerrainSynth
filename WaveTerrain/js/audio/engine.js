// Audio engine : owns the AudioContext and the node graph (no UI/input listeners)

// Web audio API background: AudioContext is the audio engine,
// it owns the real-time thread and the hardware output. 
// Sound is build by creating AudioNodes (oscilators, giains, filters) and connect()
// them into a graph.
// Audio signal flows node to node once connected, sample by sample.
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

// initAudio() build the whole patch/node graph once
export async function initAudio() {
  if (audioCtx) return; 
  audioCtx = new (window.AudioContext || window.webkitAudioContext)(); // Safari needs the webkit- prefix

  // An AudioWorklet runs DSP code on the dedicated real-time audio thread
  // (separate from the UI thread that runs this file). 
  // addModule() loads that code (worklet7terrain-processor.js), whcih
  // is where sample-by-sample synthesis happens
  await audioCtx.audioWorklet.addModule('./js/audio/worklet/terrain-processor.js');

  // Once the processor is registered, instantiate it as a node like any node.
  // The variable inputs (frequency, radius, a, ...) shows as AudioParams,
  // declared in the processor's parameterDescriptors (see updateAudioSynth() below
  // for how CONFIG values get pushed into them)
  terrainNode = new AudioWorkletNode(audioCtx, 'wave-terrain-processor', {
    channelCount: 2,
    outputChannelCount: [2]
  });

  

  ampGainNode = audioCtx.createGain();
  ampGainNode.gain.value = 0.0;
  envelope = new Envelope(audioCtx, { attack: 0.05, decay: 0.2, sustain: 0.6, release: 0.4 }); // gain = envelope value
  envelope.connect(ampGainNode.gain);

  masterEffectsNode = audioCtx.createGain();
  masterEffectsNode.gain.value = 1.0;

  masterGainNode = audioCtx.createGain();
  masterGainNode.gain.value = CONFIG.synth.volume;

  // DynamicsCompressor:  acts as limiter: threshold at -1dB
  // and knee at 0, to avoid digital clipping using FM/mod depths.
  const limiter = audioCtx.createDynamicsCompressor();
  limiter.threshold.setValueAtTime(-1.0, audioCtx.currentTime);
  limiter.knee.setValueAtTime(0.0, audioCtx.currentTime);

  // SIgnal chain: terrain synth -> envelope
  // gate -> (future effects slot) -> master volume -> limiter -> speakers
  terrainNode.connect(ampGainNode);
  ampGainNode.connect(masterEffectsNode);
  masterEffectsNode.connect(masterGainNode);
  masterGainNode.connect(limiter);
  limiter.connect(audioCtx.destination); // destination = audio harware output

  lfos.lfo1 = createLFO(audioCtx, { rate: 4.0, type: 'sine', depth: 1.0 });
  lfos.lfo2 = createLFO(audioCtx, { rate: 0.5, type: 'triangle', depth: 1.0 });

  // Register every source (envelope, LFOs) and modulatable destination (the
  // worklet's AudioParams + master volume) once, up front, so routing them together
  // later is just a mod-matrix route() call (see modulation/mod-matrix.js)
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
// there is a user input (see ui/input.js : syncUI() )
// Setting  `.value` directly (rather than an automation method setValueAtTime) is ok
// becasue they are user-driven, occasional changes, tha0 tdon't need
// sample-accurate timing like envelope/LFOs do.
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

// The wave shape (1-5) is a discrete value (unlike the AudioParams above)
// so it's not an AudioParam but is sent as a one-off message through the
// worklet's message port, which the processor reads in its own onmessage handler
// (see terrain-processor.js). (it's standard way to send occasional non-audio-rate
//  data from the main thread into an AudioWorkletProcessor.)
export function updateAudioWaveform(waveNumber) {
  if (!terrainNode) return;
  terrainNode.port.postMessage({ type: 'SET_WAVE', value: waveNumber });
}

// Browsers start a new AudioContext in a "suspended" state until there is a user gesture
export function resumeAudio() {
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}


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
