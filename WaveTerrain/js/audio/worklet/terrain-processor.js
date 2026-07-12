// AudioWorkletProcessor module, loaded via audioCtx.audioWorklet.addModule() (engine.js)
// Runs on its own dedicated real-time audio thread (not the main/UI thread) --
// the browser calls process() every ~128 samples, independent of frame
// rate or anything else happening on the webpage.

import { evaluateTerrain } from '../../terrain/terrain-core.js';

class WaveTerrainProcessor extends AudioWorkletProcessor {
  // Declares the synth's variable inputs as AudioParams. Each can be set either
  // as a plain value (engine.js -> updateAudioSynth) or automated over time by
  // connecting another node into it (the modulation matrix) -- this processor
  // handles both cases the same way (see process() below).

  // min/maxValue here are wider than the pot's own LIMITS in core/config.js --
  // they're the last-resort clamp for the *sum* of the base value plus whatever
  // the mod matrix adds on top, so modulation isn't hard-clipped right at the
  // knob's own edge.
  static get parameterDescriptors() {
    return [
      { name: 'frequency', defaultValue: 110, minValue: 20, maxValue: 2000 },
      { name: 'radius', defaultValue: 2.0, minValue: 0.1, maxValue: 8.0 },
      { name: 'cx', defaultValue: 0.0 },
      { name: 'cz', defaultValue: 0.0 },
      { name: 'fmInt', defaultValue: 0.0, minValue: 0.0, maxValue: 500.0 },
      { name: 'fmRatio', defaultValue: 2.0, minValue: -1.0, maxValue: 6.0 },
      { name: 'yScale', defaultValue: -1.7, minValue: -10.0, maxValue: 10.0 },
      { name: 'a', defaultValue: 1.5, minValue: -4.0, maxValue: 4.0 }
    ];
  }

  constructor() {
    super();
    this.audioPhase = 0.0;      // current phase of the audio-rate oscillator (the orbit)
    this.modulatorPhase = 0.0;  // current phase of the FM modulator oscillator
    this.currentWaveNumber = 2;
    this.port.onmessage = (event) => { // message port: main-thread <-> worklet-thread channel
      if (event.data.type === 'SET_WAVE') {
        this.currentWaveNumber = event.data.value;
      }
    };
  }

  // Called automatically by the browser about every 128 samples, to fill the
  // next block of audio. 
  // `parameters` gives, for each AudioParam declared
  // above, an array of values for this block: length 1 if constant for the
  // whole block ("k-rate"-like), or length 128 if it changes every sample
  // (true a-rate automation, e.g. an LFO connected to it). The *Constant checks
  // below detect which case applies, once per block, instead of re-checking every sample.
  process(inputs, outputs, parameters) {
    const output = outputs[0];
    if (!output || output.length === 0) return true; // true = keep this processor alive

    const leftChannel = output[0];
    const rightChannel = output[1];

    const freq = parameters.frequency;
    const radius = parameters.radius;
    const cx = parameters.cx;
    const cz = parameters.cz;
    const fmIdxParam = parameters.fmInt;
    const fmRatioParam = parameters.fmRatio;
    const yScaleParam = parameters.yScale;
    const aParam = parameters.a;

    // length > 1 => a-rate (per-sample) values; else pull the single constant now
    const fConstant = freq.length > 1 ? null : freq[0];
    const rConstant = radius.length > 1 ? null : radius[0];
    const xConstant = cx.length > 1 ? null : cx[0];
    const zConstant = cz.length > 1 ? null : cz[0];
    const fmConstant = fmIdxParam.length > 1 ? null : fmIdxParam[0];
    const ratioConstant = fmRatioParam.length > 1 ? null : fmRatioParam[0];
    const yConstant = yScaleParam.length > 1 ? null : yScaleParam[0];
    const aConstant = aParam.length > 1 ? null : aParam[0];

    const inverseSampleRate = 1.0 / sampleRate; // `sampleRate`: global provided by the AudioWorklet scope
    const twoPi = 2.0 * Math.PI;

    // One iteration = one audio sample (sampleRate of these per second).
    // Nothing in this loop may allocate or call anything that might allocate
    for (let i = 0; i < leftChannel.length; i++) {
      // a-rate param: read this sample's value; k-rate: reuse the constant above
      const baseF = fConstant !== null ? fConstant : freq[i];
      const r = rConstant !== null ? rConstant : radius[i];
      const posX = xConstant !== null ? xConstant : cx[i];
      const posZ = zConstant !== null ? zConstant : cz[i];
      const fmInt = fmConstant !== null ? fmConstant : fmIdxParam[i];
      const fmRatio = ratioConstant !== null ? ratioConstant : fmRatioParam[i];
      const yScale = yConstant !== null ? yConstant : yScaleParam[i];
      const valA = aConstant !== null ? aConstant : aParam[i];

      let targetF = baseF;

      // FM synthesis: a modulator oscillator's output is added to the carrier's
      // frequency. fmRatio sets the modulator's frequency relative to the
      // carrier (ex ratio 2 = +1 otcave); fmInt is how far the
      // frequency swings, in Hz.
      if (fmInt > 0.001) {
        const modFreq = baseF * fmRatio;
        this.modulatorPhase += (twoPi * modFreq) * inverseSampleRate;
        // fmRatio can go negative (see core/config.js's LIMITS.fmRatio), which
        // makes modFreq negative and walks modulatorPhase downward instead of
        // up -- the second branch wraps it back above 0, same as audioPhase
        // does below.
        if (this.modulatorPhase >= twoPi) this.modulatorPhase -= twoPi;
        else if (this.modulatorPhase < 0.0) this.modulatorPhase += twoPi;
        targetF += Math.sin(this.modulatorPhase) * fmInt;
      }

      // Phase accumulator: generates a periodic signal sample-by-sample without
      // calling Math.sin(2*pi*f*t) with an ever-growing `t` (which would
      // eventually lose floating-point precision). Tracks phase within [0,
      // 2*pi], adding the per-sample increment (2*pi*f / sampleRate) each
      // iteration, wrapping at the bounds.
      this.audioPhase += (twoPi * targetF) * inverseSampleRate;
      if (this.audioPhase >= twoPi) this.audioPhase -= twoPi;
      else if (this.audioPhase < 0.0) this.audioPhase += twoPi;

      // Wave terrain synthesis step: audioPhase drives a point around a
      // circular orbit of the given `radius`, centered at (posX, posZ) on the
      // terrain. (ox, oz) is that point's current position -- audioPhase
      // doubles as both the oscillator phase and the position on the orbit.
      const ox = posX + r * Math.cos(this.audioPhase);
      const oz = posZ + r * Math.sin(this.audioPhase);

      // Terrain height at that point is the audio sample.
      const rawHeight = evaluateTerrain(this.currentWaveNumber, ox, oz, valA);
      const sampleValue = rawHeight * yScale * 0.3;

      leftChannel[i] = sampleValue;
      if (rightChannel) rightChannel[i] = sampleValue; // mono signal duplicated to both channels
    }
    return true;
  }
}

registerProcessor('wave-terrain-processor', WaveTerrainProcessor);
