let audioCtx = null;
let terrainNode = null;

// High-performance background thread code executing PURE Wave Terrain Synthesis
const workletCode = `
class WaveTerrainProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'frequency', defaultValue: 110, minValue: 20, maxValue: 2000 },
      { name: 'radius', defaultValue: 2.0, minValue: 0.1, maxValue: 8.0 },
      { name: 'cx', defaultValue: 0.0 },
      { name: 'cz', defaultValue: 0.0 }
    ];
  }

  constructor() {
    super();
    // High-resolution local clock running at full sampleRate speed (44.1kHz)
    this.audioPhase = 0.0; 
  }

  // Exact math copy of your continuous landscape equation
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

    // Web Audio Core Rule: If a parameter is static, its array length is exactly 1.
    // We check if length is greater than 1, otherwise we extract the single baseline value.
    const fConstant = freq.length   > 1 ? null : freq[0];
    const rConstant = radius.length > 1 ? null : radius[0];
    const xConstant = cx.length     > 1 ? null : cx[0];
    const zConstant = cz.length     > 1 ? null : cz[0];

    for (let i = 0; i < leftChannel.length; i++) {
      const currentF = fConstant !== null ? fConstant : freq[i];
      const r        = rConstant !== null ? rConstant : radius[i];
      const posX     = xConstant !== null ? xConstant : cx[i];
      const posZ     = zConstant !== null ? zConstant : cz[i];

      // 1. Advance independent high-resolution phase clock at actual audio rate
      this.audioPhase += (2 * Math.PI * currentF) / sampleRate;
      
      // 2. PERFECT CLOSED LOOP: Wrap cleanly between 0 and 2*PI 
      if (this.audioPhase >= 2 * Math.PI) {
        this.audioPhase -= 2 * Math.PI;
      }

      // 3. PURE GEOMETRIC SCAN PATH: Map coordinates on a uniform circle orbit
      const ox = posX + r * Math.cos(this.audioPhase);
      const oz = posZ + r * Math.sin(this.audioPhase);

      // 4. OUTPUT SIGNAL: Extract terrain height data directly
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
  
  // Set up clean explicit stereo layout limits
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
  
  // Send clean parameter tracking straight to the audio thread
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
