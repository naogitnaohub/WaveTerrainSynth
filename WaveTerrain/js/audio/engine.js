// Audio engine: owns the AudioContext and the Web Audio node graph (no UI, no input listeners)
//
// AudioContext is the audio engine: it owns the real-time thread and hardware
// output. Sound comes from creating AudioNodes (oscillators, gains, filters,
// the AudioWorkletNode below) and .connect() them into a graph
// once connected, signal flows node to node, sample by sample
import { CONFIG } from '../core/config.js';
import { Envelope } from './modulation/envelope.js';
import { createLFO } from './modulation/lfo.js';
import { initModMatrix, registerSource, registerDestination } from './modulation/mod-matrix.js';

let audioCtx = null;
let terrainNode = null;
let ampGainNode = null;
let masterEffectsNode = null; // for future master reverb/delay
let masterGainNode = null;
let envelope = null;
const lfos = {}; // id -> LFO instance, e.g. lfos.lfo1

// Builds the whole node graph once. async because loading the AudioWorklet
// module is asynchronous (see addModule() below).
export async function initAudio() {
  if (audioCtx) return; 
  audioCtx = new (window.AudioContext || window.webkitAudioContext)(); // webkit- for old safari

  // AudioWorklet: runs DSP code on a separate real-time audio thread, not the same UI thread that runs this file. 
  // addModule() loads worklet code (terrain-processor.js), where the synthesis is, sample-by-sample
  await audioCtx.audioWorklet.addModule('./js/audio/worklet/terrain-processor.js');

  // Processor is instantiated as a node
  // The variable inputs (frequency, radius, a, ...) are AudioParams,
  // declared in the processor's parameterDescriptors.
  // then updateAudioSynth() pushes CONFIG values into those live AudioParams (terrainNode.parameters)
  terrainNode = new AudioWorkletNode(audioCtx, 'wave-terrain-processor', {
    channelCount: 2,
    outputChannelCount: [2]
  });

  ampGainNode = audioCtx.createGain();
  ampGainNode.gain.value = 0.0;
  envelope = new Envelope(audioCtx, { attack: 0.05, decay: 0.2, sustain: 0.6, release: 0.4 }); // drives ampGainNode.gain
  envelope.connect(ampGainNode.gain);

  masterEffectsNode = audioCtx.createGain();
  masterEffectsNode.gain.value = 1.0;

  masterGainNode = audioCtx.createGain();
  masterGainNode.gain.value = CONFIG.synth.volume;

  // DynamicsCompressor used as a limiter (threshold -1dB, knee 0, plus its default ratio/attack/release), 
  // for digital clipping due to fm synthesis
  const limiter = audioCtx.createDynamicsCompressor();
  limiter.threshold.setValueAtTime(-1.0, audioCtx.currentTime);
  limiter.knee.setValueAtTime(0.0, audioCtx.currentTime);

  // Signal chain: terrain synth -> envelope gate -> (future effects slot)
  // -> master volume -> limiter -> hardare ouptut device (destination)
  terrainNode.connect(ampGainNode);
  ampGainNode.connect(masterEffectsNode);
  masterEffectsNode.connect(masterGainNode);
  masterGainNode.connect(limiter);
  limiter.connect(audioCtx.destination); 

  lfos.lfo1 = createLFO(audioCtx, { rate: 4.0, type: 'sine', depth: 1.0 });
  lfos.lfo2 = createLFO(audioCtx, { rate: 0.5, type: 'triangle', depth: 1.0 });

  // Registers every source (envelope, LFOs) and modulable destination (the
  // worklet's AudioParams + master volume) once here.
  // Routing them together later is one mod-matrix route() call (modulation/mod-matrix.js).
  initModMatrix(audioCtx);
  registerSource('envelope', envelope);
  registerSource('lfo1', lfos.lfo1);
  registerSource('lfo2', lfos.lfo2);

  const p = terrainNode.parameters; 
  registerDestination('frequency', p.get('frequency')); // .get('paramName') returns the audioParam
  registerDestination('radius', p.get('radius'));
  registerDestination('cx', p.get('cx'));
  registerDestination('cz', p.get('cz'));
  registerDestination('fmInt', p.get('fmInt'));
  registerDestination('fmRatio', p.get('fmRatio'));
  registerDestination('yScale', p.get('yScale'));
  registerDestination('a', p.get('a'));
  registerDestination('volume', masterGainNode.gain);
}

// Pushes current CONFIG values onto the worklet's AudioParams. 
// Called after every user input (ui/input.js -> syncUI()).
export function updateAudioSynth() {
  if (!terrainNode || !audioCtx) return;
  const p = terrainNode.parameters;
  const sy = CONFIG.synth;

  p.get('cx').value = CONFIG.orbit.cx; // .value is sufficent (instead of automation method like setValueAtTime), changes don't need sample-accurate timing
  p.get('cz').value = CONFIG.orbit.cz;
  p.get('radius').value = CONFIG.orbit.r;
  p.get('frequency').value = sy.frequency;
  p.get('fmInt').value = sy.fmInt;
  p.get('fmRatio').value = sy.fmRatio || 2.0;
  p.get('yScale').value = sy.yScale;
  p.get('a').value = sy.a;

  masterGainNode.gain.value = sy.volume;
}

// The wave shape (1-15) is a discrete selector, not a continuous value, so it
// isn't an AudioParam -- it's sent as a one-off message through the worklet's
// message port, read by the processor's own onmessage handler
// (terrain-processor.js). (A standard way to send non-audio-rate data from the main
//  thread into an AudioWorkletProcessor.)
export function updateAudioWaveform(waveNumber) {
  if (!terrainNode) return;
  terrainNode.port.postMessage({ type: 'SET_WAVE', value: waveNumber });
}

// Browsers start a new AudioContext in a suspended state until a user intput resumes it
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
