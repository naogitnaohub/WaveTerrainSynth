// Save/Load/Delete controls for core/presets.js. After loading a preset, the
// envelope/LFO/matrix panels are rebuilt so their displayed faders and matrix cells
// reflect the newly-loaded values -- initEnvelopePanelUI()/initLfoPanelUI()/
// initModMatrixUI() already do a full rebuild from current state, so re-calling them
// here is the correct refresh rather than inventing a separate update path.
import { listPresetNames, savePreset, loadPreset, deletePreset, exportToFile, importFromFile } from '../core/presets.js';
import { initEnvelopePanelUI } from './envelope-panel-ui.js';
import { initLfoPanelUI } from './lfo-panel-ui.js';
import { initModMatrixUI } from './mod-matrix-ui.js';

function rebuildModPanels() {
  initEnvelopePanelUI();
  initLfoPanelUI();
  initModMatrixUI();
}

function refreshList(select) {
  const current = select.value;
  select.innerHTML = listPresetNames().map(name => `<option value="${name}">${name}</option>`).join('');
  if ([...select.options].some(o => o.value === current)) select.value = current;
}

export function initPresetsUI() {
  const nameInput = document.getElementById('preset-name');
  const saveBtn = document.getElementById('preset-save-btn');
  const select = document.getElementById('preset-select');
  const loadBtn = document.getElementById('preset-load-btn');
  const deleteBtn = document.getElementById('preset-delete-btn');
  const exportBtn = document.getElementById('preset-export-btn');
  const importBtn = document.getElementById('preset-import-btn');
  const importFile = document.getElementById('preset-import-file');
  if (!nameInput || !saveBtn || !select || !loadBtn || !deleteBtn || !exportBtn || !importBtn || !importFile) return;

  refreshList(select);

  saveBtn.onclick = () => {
    const name = nameInput.value.trim();
    if (!name) return;
    savePreset(name);
    nameInput.value = '';
    refreshList(select);
    select.value = name;
  };

  loadBtn.onclick = () => {
    if (!select.value) return;
    loadPreset(select.value);
    rebuildModPanels();
  };

  deleteBtn.onclick = () => {
    if (!select.value) return;
    deletePreset(select.value);
    refreshList(select);
  };

  exportBtn.onclick = () => exportToFile();

  importBtn.onclick = () => importFile.click();
  importFile.onchange = async () => {
    const file = importFile.files[0];
    importFile.value = ''; // allow re-importing the same filename later
    if (!file) return;
    await importFromFile(file);
    refreshList(select);
  };
}
