import { SPAN } from './terrain.js';

// Central source of truth for the synth's orbit path tracker
export const orbitState = {
  cx: 0.0,
  cz: 0.0,
  r: 2.0
};

// Enforces physical borders and scale dimensions constraints
export function clampOrbitState() {
  orbitState.r = Math.max(0.2, Math.min(6.0, orbitState.r));

  const maxBound = SPAN * 0.45;
  orbitState.cx = Math.max(-maxBound, Math.min(maxBound, orbitState.cx));
  orbitState.cz = Math.max(-maxBound, Math.min(maxBound, orbitState.cz));
}
