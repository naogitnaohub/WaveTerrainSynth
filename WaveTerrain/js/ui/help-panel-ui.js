// Toggles the on-screen help overlay (H key) that explains the controls and
// signal flow for newcomers -- see index.html's #help-overlay for the content.
let overlay;

function toggleHelp() {
  overlay.classList.toggle('open');
}

function closeHelp() {
  overlay.classList.remove('open');
}

export function initHelpPanel() {
  overlay = document.getElementById('help-overlay');
  document.getElementById('help-close-btn').addEventListener('click', closeHelp);
  overlay.addEventListener('click', e => { if (e.target === overlay) closeHelp(); });

  window.addEventListener('keydown', e => {
    if (e.key === 'h' || e.key === 'H') { e.preventDefault(); toggleHelp(); }
    else if (e.key === 'Escape') closeHelp();
  });
}
