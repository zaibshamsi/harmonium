/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { NoteInfo } from './constants';

export interface HarmoniumState {
  activeMidi: Set<number>;
  volume: number; // 1-100
  useReverb: boolean;
  transpose: number; // -11 to +11
  currentOctave: number; // 0-6
  additionalReeds: number; // 0 to 6 - currentOctave
  velocityEnabled: boolean;
  selectedMidiDevice: string;
  midiDevices: { id: string, name: string }[];
  isAudioStarted: boolean;
  audioContextState: AudioContextState;
  isPlaying: boolean;
}

export class HarmoniumModel {
  private state: HarmoniumState = {
    activeMidi: new Set(),
    volume: 80,
    useReverb: false,
    transpose: 0,
    currentOctave: 3,
    additionalReeds: 1,
    velocityEnabled: true,
    selectedMidiDevice: "",
    midiDevices: [],
    isAudioStarted: false,
    audioContextState: 'suspended',
    isPlaying: false,
  };

  private listeners: ((state: HarmoniumState) => void)[] = [];

  public getState(): HarmoniumState {
    return this.state;
  }

  public updateState(patch: Partial<HarmoniumState>) {
    let hasChanged = false;
    for (const key in patch) {
      const k = key as keyof HarmoniumState;
      if (this.state[k] !== patch[k]) {
        hasChanged = true;
        break;
      }
    }
    
    if (hasChanged) {
      this.state = { ...this.state, ...patch };
      this.notify();
    }
  }

  public subscribe(listener: (state: HarmoniumState) => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notify() {
    this.listeners.forEach(l => l(this.getState()));
  }

  public addNote(midi: number) {
    const next = new Set(this.state.activeMidi);
    next.add(midi);
    this.updateState({ activeMidi: next });
  }

  public removeNote(midi: number) {
    const next = new Set(this.state.activeMidi);
    next.delete(midi);
    this.updateState({ activeMidi: next });
  }
}
