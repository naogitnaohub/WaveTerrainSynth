import { CONFIG } from './config.js';

let audioCtx = null;
let terrainNode = null;
let masterGainNode = null; // High-performance native volume stage node

const workletCode = `
class WaveTerrainProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'frequency', defaultValue: 110, minValue: 20, maxValue: 2000 },
      { name: 'radius', defaultValue: 2.0, minValue: 0.1, maxValue: 8.0 },
      { name: 'cx', defaultValue: 0.0 },
      { name: 'cz', defaultValue: 0.0 },
      { name: 'fmIndex', defaultValue: 0.0, minValue: 0.0, maxValue: 500.0 },
      { name: 'yScale', defaultValue: -1.7, minValue: -10.0, maxValue: 10.0 },
      { name: 'a', defaultValue: 1.5, minValue: 0.1, maxValue: 10.0 }
    ];
  }

  constructor() {
    super();
    this.audioPhase = 0.0; 
    this.modulatorPhase = 0.0;
    
    // Internal state tracking for the active terrain function index
    this.currentWaveNumber = 2;

    // Set up real-time structural control payload listener from the main thread
    this.port.onmessage = (event) => {
      if (event.data.type === 'SET_WAVE') {
        this.currentWaveNumber = event.data.value;
      }
    };
  }

  // Pure mathematical equation engine utilizing variable terrain selectors
  evaluateTerrain(wave, x, z, a) {
    switch (wave) {
      case 1:  
        return Math.sin((z * Math.sin(z) - x * Math.sin(x) * Math.log(z * z + 1)) / a);
      case 2: 
        return (Math.sin(0.8 * x) * Math.cos(0.8 * z) + Math.sin(0.4 * x * z)) * 0.6;
      case 3:  
        return Math.sin(Math.sin(a * x * z) / (x * z || 0.001));
      default: 
        return (Math.sin(0.8 * x) * Math.cos(0.8 * z) + Math.sin(0.4 * x * z)) * 0.6;
  }
}

  process(inputs, outputs, parameters) {
    const output = outputs[0];
    if (!output || output.length === 0) return true;
    
    const leftChannel = output[0]; 
    const rightChannel = output[1];

    const freq = parameters.frequency;
    const radius = parameters.radius;
    const cx = parameters.cx;
    const cz = parameters.cz;
    const fmIdxParam = parameters.fmIndex;
    const yScaleParam = parameters.yScale;
    const aParam = parameters.a;

    const fConstant = freq.length > 1 ? null : freq[0];
    const rConstant = radius.length > 1 ? null : radius[0];
    const xConstant = cx.length > 1 ? null : cx[0];
    const zConstant = cz.length > 1 ? null : cz[0];
    const fmConstant = fmIdxParam.length > 1 ? null : fmIdxParam[0];
    const yConstant = yScaleParam.length > 1 ? null : yScaleParam[0];
    const aConstant = aParam.length > 1 ? null : aParam[0];

    const inverseSampleRate = 1.0 / sampleRate;
    const twoPi = 2.0 * Math.PI;

    for (let i = 0; i < leftChannel.length; i++) {
      const baseF = fConstant !== null ? fConstant : freq[i];
      const r = rConstant !== null ? rConstant : radius[i];
      const posX = xConstant !== null ? xConstant : cx[i];
      const posZ = zConstant !== null ? zConstant : cz[i];
      const fmIndex = fmConstant !== null ? fmConstant : fmIdxParam[i];
      const yScale = yConstant !== null ? yConstant : yScaleParam[i];
      const valA = aConstant !== null ? aConstant : aParam[i];

      let targetF = baseF;

      if (fmIndex > 0.001) {
        const modFreq = baseF * 2.0; 
        this.modulatorPhase += (twoPi * modFreq) * inverseSampleRate;
        if (this.modulatorPhase >= twoPi) this.modulatorPhase -= twoPi;

        targetF += Math.sin(this.modulatorPhase) * fmIndex;
      }

      this.audioPhase += (twoPi * targetF) * inverseSampleRate;
      
      if (this.audioPhase >= twoPi) this.audioPhase -= twoPi;
      else if (this.audioPhase < 0.0) this.audioPhase += twoPi;

      const ox = posX + r * Math.cos(this.audioPhase);
      const oz = posZ + r * Math.sin(this.audioPhase);

      // Extract raw shape height and scale it directly via the user's continuous yScale parameter
      const rawHeight = this.evaluateTerrain(this.currentWaveNumber, ox, oz, valA);
      const sampleValue = rawHeight * yScale * 0.2; 
      
      leftChannel[i] = sampleValue;
      if (rightChannel) rightChannel[i] = sampleValue;
    }

    return true;
  }
}
registerProcessor('wave-terrain-processor', WaveTerrainProcessor);
`;

export async function initAudio() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  
  const blob = new Blob([workletCode], { type: 'application/javascript' });
  const url = URL.createObjectURL(blob);
  await audioCtx.audioWorklet.addModule(url);
  
  terrainNode = new AudioWorkletNode(audioCtx, 'wave-terrain-processor', {
    channelCount: 2,
    outputChannelCount: [2]
  });

  // Central volume control stage allocation
  masterGainNode = audioCtx.createGain();
  masterGainNode.gain.setValueAtTime(CONFIG.synth.volume, audioCtx.currentTime);

  const limiter = audioCtx.createDynamicsCompressor();
  limiter.threshold.setValueAtTime(-1.0, audioCtx.currentTime);
  limiter.knee.setValueAtTime(0.0, audioCtx.currentTime);

  // Routing pipeline layout: Synth Engine ➔ Master Volume Fader ➔ Limiter Guard ➔ Sound Output
  terrainNode.connect(masterGainNode);
  masterGainNode.connect(limiter);
  limiter.connect(audioCtx.destination);
}

// Global update function receiving your centralized configurations object
export function updateAudioSynth() {
  if (!terrainNode || !audioCtx) return;
  const t = audioCtx.currentTime;
  
  // AudioWorklet continuous a-rate parameter tracks
  terrainNode.parameters.get('cx').setValueAtTime(CONFIG.orbit.cx, t);
  terrainNode.parameters.get('cz').setValueAtTime(CONFIG.orbit.cz, t);
  terrainNode.parameters.get('radius').setValueAtTime(CONFIG.orbit.r, t);
  terrainNode.parameters.get('frequency').setValueAtTime(CONFIG.synth.frequency, t);
  terrainNode.parameters.get('fmIndex').setValueAtTime(CONFIG.synth.fmIndex, t);
  terrainNode.parameters.get('yScale').setValueAtTime(CONFIG.synth.yScale, t);
  terrainNode.parameters.get('a').setValueAtTime(CONFIG.synth.a, t);

  // Master hardware output volume automation tracking
  masterGainNode.gain.setValueAtTime(CONFIG.synth.volume, t);
}

// Explicit structural update message for integer function selection jumps
export function updateAudioWaveform(waveNumber) {
  if (!terrainNode) return;
  terrainNode.port.postMessage({ type: 'SET_WAVE', value: waveNumber });
}

export function resumeAudio() {
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}
