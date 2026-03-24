/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface NoteInfo {
  midi: number;
  name: string;
  sargam: string;
  isBlack: boolean;
  key?: string;
}

export const WHITE_KEYS_MAPPING = ["a", "s", "d", "f", "g", "h", "j", "k", "l", ";", "'"];
export const BLACK_KEYS_MAPPING = ["w", "e", "t", "y", "u", "o", "p"];

export const SARGAM_NAMES = ["Sa", "re", "Re", "ga", "Ga", "Ma", "ma", "Pa", "dha", "Dha", "ni", "Ni"];

export const getNoteInfo = (midi: number): NoteInfo => {
  const notes = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const sargams = ["Sa", "re", "Re", "ga", "Ga", "Ma", "ma", "Pa", "dha", "Dha", "ni", "Ni"];
  const name = notes[midi % 12];
  const sargam = sargams[midi % 12];
  const isBlack = name.includes("#");
  return { midi, name, sargam, isBlack };
};

export const generateKeyboard = (startMidi: number, count: number): NoteInfo[] => {
  const keyboard: NoteInfo[] = [];
  let whiteIdx = 0;
  let blackIdx = 0;

  for (let i = 0; i < count; i++) {
    const midi = startMidi + i;
    const info = getNoteInfo(midi);
    
    // Assign key bindings
    if (info.isBlack) {
      if (blackIdx < BLACK_KEYS_MAPPING.length) {
        info.key = BLACK_KEYS_MAPPING[blackIdx++];
      }
    } else {
      if (whiteIdx < WHITE_KEYS_MAPPING.length) {
        info.key = WHITE_KEYS_MAPPING[whiteIdx++];
      }
    }
    
    keyboard.push(info);
  }
  return keyboard;
};
