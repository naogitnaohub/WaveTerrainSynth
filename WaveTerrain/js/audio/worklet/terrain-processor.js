// AudioWorkletProcessor module, loaded via audioWorklet.addModule().
//
// This file runs on a separate, dedicated real-time audio thread (not the same thread
// as the rest of the app): the browser calls process() every ~ 128 samples,
// independently of frame rate, page load, etc..

import { evaluateTerrain } from '../../terrain/terrain-core.js';

class WaveTerrainProcessor extends AudioWorkletProcessor {
  // Declares the synth's tunable inputs as AudioParams. Each one can be set either
  // as a plain value (see engine.js's updateAudioSynth) or automated over time by
  // connecting another node into it (see modultation matrix) -- the browser handles both
  // cases the same way from this processor's point of view (see process() below).
  static get parameterDescriptors() {
    return [
      { name: 'frequency', defaultValue: 110, minValue: 20, maxValue: 2000 },
      { name: 'radius', defaultValue: 2.0, minValue: 0.1, maxValue: 8.0 },
      { name: 'cx', defaultValue: 0.0 },
      { name: 'cz', defaultValue: 0.0 },
      { name: 'fmIndex', defaultValue: 0.0, minValue: 0.0, maxValue: 500.0 },
      { name: 'fmRatio', defaultValue: 2.0, minValue: 0.25, maxValue: 12.0 },
      { name: 'yScale', defaultValue: -1.7, minValue: -10.0, maxValue: 10.0 },
      { name: 'a', defaultValue: 1.5, minValue: 0.1, maxValue: 10.0 }
    ];
  }

  constructor() {
    super();
    this.audioPhase = 0.0;
    this.modulatorPhase = 0.0;
    this.currentWaveNumber = 2;
    this.port.onmessage = (event) => {
      if (event.data.type === 'SET_WAVE') {
        this.currentWaveNumber = event.data.value;
      }
    };
  }

  // Called automatically by the browser roughly every 128 samples to fill the next block of audio. `parameters` gives us, for each
  // AudioParam declared above, an array of values for this block: either length 1
  // (the value is constant for the whole block -- "k-rate"-like behaviour) or length
  // 128 (it's changing sample-by-sample, e.g. because an LFO is connected to it --
  // true a-rate automation). The fConstant/rConstant/etc. checks below just detect
  // which case we're in once per block, instead of re-checking on every sample.
  process(inputs, outputs, parameters) {
    const output = outputs[0];
    if (!output || output.length === 0) return true; // returning true keeps the processor ''alive''

    const leftChannel = output[0];
    const rightChannel = output[1];

    const freq = parameters.frequency;
    const radius = parameters.radius;
    const cx = parameters.cx;
    const cz = parameters.cz;
    const fmIdxParam = parameters.fmIndex;
    const fmRatioParam = parameters.fmRatio;
    const yScaleParam = parameters.yScale;
    const aParam = parameters.a;

    const fConstant = freq.length > 1 ? null : freq[0];
    const rConstant = radius.length > 1 ? null : radius[0];
    const xConstant = cx.length > 1 ? null : cx[0];
    const zConstant = cz.length > 1 ? null : cz[0];
    const fmConstant = fmIdxParam.length > 1 ? null : fmIdxParam[0];
    const ratioConstant = fmRatioParam.length > 1 ? null : fmRatioParam[0];
    const yConstant = yScaleParam.length > 1 ? null : yScaleParam[0];
    const aConstant = aParam.length > 1 ? null : aParam[0];

    const inverseSampleRate = 1.0 / sampleRate; // `sampleRate` is a global provided by the AudioWorklet scope
    const twoPi = 2.0 * Math.PI;

    // One iteration = one audio sample (there are `sampleRate` of these per second,
    // Everything inside must be cheap: no allocations, no function calls
    // that might allocate -- this loop is the actual real-time constraint of the whole app.
    for (let i = 0; i < leftChannel.length; i++) {
      // If a param is a-rate (per-sample array), read this sample's value; otherwise
      // reuse the constant already pulled above.
      const baseF = fConstant !== null ? fConstant : freq[i];
      const r = rConstant !== null ? rConstant : radius[i];
      const posX = xConstant !== null ? xConstant : cx[i];
      const posZ = zConstant !== null ? zConstant : cz[i];
      const fmIndex = fmConstant !== null ? fmConstant : fmIdxParam[i];
      const fmRatio = ratioConstant !== null ? ratioConstant : fmRatioParam[i];
      const yScale = yConstant !== null ? yConstant : yScaleParam[i];
      const valA = aConstant !== null ? aConstant : aParam[i];

      let targetF = baseF;

      // FM synthesis: an oscillator's (modulator) output is added to the carrier's frequency. 
      // - fmRatio sets the modulator's frequency relative to the carrier (ex ratio 2 = 1 octave up)
      // - fmIndex is how far the frequency swings, in Hz. 
      if (fmIndex > 0.001) {
        const modFreq = baseF * fmRatio;
        this.modulatorPhase += (twoPi * modFreq) * inverseSampleRate;
        if (this.modulatorPhase >= twoPi) this.modulatorPhase -= twoPi;
        targetF += Math.sin(this.modulatorPhase) * fmIndex;
      }

      // Phase accumulator: a way of genreating a periodic signal sample-by-sample
      // without having to call  Math.sin(2*pi*f*t) with an ever-growing `t` (which would
      // eventually lose floating-point precision).
      // Tracks the continuous phase within [0, 2π] by adding the phase increment 
      // per sample (2 * π * f / sampleRate) on each iteration
      this.audioPhase += (twoPi * targetF) * inverseSampleRate;
      if (this.audioPhase >= twoPi) this.audioPhase -= twoPi;
      else if (this.audioPhase < 0.0) this.audioPhase += twoPi;

      // This is the wave terrain synthesis step: audioPhase drives a point
      // around a circular orbit of the given `radius`, centered at (posX, posZ) on
      // the terrain. (ox, oz) is that point's current position -- i.e. audioPhase is
      // reused both as the oscillator phase and as the position onto the orbit
      const ox = posX + r * Math.cos(this.audioPhase);
      const oz = posZ + r * Math.sin(this.audioPhase);

      // Read the terrain height at that point, this is the audio saple
    
      const rawHeight = evaluateTerrain(this.currentWaveNumber, ox, oz, valA);
      const sampleValue = rawHeight * yScale * 0.3; // 0.2 to keep below full volume

      leftChannel[i] = sampleValue;
      if (rightChannel) rightChannel[i] = sampleValue; // mono signal duplicated to both channels
    }
    return true;
  }
}

registerProcessor('wave-terrain-processor', WaveTerrainProcessor);
