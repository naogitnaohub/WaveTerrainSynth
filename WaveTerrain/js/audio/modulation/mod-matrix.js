// Modulation matrix : grid to patch modulation source onto modulation destination 
// (= synth parameters), each with their own depth  (see ui/mod-matrix-ui.js)

// connections: source --(depth GainNode)--> destination AudioParam. 
// connecting an audio-rate node into an AudioParam makes the browser add that signal to the parameter's
// value at every sample, off the main thread.
let audioCtx = null;
let bypassed = false; // to bypass the whole modulation effects

const sources = new Map();       // id -> anything with .connect(dest)/.disconnect(dest)
const destinations = new Map();  // id -> AudioParam
const routes = new Map();        // "sourceId->destId" -> depth GainNode
const intendedDepths = new Map(); // "sourceId->destId" -> the depth entered by user

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

// Applies the correct gain for one route: 0 if bypassed, real depth otherwise.  
// bypass is a true mute: un-bypassing restores exactly what was
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

  unroute(sourceId, destId); // replace any routing for this pair

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

  // Targeted disconnect: if a source has many destination, disconnect only one
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

// Mute/unmute every route at once without loosing the depth informaiton -- the
// on-screen "Bypass" toggle next to the matrix calls this function
export function setBypass(value) {
  bypassed = value;
  routes.forEach((_, key) => applyGain(key));
}

export function isBypassed() {
  return bypassed;
}

// All active routes as plain data (source/dest/depth), for example saving a preset 
// (see core/presets.js)
export function getAllRoutes() {
  return listRoutes().map(key => {
    const [source, dest] = key.split('->');
    return { source, dest, depth: getDepth(source, dest) };
  });
}

// Unroute everything -- used before applying a loaded preset
export function clearAllRoutes() {
  listRoutes().forEach(key => {
    const [source, dest] = key.split('->');
    unroute(source, dest);
  });
}
