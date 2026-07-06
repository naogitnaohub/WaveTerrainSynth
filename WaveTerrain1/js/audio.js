import { CONFIG } from './config.js';

let audioCtx = null, terrainNode = null, masterGainNode = null;

// Minified Worklet Core: Loops are optimized to run without constant checking overhead
const workletCode = `
class WaveTerrainProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return ['frequency','radius','cx','cz','fmIndex','fmRatio','yScale','a'].map(n => ({
      name: n, defaultValue: n==='frequency'?110:n==='radius'?2:n==='yScale'?-1.7:n==='a'?1.5:0
    }));
  }
  constructor() {
    super(); this.ap = 0; this.mp = 0; this.wave = 2;
    this.port.onmessage = e => e.data.type === 'SET_WAVE' && (this.wave = e.data.value);
  }
  evalT(w, x, z, a) {
    if (w === 1) return Math.sin((z * Math.sin(z) - x * Math.sin(x) * Math.log(z * z + 1)) / a);
    if (w === 2) return Math.sin(a * (x * x + z * z));
    if (w === 3) return Math.sin(Math.sin(a * x * z) / (x * z || 0.001));
    if (w === 4) return Math.sin(x * a) * Math.cos(z * a) * 0.7 + Math.sin(x * 2.3 * a + 1) * Math.cos(z * 1.9 * a) * 0.3;
    if (w === 5) { const r = Math.sin(x * 0.5) * Math.cos(z * 0.5) * a; return Math.sin(r > 1 ? 2 - r : r < -1 ? -2 - r : r); }
    return (Math.sin(a * z * x) + Math.cos(a * (z * z - x * x))) * 0.5;
  }
  process(ins, outs, pars) {
    const out = outs[0]; if (!out || !out[0]) return true;
    const chL = out[0], chR = out[1], len = chL.length, step = 2 * Math.PI / sampleRate;

    // Fast inline caching: immediately fallback to tracking indices if arrays expand dynamically
    const f = pars.frequency,  fV = f[0],  fArr = f.length > 1;
    const r = pars.radius,     rV = r[0],  rArr = r.length > 1;
    const cx = pars.cx,        cxV = cx[0],cxArr = cx.length > 1;
    const cz = pars.cz,        czV = cz[0],czArr = cz.length > 1;
    const fmi = pars.fmIndex,  fiV = fmi[0],fiArr = fmi.length > 1;
    const fmr = pars.fmRatio,  frV = fmr[0],frArr = fmr.length > 1;
    const ys = pars.yScale,    ysV = ys[0],ysArr = ys.length > 1;
    const a = pars.a,          aV = a[0],  aArr = a.length > 1;

    for (let i = 0; i < len; i++) {
      const baseF = fArr ? f[i] : fV;
      const fmIndex = fiArr ? fmi[i] : fiV;
      let targetF = baseF;

      if (fmIndex > 0.001) {
        this.mp += (baseF * (frArr ? fmr[i] : frV)) * step;
        if (this.mp >= 6.28318530717) this.mp -= 6.28318530717;
        targetF += Math.sin(this.mp) * fmIndex;
      }

      this.ap += targetF * step;
      if (this.ap >= 6.28318530717) this.ap -= 6.28318530717;

      const ox = (cxArr ? cx[i] : cxV) + (rArr ? r[i] : rV) * Math.cos(this.ap);
      const oz = (czArr ? cz[i] : czV) + (rArr ? r[i] : rV) * Math.sin(this.ap);
      const val = this.evalT(this.wave, ox, oz, aArr ? a[i] : aV) * (ysArr ? ys[i] : ysV) * 0.2;

      chL[i] = val; if (chR) chR[i] = val;
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
  await audioCtx.audioWorklet.addModule(URL.createObjectURL(blob));
  
  terrainNode = new AudioWorkletNode(audioCtx, 'wave-terrain-processor', { channelCount: 2, outputChannelCount: [2] });
  masterGainNode = audioCtx.createGain();
  masterGainNode.gain.setValueAtTime(CONFIG.synth.volume, audioCtx.currentTime);

  const lim = audioCtx.createDynamicsCompressor();
  lim.threshold.setValueAtTime(-1.0, audioCtx.currentTime);
  lim.knee.setValueAtTime(0.0, audioCtx.currentTime);

  terrainNode.connect(masterGainNode).connect(lim).connect(audioCtx.destination);
}

export function updateAudioSynth() {
  if (!terrainNode || !audioCtx) return;
  const t = audioCtx.currentTime, p = terrainNode.parameters, sy = CONFIG.synth;
  ['cx','cz'].forEach(k => p.get(k).setValueAtTime(CONFIG.orbit[k], t));
  p.get('radius').setValueAtTime(CONFIG.orbit.r, t);
  ['frequency','fmIndex','yScale','a'].forEach(k => p.get(k).setValueAtTime(sy[k], t));
  p.get('fmRatio').setValueAtTime(sy.fmRatio || 2.0, t);
  masterGainNode.gain.setValueAtTime(sy.volume, t);
}

export function updateAudioWaveform(waveNumber) {
  terrainNode?.port.postMessage({ type: 'SET_WAVE', value: waveNumber });
}

export function resumeAudio() {
  if (audioCtx?.state === 'suspended') audioCtx.resume();
}
