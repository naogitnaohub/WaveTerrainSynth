// Modulation matrix: routes a modulation source onto a modulation destination
// (a synth parameter), each route with its own depth. UI: ui/mod-matrix-ui.js.
//
// A route is: source --(depth GainNode)--> destination AudioParam. Connecting
// an audio-rate node into an AudioParam makes the browser add that signal to
// the param's value every sample, off the main thread
let audioCtx = null;
let bypassed = false; // true = mute every route's applied gain, without forgetting depths

const sources = new Map();       // id -> anything with .connect(dest)/.disconnect(dest)
const destinations = new Map();  // id -> AudioParam
const routes = new Map();        // "sourceId->destId" -> depth GainNode
const intendedDepths = new Map(); // "sourceId->destId" -> the depth the user actually set

export function initModMatrix(ctx) {
  audioCtx = ctx;
}

export function registerSource(id, node) {
  sources.set(id, node);
}

export function registerDestination(id, audioParam) {
  destinations.set(id, audioParam);
}

export function listSources() { return [...sources.keys()]; } // spreads a Map's keys() iterator into a plain array
export function listDestinations() { return [...destinations.keys()]; }
export function listRoutes() { return [...routes.keys()]; }

// Applies the correct gain for one route: 0 if bypassed, the real depth
// otherwise. intendedDepths stays the source of truth -- un-bypassing restores
// exactly what was there, and getDepth()/presets always read the real value
// even while bypassed.
function applyGain(key) {
  const depthGain = routes.get(key);
  if (!depthGain) return;
  depthGain.gain.value = bypassed ? 0 : (intendedDepths.get(key) ?? 0); // ??: nullish coalescing, falls back only on null/undefined
}

export function route(sourceId, destId, depth = 1.0) {
  const source = sources.get(sourceId);
  const dest = destinations.get(destId);
  if (!source || !dest || !audioCtx) return;

  unroute(sourceId, destId); // replace any existing routing for this pair

  const key = `${sourceId}->${destId}`; // template literal: builds the string with both ids inlined
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

  // Targeted disconnect: if a source feeds several destinations, remove only this one
  sources.get(sourceId)?.disconnect(depthGain); // ?.: optional chaining, skips the call if the source is missing
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

// Mutes/unmutes every route at once without losing depth data -- called by the
// on-screen Bypass toggle next to the matrix.
export function setBypass(value) {
  bypassed = value;
  routes.forEach((_, key) => applyGain(key)); // _ : placeholder name for the unused value param
}

export function isBypassed() {
  return bypassed;
}

// All active routes as plain data (source/dest/depth) -- used when saving a
// preset (core/presets.js).
export function getAllRoutes() {
  return listRoutes().map(key => {
    const [source, dest] = key.split('->'); // array destructuring from the split() result
    return { source, dest, depth: getDepth(source, dest) };
  });
}

// Unroutes everything -- used before applying a loaded preset.
export function clearAllRoutes() {
  listRoutes().forEach(key => {
    const [source, dest] = key.split('->');
    unroute(source, dest);
  });
}
