// Web MIDI input: Note on/off drives the same noteOn()/noteOff() gate as the
// spacebar (see ui/input.js), CC messages drive synth params through the same
// syncUI() path as the on-screen sliders
import { noteOn, noteOff, resumeAudio } from '../audio/engine.js';
import { syncUI } from '../ui/input.js';

let initialized = false;

// Which MIDI notes are currently physically held. Needed for two reasons: (1) if
// notes overlap (e.g. a legato phrase, or a recorded sequence with overlapping
// triggers), releasing the first one shouldn't cut the sound while a second is
// still held -- noteOff() should only fire once nothing is held anymore. (2) it's
// what gets force-cleared on an All Notes/Sound Off message.
const heldNotes = new Set();

// MIDI note number -> Hz (A4 = note 69 = 440Hz, C4 = note 60)
function noteToFrequency(note) {
  return 440 * Math.pow(2, (note - 69) / 12);
}

// Which CC number drives which on-screen slider id. 
// Any id from input.js's UI_MAP works
const CC_MAP = {
  1: 'fm-index',  // mod wheel
  74: 'param-a',  
  7: 'volume'     // channel volume fader
};


function handleMidiMessage(event) {
  const [status, data1, data2] = event.data;
  const command = status & 0xf0;

  if (command === 0x90 && data2 > 0) { // note on
    heldNotes.add(data1);
    resumeAudio();
    syncUI('freq', noteToFrequency(data1));
    noteOn(data2 / 127);
  } else if (command === 0x80 || (command === 0x90 && data2 === 0)) { // note off
    heldNotes.delete(data1);
    if (heldNotes.size === 0) noteOff(); // a still-held second note keeps the sound going
  } else if (command === 0xb0) { // control change
    // CC 120 (All Sound Off) / 123 (All Notes Off) are panic messages
    // sequencers send on stop, mute, or transport reset. Without handling these,
    // a note whose matching note-off got skipped (e.g. deleted from a recorded
    // sequence, or cut off by muting mid-note) sustains forever 
    if (data1 === 120 || data1 === 123) {
      heldNotes.clear();
      noteOff();
      return;
    }
    const uiId = CC_MAP[data1];
    const el = uiId && document.getElementById(uiId);
    if (!el) return;
    const min = parseFloat(el.min), max = parseFloat(el.max);
    syncUI(uiId, min + (data2 / 127) * (max - min));
  }
}

export async function initMidi() {
  if (initialized) return;
  if (!navigator.requestMIDIAccess) {
    console.warn('[midi] Web MIDI API not supported in this browser.');
    return;
  }
  initialized = true;

  let access;
  try {
    access = await navigator.requestMIDIAccess();
  } catch (err) {
    console.warn('[midi] access denied or unavailable:', err.message);
    return;
  }

  const attach = input => {
    input.onmidimessage = handleMidiMessage;
    console.log(`[midi] listening on "${input.name}"`);
  };

  for (const input of access.inputs.values()) attach(input);

  // Controllers plugged in after page load.
  access.onstatechange = e => {
    if (e.port.type === 'input' && e.port.state === 'connected') attach(e.port);
  };
}
