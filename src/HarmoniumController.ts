/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { HarmoniumModel } from './HarmoniumModel';
import { HarmoniumEngine, ReedCount } from './HarmoniumEngine';
import { generateKeyboard, NoteInfo } from './constants';

import { SongData } from './types';

export class HarmoniumController {
  private model: HarmoniumModel;
  private engine: HarmoniumEngine;
  private keyboard: NoteInfo[];
  private rafId: number | null = null;
  private isPlaying = false;

  constructor(model: HarmoniumModel, engine: HarmoniumEngine) {
    this.model = model;
    this.engine = engine;
    this.keyboard = generateKeyboard(48, 37);

    this.setupEventListeners();
    this.setupMIDI();
    this.startAnimationLoop();
    
    // Sync initial engine settings with model
    this.syncEngineWithModel();
  }

  private syncEngineWithModel() {
    const state = this.model.getState();
    this.engine.volume = state.volume;
    this.engine.currentOctave = state.currentOctave;
    this.engine.transpose = state.transpose;
    this.engine.useReverb = state.useReverb;
    this.engine.additionalReeds = state.additionalReeds;
    this.engine.velocityEnabled = state.velocityEnabled;
    this.engine.updateReverbMix();
  }

  private startAnimationLoop() {
    const loop = () => {
      // Sync audio state
      const currentState = this.engine.getAudioContextState();
      if (this.model.getState().audioContextState !== currentState) {
        this.model.updateState({ audioContextState: currentState });
      }
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  private setupEventListeners() {
    window.addEventListener('keydown', (e) => this.handleKeyDown(e));
    window.addEventListener('keyup', (e) => this.handleKeyUp(e));
    window.addEventListener('blur', () => this.stopAll());
  }

  public stopAll() {
    this.engine.stopAll();
    this.model.updateState({ activeMidi: new Set() });
  }

  private setupMIDI() {
    if (navigator.requestMIDIAccess) {
      navigator.requestMIDIAccess().then(access => {
        const updateDevices = () => {
          const devices: { id: string, name: string }[] = [];
          const inputs = access.inputs.values();
          for (let input = inputs.next(); input && !input.done; input = inputs.next()) {
            devices.push({ id: input.value.id, name: input.value.name || 'Unknown Device' });
            
            input.value.onmidimessage = (message: any) => {
              const selected = this.model.getState().selectedMidiDevice;
              if (selected && input.value.id !== selected) return;

              const [status, midi, velocity] = message.data;
              // Note On
              if (status === 144 && velocity > 0) {
                this.noteOn(midi, velocity);
              } 
              // Note Off
              else if (status === 128 || (status === 144 && velocity === 0)) {
                this.noteOff(midi);
              }
            };
          }
          this.model.updateState({ midiDevices: devices });
        };

        access.onstatechange = updateDevices;
        updateDevices();
      });
    }
  }

  private async handleKeyDown(e: KeyboardEvent) {
    if (e.repeat || !e.key) return;
    const note = this.keyboard.find(n => n.key === e.key.toLowerCase());
    if (note) await this.noteOn(note.midi);
  }

  private handleKeyUp(e: KeyboardEvent) {
    if (!e.key) return;
    const note = this.keyboard.find(n => n.key === e.key.toLowerCase());
    if (note) this.noteOff(note.midi);
  }

  public async noteOn(midi: number, velocity: number = 100) {
    await this.engine.noteOn(midi, velocity);
    this.model.addNote(midi);
  }

  public noteOff(midi: number) {
    this.engine.noteOff(midi);
    this.model.removeNote(midi);
  }

  public setVolume(val: number) {
    this.engine.setVolume(val);
    this.model.updateState({ volume: val });
  }

  public setOctave(val: number) {
    this.engine.setOctave(val);
    this.model.updateState({ currentOctave: val });
  }

  public setTranspose(val: number) {
    this.engine.setTranspose(val);
    this.model.updateState({ transpose: val });
  }

  public setReverb(val: boolean) {
    this.engine.setReverb(val);
    this.model.updateState({ useReverb: val });
  }

  public setAdditionalReeds(val: number) {
    this.engine.setAdditionalReeds(val);
    this.model.updateState({ additionalReeds: val });
  }

  public setVelocityEnabled(val: boolean) {
    this.engine.velocityEnabled = val;
    this.model.updateState({ velocityEnabled: val });
  }

  public async playSong(song: SongData) {
    if (this.isPlaying) return;
    this.isPlaying = true;

    const tempoMap = {
      'Slow': 600,
      'Medium': 400,
      'Fast': 250
    };
    const delay = tempoMap[song.tempo as keyof typeof tempoMap] || 500;

    for (const line of song.lines) {
      for (const note of line.notes) {
        if (!note.key) continue;
        const keyInfo = this.keyboard.find(n => n.key === note.key.toLowerCase());
        if (keyInfo) {
          const noteDuration = (note.duration || 1) * delay;
          await this.noteOn(keyInfo.midi);
          await new Promise(resolve => setTimeout(resolve, noteDuration * 0.85));
          this.noteOff(keyInfo.midi);
          await new Promise(resolve => setTimeout(resolve, noteDuration * 0.15));
        }
      }
      // Extra pause between lines
      await new Promise(resolve => setTimeout(resolve, delay * 0.5));
    }

    this.isPlaying = false;
  }

  public dispose() {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.engine.dispose();
  }
}
