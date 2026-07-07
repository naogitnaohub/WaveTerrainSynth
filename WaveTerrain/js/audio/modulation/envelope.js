// A generic ADSR envelope built on a ConstantSourceNode rather than automating a
// GainNode directly. A ConstantSourceNode's output is a normal audio-rate signal, so
// it can be .connect()ed to *any* AudioParam (a gain, but just as well an arbitrary
// worklet param) -- which is what lets the mod matrix (later) route this envelope
// wherever it's needed instead of it being wired to one fixed destination.
//
// ADSR = Attack / Decay / Sustain / Release, the classic four-stage envelope shape:
// on noteOn, ramp up to full level over `attack` seconds (Attack), then fall to the
// `sustain` level over `decay` seconds (Decay), then hold there for as long as the
// note is held (Sustain is a *level*, not a duration -- the other three are
// durations); on noteOff, fall to 0 over `release` seconds (Release).
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

  // Clamp to a small positive minimum: 0 breaks linearRampToValueAtTime/setTargetAtTime timing.
  setAttack(seconds) { this.attack = Math.max(0.001, seconds); }
  setDecay(seconds) { this.decay = Math.max(0.001, seconds); }
  setSustain(level) { this.sustain = Math.min(1, Math.max(0, level)); }
  setRelease(seconds) { this.release = Math.max(0.001, seconds); }

  // All of this is native AudioParam automation -- no per-sample JS, the browser
  // interpolates these curves on the audio thread itself, which is why it stays
  // glitch-free no matter what the main thread (UI, rendering) is doing.
  noteOn(velocity = 1.0) {
    const t = this.audioCtx.currentTime;
    const p = this.source.offset;
    p.cancelScheduledValues(t);      // stop honoring any earlier ramp (e.g. a fast retrigger mid-release)
    p.setValueAtTime(p.value, t);    // pin the current value as the ramp's starting point
    p.linearRampToValueAtTime(velocity, t + this.attack); // Attack: straight line up to peak
    // Decay+Sustain: setTargetAtTime is an *exponential* approach toward its target
    // (never mathematically reaches it, just gets very close) -- `this.decay` here is
    // its time constant, not a hard duration, which is why it sounds like a natural
    // decay rather than a decay-then-abrupt-stop.
    p.setTargetAtTime(this.sustain * velocity, t + this.attack, this.decay);
  }

  noteOff() {
    const t = this.audioCtx.currentTime;
    const p = this.source.offset;
    p.cancelScheduledValues(t);
    p.setValueAtTime(p.value, t);
    p.setTargetAtTime(0.0, t, this.release); // Release: same exponential-approach idea, toward 0 this time
  }
}
