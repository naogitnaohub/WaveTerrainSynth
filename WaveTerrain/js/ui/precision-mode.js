// Toggles a "fine" mode (key 'x') that tightens every slider's step attribute, so
// keyboard-arrow nudges and drag-snapping land on a finer grid. It does not change
// mouse-drag sensitivity itself -- dragging still spans the full range across the
// same physical track either way; only the snap granularity gets finer.
const FINE_FACTOR = 10;
const EXCLUDED_IDS = new Set(['wave-select']); // discrete param, fractional steps make no sense

let fine = false;
const baseSteps = new Map(); // element -> its normal (coarse) step, captured once at init

function targetSliders() {
  return [...document.querySelectorAll('input.slider')].filter(el => !EXCLUDED_IDS.has(el.id));
}

function applyMode() {
  for (const el of targetSliders()) {
    const base = baseSteps.get(el);
    if (base === undefined) continue;
    el.step = fine ? base / FINE_FACTOR : base;
  }
  document.body.classList.toggle('precision-fine', fine);
}

export function initPrecisionMode() {
  for (const el of targetSliders()) {
    baseSteps.set(el, parseFloat(el.step) || 1);
  }

  window.addEventListener('keydown', e => {
    if (e.key.toLowerCase() !== 'x') return;
    const el = document.activeElement;
    // Don't hijack actual typing, but a focused range slider (the common case right
    // after dragging one) should still let 'x' toggle precision.
    const isTypingTarget = el && (el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || (el.tagName === 'INPUT' && el.type !== 'range'));
    if (isTypingTarget) return;
    fine = !fine;
    applyMode();
  });
}
