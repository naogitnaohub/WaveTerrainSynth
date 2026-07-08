// A "mod(ulation) matrix" is a common synth concept: a grid letting you patch any
// modulation source (an envelope, an LFO, ...) onto any modulation destination (a
// synth parameter), each with its own depth/amount -- see ui/mod-matrix-ui.js for the
// on-screen grid this drives. Here it's just a routing table over native Web Audio
// connections: source --(depth GainNode)--> destination AudioParam. Connecting an
// audio-rate node into an AudioParam makes the browser add that signal to the param's
// value every sample, natively, off the main thread -- so routing costs nothing
// beyond the couple of GainNodes it creates. No custom per-sample JS anywhere in here.
let audioCtx = null;
let bypassed = false;
const sources = new Map();       // id -> anything with .connect(dest)/.disconnect(dest)
const destinations = new Map();  // id -> AudioParam
const routes = new Map();        // "sourceId->destId" -> depth GainNode
const intendedDepths = new Map(); // "sourceId->destId" -> the depth the user actually asked for

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

// Applies the correct gain for one route: 0 while bypassed, its real intended depth
// otherwise. Keeping "what's actually applied" separate from "what the user asked
// for" is what lets bypass be a true mute -- un-bypassing restores exactly what was
// there, and getDepth()/presets keep reporting the real value even while bypassed.
function applyGain(key) {
  const depthGain = routes.get(key);
  if (!depthGain) return;
  depthGain.gain.value = bypassed ? 0 : (intendedDepths.get(key) ?? 0);
}

export function route(sourceId, destId, depth = 1.0) {
  const source = sources.get(sourceId);
  const dest = destinations.get(destId);
  if (!source || !dest || !audioCtx) return;

  unroute(sourceId, destId); // replace any existing routing for this pair

  const key = `${sourceId}->${destId}`;
  const depthGain = audioCtx.createGain();
  source.connect(depthGain);
  depthGain.connect(dest);
  routes.set(key, depthGain);
  intendedDepths.set(key, depth);
  applyGain(key);
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
  intendedDepths.delete(key);
}

export function setDepth(sourceId, destId, depth) {
  const key = `${sourceId}->${destId}`;
  if (!routes.has(key)) return;
  intendedDepths.set(key, depth);
  applyGain(key);
}

export function getDepth(sourceId, destId) {
  return intendedDepths.get(`${sourceId}->${destId}`) ?? 0;
}

// Mute/unmute every route at once without forgetting any of their depths -- the
// on-screen "Mod" toggle next to the matrix calls this.
export function setBypass(value) {
  bypassed = value;
  routes.forEach((_, key) => applyGain(key));
}

export function isBypassed() {
  return bypassed;
}

// All active routes as plain data (source/dest/depth), e.g. for saving a preset --
// see core/presets.js.
export function getAllRoutes() {
  return listRoutes().map(key => {
    const [source, dest] = key.split('->');
    return { source, dest, depth: getDepth(source, dest) };
  });
}

// Unroute everything -- used before applying a loaded preset so routes left over
// from the current session don't linger alongside the loaded ones.
export function clearAllRoutes() {
  listRoutes().forEach(key => {
    const [source, dest] = key.split('->');
    unroute(source, dest);
  });
}
