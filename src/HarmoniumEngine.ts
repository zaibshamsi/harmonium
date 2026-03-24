/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum ReedCount {
  ONE = 1,
  TWO = 2,
  THREE = 3
}

export class HarmoniumEngine {
  private audioCtx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private reverbNode: ConvolverNode | null = null;
  private harmoniumBuffer: AudioBuffer | null = null;
  private reverbBuffer: AudioBuffer | null = null;
  
  // Voice pool: one source node per MIDI note slot
  private sourceNodes: (AudioBufferSourceNode | null)[] = new Array(128).fill(null);
  private sourceGains: (GainNode | null)[] = new Array(128).fill(null);
  
  // Settings from user request
  public volume: number = 80; // 0-100
  public currentOctave: number = 3;
  public transpose: number = 0;
  public useReverb: boolean = false;
  public additionalReeds: number = 1;
  public velocityEnabled: boolean = true;
  public selectedMidiDevice: string = "";

  private octaveMap: number[] = [-36, -24, -12, 0, 12, 24, 36];
  private keyMap: number[] = new Array(128).fill(0);
  
  private getPrimaryUrl(): string {
    const envUrl = import.meta.env.VITE_HARMONIUM_WAV_URL;
    console.log(`[AudioEngine] VITE_HARMONIUM_WAV_URL detected: ${envUrl ? 'YES' : 'NO (Using local fallback)'}`);
    return envUrl || "/harmonium-kannan-orig.wav";
  }

  private getReverbUrl(): string {
    const envUrl = import.meta.env.VITE_REVERB_WAV_URL;
    console.log(`[AudioEngine] VITE_REVERB_WAV_URL detected: ${envUrl ? 'YES' : 'NO (Using local fallback)'}`);
    return envUrl || "/reverb.wav";
  }

  private readonly ROOT_KEY = 62; // D4

  constructor() {
    this.buildKeyMap();
  }

  private buildKeyMap() {
    const middleC = 60;
    const rootKey = 62; // D4 — the sample's recorded pitch
    const startKey = middleC - 124 + (rootKey - middleC); // = -62
    for (let i = 0; i < 128; i++) {
      const baseKey = startKey + i;
      this.keyMap[i] = baseKey + this.transpose;
    }
  }

  private async initAudio() {
    if (this.audioCtx && this.audioCtx.state !== 'closed') {
      if (this.audioCtx.state === 'suspended') {
        await this.audioCtx.resume();
      }
      return;
    }

    this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    this.masterGain = this.audioCtx.createGain();
    this.masterGain.gain.value = this.volume / 100;
    this.masterGain.connect(this.audioCtx.destination);

    this.reverbNode = this.audioCtx.createConvolver();
    this.reverbNode.connect(this.audioCtx.destination);

    if (this.useReverb) {
      this.masterGain.connect(this.reverbNode);
    }

    await Promise.all([
      this.loadHarmoniumBuffer(),
      this.loadReverbBuffer()
    ]);
  }

