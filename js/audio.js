let audioCtx = null;
let terrainNode = null;

// High-performance background thread code implementing FM Synthesis
const workletCode = `
class WaveTerrainProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'frequency', defaultValue: 110, minValue: 20, maxValue: 2000 },
      { name: 'radius', defaultValue: 2.0, minValue: 0.1, maxValue: 8.0 },
      { name: 'cx', defaultValue: 0.0 },
      { name: 'cz', defaultValue: 0.0 },
      { name: 'fmIndex', defaultValue: 150.0, minValue: 0.0, maxValue: 1000.0 } // Depth of FM modulation
    ];
  }

  constructor() {
    super();
    this.modPhase = 0;
    this.carPhase = 0;
  }

  // Exact math copy of your Case 2 formula running inside the audio thread
  evaluateTerrain(x, z) {
    return (Math.sin(0.8 * x) * Math.cos(0.8 * z) + Math.sin(0.4 * x * z)) * 0.6;
  }

  process(inputs, outputs, parameters) {
    const output = outputs[0];
    if (!output || output.length === 0) return true;
    const channel = output[0]; 
    
    const freq = parameters.frequency;
    const radius = parameters.radius;
    const cx = parameters.cx;
    const cz = parameters.cz;
    const fmIndex = parameters.fmIndex;

    for (let i = 0; i < channel.length; i++) {
      const f = freq.length > 1 ? freq[i] : freq[0];
      const r = radius.length > 1 ? radius[i] : radius[0];
      const posX = cx.length > 1 ? cx[i] : cx[0];
      const posZ = cz.length > 1 ? cz[i] : cz[0];
      const index = fmIndex.length > 1 ? fmIndex[i] : fmIndex[0];

      // 1. Modulator Step: Advance phase around the terrain orbit circle
      this.modPhase += (2 * Math.PI * f) / sampleRate;
      if (this.modPhase > 2 * Math.PI) this.modPhase -= 2 * Math.PI;

      const ox = posX + r * Math.cos(this.modPhase);
      const oz = posZ + r * Math.sin(this.modPhase);

      // Extract terrain height to use as the modulation signal
      const terrainHeight = this.evaluateTerrain(ox, oz);

      // 2. Carrier Step: Modulate the target pitch frequency using the terrain height
      const modulatedFrequency = f + (terrainHeight * index);
      
      this.carPhase += (2 * Math.PI * modulatedFrequency) / sampleRate;
      if (this.carPhase > 2 * Math.PI) this.carPhase -= 2 * Math.PI;

      // Output the final FM synthesized waveform
      channel[i] = Math.sin(this.carPhase) * 0.3; 
    }

    // Mirror mono data across for stereo output
    for (let c = 1; c < output.length; c++) {
      output[c].set(channel);
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

export function updateAudioSynth(orbitState, frequency = 110) {
  if (!terrainNode || !audioCtx) return;

  const t = audioCtx.currentTime;
  
  terrainNode.parameters.get('cx').setValueAtTime(orbitState.cx, t);
  terrainNode.parameters.get('cz').setValueAtTime(orbitState.cz, t);
  terrainNode.parameters.get('radius').setValueAtTime(orbitState.r, t);
  terrainNode.parameters.get('frequency').setValueAtTime(frequency, t);
}

export function resumeAudio() {
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}
