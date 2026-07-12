// Web MIDI input. Note on/off drives the same noteOn()/noteOff() gate as the
// spacebar (see ui/input.js), and by default sets pitch via syncUI('freq', ...)
// CC messages go through midi-map.js -> applyCc()
import { noteOn, noteOff, resumeAudio } from '../audio/engine.js';
import { syncUI } from '../ui/input.js';
import { applyCc, applyNote } from './midi-map.js';

let initialized = false;

// Notes currently physically held. Needed becasue (1) if notes
// overlap (ex a legato phrase, or sequence with overlapping triggers),
// releasing the first don't cut the sound while a second is still held --
// noteOff() only when nothing is held. (2) it's cleared on an All
// Notes/Sound Off message.
const heldNotes = new Set(); // Set: unique values only, add()/delete()/has(), no duplicates

// MIDI note number -> Hz (A4 = note 69 = 440Hz, C4 = note 60)
function noteToFrequency(note) {
  return 440 * Math.pow(2, (note - 69) / 12);
}

// Formats any incoming message for the on-screen "MIDI IN" readout
// (#midi-activity) -- including message types this app doesn't otherwise act
// on (pitch bend, aftertouch, ...) -- confirming something is actually arriving
// from a controller even when it has no other visible effect.
function describeMidiMessage(command, data1, data2) {
  if (command === 0x90 && data2 > 0) return `Note ${data1} on (vel ${data2})`;
  if (command === 0x80 || (command === 0x90 && data2 === 0)) return `Note ${data1} off`;
  if (command === 0xb0) return `CC ${data1} = ${data2}`;
  return `0x${command.toString(16)} ${data1} ${data2}`;
}

let flashTimer = null;
function logMidiActivity(command, data1, data2) {
  const el = document.getElementById('midi-activity');
  if (!el) return;
  el.textContent = describeMidiMessage(command, data1, data2);
  el.classList.add('flash');
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => el.classList.remove('flash'), 150);
}

function handleMidiMessage(event) {
  const [status, data1, data2] = event.data; // MIDI message bytes: [status, data1, data2]
  const command = status & 0xf0; // upper nibble = message type, lower nibble = channel (ignored here)
  logMidiActivity(command, data1, data2);

  if (command === 0x90 && data2 > 0) { // note on 
    if (applyNote(data1, data2)) return; // this note is MIDI-learned onto a control -- never reaches the synth
    heldNotes.add(data1);
    resumeAudio();
    syncUI('freq', noteToFrequency(data1));
    noteOn(data2 / 127); // data2 = velocity, 0-127 -> 0..1
  } else if (command === 0x80 || (command === 0x90 && data2 === 0)) { // note off
    if (applyNote(data1, 0)) return; // same mapped note releasing -- was never added to heldNotes either
    heldNotes.delete(data1);
    if (heldNotes.size === 0) noteOff(); // a still-held second note keeps the sound going
  } else if (command === 0xb0) { // control change
    // CC 120 (All Sound Off) / 123 (All Notes Off): panic messages a sequencer
    // sends on stop, mute, or transport reset.
    if (data1 === 120 || data1 === 123) {
      heldNotes.clear();
      noteOff();
      return;
    }
    applyCc(data1, data2); // MIDI-learn lookup + apply, or arm/bind if in learn mode -- see midi-map.js
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
