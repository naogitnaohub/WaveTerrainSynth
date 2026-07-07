// Real AudioWorkletProcessor module, loaded via audioWorklet.addModule() instead of the
// old Blob-string trick. Being a real file lets it import the shared terrain math below
// instead of keeping a second hand-synced copy of the wave shapes.
//
// This file runs on a separate, dedicated real-time audio thread (not the same thread
// as the rest of the app), which is *why* it's a separate file/class instead of a
// normal function: the browser calls process() below roughly every 128 samples,
// completely independently of frame rate, page load, or anything else happening on
// screen. Nothing in here may block (no network calls, no console.log in hot code, no
// unbounded loops) -- if this thread stalls, the audio glitches, full stop.
import { evaluateTerrain } from '../../terrain/terrain-core.js';

class WaveTerrainProcessor extends AudioWorkletProcessor {
  // Declares the synth's tunable inputs as AudioParams. Each one can be set either
  // as a plain value (see engine.js's updateAudioSynth) or automated over time by
  // connecting another node into it (see the mod matrix) -- the browser handles both
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

  // Called automatically by the browser roughly every 128 samples (one "render
  // quantum") to fill the next block of audio. `parameters` gives us, for each
  // AudioParam declared above, an array of values for this block: either length 1
  // (the value is constant for the whole block -- "k-rate"-like behaviour) or length
  // 128 (it's changing sample-by-sample, e.g. because an LFO is connected to it --
  // true a-rate automation). The fConstant/rConstant/etc. checks below just detect
  // which case we're in once per block, instead of re-checking on every sample.
  process(inputs, outputs, parameters) {
    const output = outputs[0];
    if (!output || output.length === 0) return true; // returning true keeps the processor alive

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
    // e.g. 44100). Everything inside must be cheap: no allocations, no function calls
    // that might allocate -- this loop is the actual real-time constraint of the whole app.
    for (let i = 0; i < leftChannel.length; i++) {
      // If a param is a-rate (per-sample array), read this sample's value; otherwise
      // reuse the constant we already pulled out above.
      const baseF = fConstant !== null ? fConstant : freq[i];
      const r = rConstant !== null ? rConstant : radius[i];
      const posX = xConstant !== null ? xConstant : cx[i];
      const posZ = zConstant !== null ? zConstant : cz[i];
      const fmIndex = fmConstant !== null ? fmConstant : fmIdxParam[i];
      const fmRatio = ratioConstant !== null ? ratioConstant : fmRatioParam[i];
      const yScale = yConstant !== null ? yConstant : yScaleParam[i];
      const valA = aConstant !== null ? aConstant : aParam[i];

      let targetF = baseF;

      // Classic FM synthesis: a second ("modulator") oscillator's output is added
      // directly to the carrier's frequency instead of to its amplitude. fmRatio sets
      // the modulator's frequency relative to the carrier (e.g. ratio 2 = one octave
      // up); fmIndex is how far the frequency swings, in Hz. this.modulatorPhase is
      // that oscillator's own running phase, updated the same way as the main phase below.
      if (fmIndex > 0.001) {
        const modFreq = baseF * fmRatio;
        this.modulatorPhase += (twoPi * modFreq) * inverseSampleRate;
        if (this.modulatorPhase >= twoPi) this.modulatorPhase -= twoPi;
        targetF += Math.sin(this.modulatorPhase) * fmIndex;
      }

      // Phase accumulator: this is how you generate a periodic signal sample-by-sample
      // without calling Math.sin(2*pi*f*t) with an ever-growing `t` (which would
      // eventually lose floating-point precision). Instead we track the current phase
      // (0..2*pi) and add "how far the phase moves in one sample" (2*pi*f / sampleRate)
      // on every iteration, wrapping back into range when it overflows.
      this.audioPhase += (twoPi * targetF) * inverseSampleRate;
      if (this.audioPhase >= twoPi) this.audioPhase -= twoPi;
      else if (this.audioPhase < 0.0) this.audioPhase += twoPi;

      // This is the wave terrain synthesis step itself: audioPhase drives a point
      // around a circular orbit of the given `radius`, centered at (posX, posZ) on
      // the terrain. (ox, oz) is that point's current position -- i.e. audioPhase is
      // reused both as "the oscillator phase" and as "where we currently are on the
      // orbit", which is what makes walking the orbit happen at the desired pitch.
      const ox = posX + r * Math.cos(this.audioPhase);
      const oz = posZ + r * Math.sin(this.audioPhase);

      // Read the terrain height at that point -- this (not a sine table, not a
      // wavetable) is the actual audio sample. yScale rescales it, and the constant
      // 0.2 just keeps typical output comfortably below full volume before the
      // limiter in engine.js does its job.
      const rawHeight = evaluateTerrain(this.currentWaveNumber, ox, oz, valA);
      const sampleValue = rawHeight * yScale * 0.2;

      leftChannel[i] = sampleValue;
      if (rightChannel) rightChannel[i] = sampleValue; // mono signal duplicated to both channels
    }
    return true;
  }
}

registerProcessor('wave-terrain-processor', WaveTerrainProcessor);
