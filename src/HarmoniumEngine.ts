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
  
  private harmoniumArrayBuffer: ArrayBuffer | null = null;
  private reverbArrayBuffer: ArrayBuffer | null = null;
  private isPreloading: boolean = false;
  private preloadPromise: Promise<void> | null = null;
  
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
    return "https://rdxjrsp5eejqdkga.public.blob.vercel-storage.com/harmonium-kannan-orig.wav";
  }

  private getReverbUrl(): string {
    return "https://rdxjrsp5eejqdkga.public.blob.vercel-storage.com/reverb.wav";
  }

  private readonly ROOT_KEY = 62; // D4

  constructor() {
    this.buildKeyMap();
  }

  public preload(): Promise<void> {
    if (this.preloadPromise) return this.preloadPromise;
    this.isPreloading = true;
    this.preloadPromise = (async () => {
      try {
        const [hRes, rRes] = await Promise.all([
          fetch(this.getPrimaryUrl()),
          fetch(this.getReverbUrl())
        ]);
        
        const [hBlob, rBlob] = await Promise.all([
          hRes.blob(),
          rRes.blob()
        ]);
        
        [this.harmoniumArrayBuffer, this.reverbArrayBuffer] = await Promise.all([
          hBlob.arrayBuffer(),
          rBlob.arrayBuffer()
        ]);
        
        console.log('[AudioEngine] Preload complete.');
      } catch (e) {
        console.error('[AudioEngine] Preload failed:', e);
      } finally {
        this.isPreloading = false;
      }
    })();
    return this.preloadPromise;
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

    if (this.preloadPromise) await this.preloadPromise;

    await Promise.all([
      this.loadHarmoniumBuffer(),
      this.loadReverbBuffer()
    ]);
  }

  private async loadHarmoniumBuffer() {
    if (!this.audioCtx || this.harmoniumBuffer) return;
    
    try {
      let arrayBuffer = this.harmoniumArrayBuffer;
      if (!arrayBuffer) {
        const url = this.getPrimaryUrl();
        console.log(`[AudioEngine] Fetching harmonium sample from: ${url}`);
        const response = await fetch(url);
        const blob = await response.blob();
        arrayBuffer = await blob.arrayBuffer();
      }
      
      this.harmoniumBuffer = await this.audioCtx.decodeAudioData(arrayBuffer.slice(0)); // Slice to avoid detached buffer issues
      console.log(`[AudioEngine] Successfully decoded harmonium sample.`);
    } catch (e) {
      console.error(`[AudioEngine] CRITICAL ERROR:`, e);
      this.harmoniumBuffer = this.createFallbackBuffer();
    }
  }

  private async loadReverbBuffer() {
    if (!this.audioCtx || this.reverbBuffer) return;
    
    try {
      let arrayBuffer = this.reverbArrayBuffer;
      if (!arrayBuffer) {
        const url = this.getReverbUrl();
        console.log(`[AudioEngine] Fetching reverb IR from: ${url}`);
        const response = await fetch(url);
        const blob = await response.blob();
        arrayBuffer = await blob.arrayBuffer();
      }
      
      this.reverbBuffer = await this.audioCtx.decodeAudioData(arrayBuffer.slice(0));
      if (this.reverbNode) {
        this.reverbNode.buffer = this.reverbBuffer;
      }
      console.log(`[AudioEngine] Successfully decoded reverb IR.`);
    } catch (e) {
      console.error(`[AudioEngine] Failed to load reverb IR:`, e);
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

  public async noteOn(midi: number, velocity: number = 100, expression?: any, startTime?: number) {
    await this.initAudio();
    if (!this.audioCtx || !this.harmoniumBuffer || !this.masterGain) return;

    const time = startTime ?? this.audioCtx.currentTime;
    
    // Main note
    this.playVoice(midi, midi, time, velocity, false, expression);

    // Additional reeds
    for (let r = 1; r <= this.additionalReeds; r++) {
      const reedMidi = midi + (r * 12);
      if (reedMidi < 128) {
        this.playVoice(midi, reedMidi, time, velocity, true, expression);
      }
    }
  }

  private playVoice(triggerMidi: number, targetMidi: number, time: number, velocity: number, isAdditional: boolean = false, expression?: any) {
    if (!this.audioCtx || !this.harmoniumBuffer || !this.masterGain) return;

    const finalMidi = targetMidi + this.octaveMap[this.currentOctave];
    if (finalMidi < 0 || finalMidi >= 128) return;

    // Stop existing node at this slot if any
    this.stopNode(finalMidi, 0.005, time);

    const src = this.audioCtx.createBufferSource();
    src.buffer = this.harmoniumBuffer;
    src.loop = true;
    src.loopStart = 0.5;
    src.loopEnd = 7.5;
    
    // Pitch shifting
    const baseDetune = this.keyMap[finalMidi] * 100;
    src.detune.setValueAtTime(baseDetune, time);

    // Pitch Curve Automation (Meend)
    if (expression?.pitchCurve && expression.pitchCurve.length > 0) {
      const duration = expression.duration || 1.0;
      // Ensure we start at the base pitch
      src.detune.setValueAtTime(baseDetune, time);
      
      expression.pitchCurve.forEach((point: any) => {
        const pointTime = time + (point.t * duration);
        const pointDetune = baseDetune + (point.v * 100);
        // Use exponentialRamp for more natural pitch movement if possible, 
        // but linear is safer for small offsets
        src.detune.linearRampToValueAtTime(pointDetune, pointTime);
      });
    }

    // Vibrato LFO
    if (expression?.vibrato?.enabled) {
      const lfo = this.audioCtx.createOscillator();
      lfo.frequency.setValueAtTime(expression.vibrato.rate || 5, time);
      
      const vibratoGain = this.audioCtx.createGain();
      vibratoGain.gain.setValueAtTime(expression.vibrato.depth * 50 || 5, time);
      
      lfo.connect(vibratoGain);
      vibratoGain.connect(src.detune);
      lfo.start(time);
      
      // Stop LFO when note ends (approximate)
      if (expression.duration) {
        lfo.stop(time + expression.duration + (expression.release || 0.1));
      }
    }

    const voiceGain = this.audioCtx.createGain();
    const velFactor = velocity / 127;
    const velGain = this.velocityEnabled ? velFactor : 1.0;
    
    // Envelope Control
    const attack = expression?.attack || 0.01;
    voiceGain.gain.setValueAtTime(0, time);
    voiceGain.gain.linearRampToValueAtTime(velGain, time + attack);
    
    src.connect(voiceGain);
    voiceGain.connect(this.masterGain);

    src.start(time);

    // Track nodes for stopping
    this.sourceNodes[finalMidi] = src;
    this.sourceGains[finalMidi] = voiceGain;
  }

  public noteOff(midi: number, expression?: any, stopTime?: number) {
    const baseIndex = midi + this.octaveMap[this.currentOctave];
    const time = stopTime ?? (this.audioCtx?.currentTime || 0);
    
    this.stopNode(baseIndex, expression?.release, time);
    
    for (let r = 1; r <= this.additionalReeds; r++) {
      const reedIndex = baseIndex + (r * 12);
      this.stopNode(reedIndex, expression?.release, time);
    }
  }

  private stopNode(index: number, releaseTime?: number, time?: number) {
    if (!this.audioCtx || index < 0 || index >= 128) return;
    const now = time ?? this.audioCtx.currentTime;

    const node = this.sourceNodes[index];
    const gain = this.sourceGains[index];

    if (gain && node) {
      try {
        const release = releaseTime || 0.01;
        gain.gain.cancelScheduledValues(now);
        gain.gain.setValueAtTime(gain.gain.value, now);
        gain.gain.linearRampToValueAtTime(0, now + release);
        node.stop(now + release + 0.01);
      } catch (e) {
        // Already stopped
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
