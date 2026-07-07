// A native OscillatorNode + a depth GainNode, exposed as one object with a plain
// .connect()/.disconnect() pair so it slots into the mod matrix as a source exactly
// like the envelope does. Rate/type/depth are live-updatable; the oscillator itself
// runs on the audio thread, so changing an LFO never touches the render loop.
//
// An LFO (Low Frequency Oscillator) is, technically, nothing special in the Web
// Audio API: it's the exact same OscillatorNode you'd use to make an audible tone --
// the only difference is we run it at a few Hz instead of a few hundred, and connect
// its output to another node's *parameter* instead of straight to the speakers, so
// its up/down swing modulates that parameter over time instead of being heard directly.
export const LFO_SHAPES = ['sine', 'triangle', 'square'];

export function createLFO(audioCtx, { rate = 2.0, type = 'sine', depth = 1.0 } = {}) {
  const osc = audioCtx.createOscillator();
  osc.type = LFO_SHAPES.includes(type) ? type : 'sine';
  osc.frequency.value = rate;

  // depth is the LFO's own output level (0..1 of its +-1 swing); the mod matrix's
  // per-route depth then further scales that into whatever range a destination needs.
  const depthGain = audioCtx.createGain();
  depthGain.gain.value = depth;
  osc.connect(depthGain);
  osc.start();

  return {
    connect: (dest) => depthGain.connect(dest),
    disconnect: (dest) => depthGain.disconnect(dest),
    setRate(hz) { osc.frequency.value = hz; },
    setType(shape) { if (LFO_SHAPES.includes(shape)) osc.type = shape; },
    setDepth(amount) { depthGain.gain.value = amount; },
    get rate() { return osc.frequency.value; },
    get type() { return osc.type; },
    get depth() { return depthGain.gain.value; }
  };
}
