// ADSR envelope built on ConstantSourceNode, to be routed via the modualtion matrix
export class Envelope {
  constructor(audioCtx, { attack = 0.05, decay = 0.2, sustain = 0.6, release = 0.4 } = {}) {
    this.audioCtx = audioCtx;
    this.attack = attack;
    this.decay = decay;
    this.sustain = sustain;
    this.release = release;

    this.source = audioCtx.createConstantSource();
    this.source.offset.setValueAtTime(0.0, audioCtx.currentTime);
    this.source.start();
  }

  connect(destination) { return this.source.connect(destination); }
  disconnect(...args) { return this.source.disconnect(...args); }

  // Clamp to a small positive minimum (0 breaks linearRampToValueAtTime/setTargetAtTime timing)
  setAttack(seconds) { this.attack = Math.max(0.001, seconds); }
  setDecay(seconds) { this.decay = Math.max(0.001, seconds); }
  setSustain(level) { this.sustain = Math.min(1, Math.max(0, level)); }
  setRelease(seconds) { this.release = Math.max(0.001, seconds); }

  // AudioParam automation -- (not per-sample JS)
  // browser interpolates the curves on the audio thread, to avoid glitch
  // and be independant of what the main thread (UI, rendering) is doing.
  noteOn(velocity = 1.0) {
    const t = this.audioCtx.currentTime;
    const p = this.source.offset;
    p.cancelScheduledValues(t);      // stop following earlier ramp (ex. fsat retrigger)
    p.setValueAtTime(p.value, t);    // set current value as ramp's start point
    p.linearRampToValueAtTime(velocity, t + this.attack); 
    p.setTargetAtTime(this.sustain * velocity, t + this.attack, this.decay);
  }

  noteOff() {
    const t = this.audioCtx.currentTime;
    const p = this.source.offset;
    p.cancelScheduledValues(t);
    p.setValueAtTime(p.value, t);
    p.setTargetAtTime(0.0, t, this.release);
  }
}
