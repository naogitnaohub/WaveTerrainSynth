let audioCtx = null;
let terrainNode = null;

const workletCode = `
class WaveTerrainProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'frequency', defaultValue: 110, minValue: 20, maxValue: 2000 },
      { name: 'radius', defaultValue: 2.0, minValue: 0.1, maxValue: 8.0 },
      { name: 'cx', defaultValue: 0.0 },
      { name: 'cz', defaultValue: 0.0 },
      { name: 'fmIndex', defaultValue: 0.0, minValue: 0.0, maxValue: 500.0 }
    ];
  }

  constructor() {
    super();
    this.audioPhase = 0.0; 
    this.modulatorPhase = 0.0; // Separate stable oscillator for the FM engine
  }

  evaluateTerrain(x, z) {
    return (Math.sin(0.8 * x) * Math.cos(0.8 * z) + Math.sin(0.4 * x * z)) * 0.6;
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

    const fConstant = freq.length   > 1 ? null : freq[0];
    const rConstant = radius.length > 1 ? null : radius[0];
    const xConstant = cx.length     > 1 ? null : cx[0];
    const zConstant = cz.length     > 1 ? null : cz[0];
    const fmConstant = fmIdxParam.length > 1 ? null : fmIdxParam[0];

    // Cache static reciprocal processing limit variables
    const inverseSampleRate = 1.0 / sampleRate;
    const twoPi = 2.0 * Math.PI;

    for (let i = 0; i < leftChannel.length; i++) {
      const baseF   = fConstant  !== null ? fConstant  : freq[i];
      const r       = rConstant  !== null ? rConstant  : radius[i];
      const posX    = xConstant  !== null ? xConstant  : cx[i];
      const posZ    = zConstant  !== null ? zConstant  : cz[i];
      const fmIndex = fmConstant !== null ? fmConstant : fmIdxParam[i];

      let targetF = baseF;

      // 1. PERFECT BYPASS: Absolute zero-branch switch prevents artifacts and cuts CPU overhead
      if (fmIndex > 0.001) {
        // Modulator runs at a distinct harmonic ratio (e.g., 2.0x base frequency for clean harmonics)
        const modFreq = baseF * 2.0; 
        this.modulatorPhase += (twoPi * modFreq) * inverseSampleRate;
        if (this.modulatorPhase >= twoPi) this.modulatorPhase -= twoPi;

        // Apply true frequency modulation to the phase step accumulation speed
        targetF += Math.sin(this.modulatorPhase) * fmIndex;
      }

      // 2. Continuous Phase Accumulation (Eliminates coordinate step jumping spikes)
      this.audioPhase += (twoPi * targetF) * inverseSampleRate;
      
      // Wrap efficiently within twoPi bounds
      if (this.audioPhase >= twoPi) this.audioPhase -= twoPi;
      else if (this.audioPhase < 0.0) this.audioPhase += twoPi;

      // 3. Scan uniform loop orbit path
      const ox = posX + r * Math.cos(this.audioPhase);
      const oz = posZ + r * Math.sin(this.audioPhase);

      const sampleValue = this.evaluateTerrain(ox, oz) * 0.4; 
      
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

  const limiter = audioCtx.createDynamicsCompressor();
  limiter.threshold.setValueAtTime(-1.0, audioCtx.currentTime);
  limiter.knee.setValueAtTime(0.0, audioCtx.currentTime);

  terrainNode.connect(limiter);
  limiter.connect(audioCtx.destination);
}

export function updateAudioSynth(orbitState, frequency = 110, fmIndex = 0) {
  if (!terrainNode || !audioCtx) return;
  const t = audioCtx.currentTime;
  
  terrainNode.parameters.get('cx').setValueAtTime(orbitState.cx, t);
  terrainNode.parameters.get('cz').setValueAtTime(orbitState.cz, t);
  terrainNode.parameters.get('radius').setValueAtTime(orbitState.r, t);
  terrainNode.parameters.get('frequency').setValueAtTime(frequency, t);
  terrainNode.parameters.get('fmIndex').setValueAtTime(fmIndex, t);
}

export function resumeAudio() {
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}
