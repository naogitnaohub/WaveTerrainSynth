// A "mod(ulation) matrix" is a common synth concept: a grid letting you patch any
// modulation source (an envelope, an LFO, ...) onto any modulation destination (a
// synth parameter), each with its own depth/amount -- see ui/mod-matrix-ui.js for the
// on-screen grid this drives. Here it's just a routing table over native Web Audio
// connections: source --(depth GainNode)--> destination AudioParam. Connecting an
// audio-rate node into an AudioParam makes the browser add that signal to the param's
// value every sample, natively, off the main thread -- so routing costs nothing
// beyond the couple of GainNodes it creates. No custom per-sample JS anywhere in here.
let audioCtx = null;
const sources = new Map();       // id -> anything with .connect(dest)/.disconnect(dest)
const destinations = new Map();  // id -> AudioParam
const routes = new Map();        // "sourceId->destId" -> depth GainNode

export function initModMatrix(ctx) {
  audioCtx = ctx;
}

export function registerSource(id, node) {
  sources.set(id, node);
}

export function registerDestination(id, audioParam) {
  destinations.set(id, audioParam);
}

export function listSources() { return [...sources.keys()]; }
export function listDestinations() { return [...destinations.keys()]; }
export function listRoutes() { return [...routes.keys()]; }

export function route(sourceId, destId, depth = 1.0) {
  const source = sources.get(sourceId);
  const dest = destinations.get(destId);
  if (!source || !dest || !audioCtx) return;

  unroute(sourceId, destId); // replace any existing routing for this pair

  const depthGain = audioCtx.createGain();
  depthGain.gain.value = depth;
  source.connect(depthGain);
  depthGain.connect(dest);
  routes.set(`${sourceId}->${destId}`, depthGain);
}

export function unroute(sourceId, destId) {
  const key = `${sourceId}->${destId}`;
  const depthGain = routes.get(key);
  if (!depthGain) return;

  // Targeted disconnect: a source (e.g. the envelope) may feed several destinations,
  // so a bare source.disconnect() would tear down all of its other routes too.
  sources.get(sourceId)?.disconnect(depthGain);
  depthGain.disconnect();
  routes.delete(key);
}

export function setDepth(sourceId, destId, depth) {
  const depthGain = routes.get(`${sourceId}->${destId}`);
  if (depthGain) depthGain.gain.value = depth;
}

export function getDepth(sourceId, destId) {
  return routes.get(`${sourceId}->${destId}`)?.gain.value ?? 0;
}
