// LFO :  OscillatorNode + depth GainNode, as one object with
// .connect()/.disconnect() to be mapped via the modulation matrix
// 
//  Rate/type/depth are real-time updatable
// (the oscillator runs on the audio thread, so LFo is indepandant of the render loop)

export const LFO_SHAPES = ['sine', 'triangle', 'square'];

export function createLFO(audioCtx, { rate = 2.0, type = 'sine', depth = 1.0 } = {}) {
  const osc = audioCtx.createOscillator();
  osc.type = LFO_SHAPES.includes(type) ? type : 'sine';
  osc.frequency.value = rate;

  // depth is the LFO's output level
  // the modulation matrix's depth scales then into destiantion range
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
