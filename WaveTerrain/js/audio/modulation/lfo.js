// LFO: an OscillatorNode and a depth GainNode, wrapped as one object with
// .connect()/.disconnect() to be  routed via the modulation matrix.
// Rate/type/depth are updatable in real time.
// the oscillator runs on the audio thread, independent of the render loop.

export const LFO_SHAPES = ['sine', 'triangle', 'square'];

export function createLFO(audioCtx, { rate = 2.0, type = 'sine', depth = 1.0 } = {}) {
  const osc = audioCtx.createOscillator();
  osc.type = LFO_SHAPES.includes(type) ? type : 'sine';
  osc.frequency.value = rate;

  // depth is the LFO's output level.
  // the mod matrix's per-route depth scales it after
  const depthGain = audioCtx.createGain();
  depthGain.gain.value = depth;
  osc.connect(depthGain);
  osc.start();

  // Returns a plain object, not the raw nodes -- callers only see connect/
  // disconnect/setters; the getters below read straight from the live audio nodes.
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