  private async loadHarmoniumBuffer() {
    if (!this.audioCtx || this.harmoniumBuffer) return;
    const url = this.getPrimaryUrl();
    try {
      console.log(`[AudioEngine] Fetching harmonium sample from: ${url}`);
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status} - ${response.statusText}`);
      }
      
      // Use blob() then arrayBuffer() for better binary handling in some environments
      const blob = await response.blob();
      const arrayBuffer = await blob.arrayBuffer();
      console.log(`[AudioEngine] Received ${arrayBuffer.byteLength} bytes for harmonium sample.`);

      const header = new TextDecoder().decode(new Uint8Array(arrayBuffer.slice(0, 4)));
      console.log(`[AudioEngine] File header magic: "${header}"`);

      if (header !== "RIFF") {
        throw new Error(`INVALID_FORMAT: Expected RIFF header, got "${header}"`);
      }

      this.harmoniumBuffer = await this.audioCtx.decodeAudioData(arrayBuffer);
      console.log(`[AudioEngine] Successfully decoded harmonium sample.`);
    } catch (e) {
      console.error(`[AudioEngine] CRITICAL ERROR (${url}):`, e);
      this.harmoniumBuffer = this.createFallbackBuffer();
    }
  }

  private async loadReverbBuffer() {
    if (!this.audioCtx || this.reverbBuffer) return;
    const url = this.getReverbUrl();
    try {
      console.log(`[AudioEngine] Fetching reverb IR from: ${url}`);
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status} - ${response.statusText}`);
      }
      const blob = await response.blob();
      const arrayBuffer = await blob.arrayBuffer();
      console.log(`[AudioEngine] Received ${arrayBuffer.byteLength} bytes for reverb IR.`);
      
      this.reverbBuffer = await this.audioCtx.decodeAudioData(arrayBuffer);
      if (this.reverbNode) {
        this.reverbNode.buffer = this.reverbBuffer;
      }
      console.log(`[AudioEngine] Successfully decoded reverb IR.`);
    } catch (e) {
      console.error(`[AudioEngine] Failed to load reverb IR (${url}):`, e);
    }
  }

  private createFallbackBuffer(): AudioBuffer {
    if (!this.audioCtx) throw new Error("No AudioContext");
    const sampleRate = this.audioCtx.sampleRate;
    const duration = 2; // seconds
    const buffer = this.audioCtx.createBuffer(1, sampleRate * duration, sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = Math.sin((2 * Math.PI * 440 * i) / sampleRate) * 0.1;
    }
    return buffer;
  }

  public async noteOn(midi: number, velocity: number = 100) {
    await this.initAudio();
    if (!this.audioCtx || !this.harmoniumBuffer || !this.masterGain) return;

    const now = this.audioCtx.currentTime;
    
    // Main note
    this.playVoice(midi, midi, now, velocity);

    // Additional reeds (higher octaves)
    for (let r = 1; r <= this.additionalReeds; r++) {
      const reedMidi = midi + (r * 12);
      if (reedMidi < 128) {
        this.playVoice(midi, reedMidi, now, velocity, true);
      }
    }
  }

  private playVoice(triggerMidi: number, targetMidi: number, time: number, velocity: number, isAdditional: boolean = false) {
    if (!this.audioCtx || !this.harmoniumBuffer || !this.masterGain) return;

    const finalMidi = targetMidi + this.octaveMap[this.currentOctave];
    if (finalMidi < 0 || finalMidi >= 128) return;

    // Stop existing node at this slot if any (re-triggering same reed)
    this.stopNode(finalMidi);

    const src = this.audioCtx.createBufferSource();
    src.buffer = this.harmoniumBuffer;
    src.loop = true;
    src.loopStart = 0.5;
    src.loopEnd = 7.5;
    
    // Pitch shifting
    const detuneValue = this.keyMap[finalMidi] * 100;
    src.detune.value = detuneValue;

    const voiceGain = this.audioCtx.createGain();
    const velGain = this.velocityEnabled ? (velocity / 127) : 1.0;
    
    // Use a tiny attack ramp (5ms) to prevent chirps/clicks at note start
    voiceGain.gain.setValueAtTime(0, time);
    voiceGain.gain.linearRampToValueAtTime(velGain, time + 0.005);
    
    src.connect(voiceGain);
    voiceGain.connect(this.masterGain);

    src.start(time);

    this.sourceNodes[finalMidi] = src;
    this.sourceGains[finalMidi] = voiceGain;
  }

  public noteOff(midi: number) {
    const baseIndex = midi + this.octaveMap[this.currentOctave];
    this.stopNode(baseIndex);
    
    for (let r = 1; r <= this.additionalReeds; r++) {
      const reedIndex = baseIndex + (r * 12);
      this.stopNode(reedIndex);
    }
  }

  private stopNode(index: number) {
    if (!this.audioCtx || index < 0 || index >= 128) return;
    const now = this.audioCtx.currentTime;

    const node = this.sourceNodes[index];
    const gain = this.sourceGains[index];

    if (gain && node) {
      try {
        // Use a 5ms micro-fade to prevent digital clicks while remaining "instant"
        gain.gain.cancelScheduledValues(now);
        gain.gain.setValueAtTime(gain.gain.value, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.005);
        node.stop(now + 0.005);
      } catch (e) {
        // Already stopped or not started
      }
    }

    this.sourceNodes[index] = null;
    this.sourceGains[index] = null;
  }

  public stopAll() {
    for (let i = 0; i < 128; i++) {
      this.stopNode(i);
    }
  }

  public setVolume(val: number) {
    this.volume = val;
    if (this.masterGain && this.audioCtx) {
      const now = this.audioCtx.currentTime;
      this.masterGain.gain.linearRampToValueAtTime(val / 100, now + 0.05);
    }
    this.reinitialize();
  }

  public setTranspose(val: number) {
    this.transpose = val;
    this.buildKeyMap();
    this.reinitialize();
  }

  public setOctave(val: number) {
    this.currentOctave = val;
    this.reinitialize();
  }

  public setReverb(val: boolean) {
    this.useReverb = val;
    this.updateReverbMix();
    this.reinitialize();
  }

  public updateReverbMix() {
    if (this.masterGain && this.reverbNode) {
      if (this.useReverb) {
        this.masterGain.connect(this.reverbNode);
      } else {
        try {
          this.masterGain.disconnect(this.reverbNode);
        } catch (e) {
          // Already disconnected
        }
      }
    }
  }

  public setAdditionalReeds(val: number) {
    this.additionalReeds = val;
    this.reinitialize();
  }

  private reinitialize() {
    this.stopAll();
  }

  public getAudioContextState(): AudioContextState {
    return this.audioCtx?.state || 'suspended';
  }

  public dispose() {
    this.stopAll();
    this.audioCtx?.close();
  }
}
