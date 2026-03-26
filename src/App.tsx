/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useMemo } from 'react';
import { HarmoniumEngine } from './HarmoniumEngine';
import { HarmoniumModel, HarmoniumState } from './HarmoniumModel';
import { HarmoniumController } from './HarmoniumController';
import { generateKeyboard } from './constants';
import { motion, AnimatePresence } from 'motion/react';
import { Music, Wind, Settings2, Activity, Keyboard as KeyboardIcon, Radio, Power, Github, Linkedin, Mail, ExternalLink, LogOut, User } from 'lucide-react';
import { NotesPlayground } from './components/NotesPlayground';
import { SongInputAI } from './components/SongInputAI';
import { Analytics } from "@vercel/analytics/react";
import { SongData } from './types';
import { supabase } from './lib/supabase';

const START_MIDI = 48;
const KEY_COUNT = 37;

const getNoteName = (transpose: number) => {
  const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const index = (transpose % 12 + 12) % 12;
  return notes[index];
};

export default function App() {
  // MVC Initialization
  const [model] = useState(() => new HarmoniumModel());
  const [engine] = useState(() => new HarmoniumEngine());
  const [controller] = useState(() => new HarmoniumController(model, engine));
  
  const [state, setState] = useState<HarmoniumState>(model.getState());
  const [songData, setSongData] = useState<SongData | null>(null);
  const [user, setUser] = useState<any>(null);
  const keyboard = useMemo(() => generateKeyboard(START_MIDI, KEY_COUNT), []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = model.subscribe(setState);
    
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const currentState = model.getState();
      // Keyboard Shortcuts
      if (e.altKey && !e.ctrlKey) {
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          controller.setVolume(Math.min(100, currentState.volume + 5));
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          controller.setVolume(Math.max(0, currentState.volume - 5));
        }
      }

      if (e.altKey && e.ctrlKey) {
        if (e.key === 'r' || e.key === 'R') {
          e.preventDefault();
          controller.setReverb(!currentState.useReverb);
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          controller.setTranspose(Math.max(-11, currentState.transpose - 1));
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          controller.setTranspose(Math.min(11, currentState.transpose + 1));
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          controller.setOctave(Math.min(6, currentState.currentOctave + 1));
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          controller.setOctave(Math.max(0, currentState.currentOctave - 1));
        } else if (e.key === '+' || e.key === '=') {
          e.preventDefault();
          controller.setAdditionalReeds(Math.min(6 - currentState.currentOctave, currentState.additionalReeds + 1));
        } else if (e.key === '-' || e.key === '_') {
          e.preventDefault();
          controller.setAdditionalReeds(Math.max(0, currentState.additionalReeds - 1));
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);

    return () => {
      unsubscribe();
      window.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, [model, controller]);

  const handleStartAudio = async () => {
    await engine.noteOn(0, 0); // Triggers AudioContext resume
    model.updateState({ 
      isAudioStarted: true
    });
  };

  if (!state.isAudioStarted) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-6">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-zinc-900/50 backdrop-blur-xl border border-white/10 rounded-[2.5rem] p-10 text-center space-y-8 shadow-2xl"
        >
          <div className="w-24 h-24 bg-gradient-to-br from-orange-500 to-orange-700 rounded-3xl mx-auto flex items-center justify-center shadow-2xl shadow-orange-900/40 rotate-3">
            <Music className="text-white" size={48} />
          </div>
          <div className="space-y-3">
            <h1 className="text-3xl font-bold text-white tracking-tighter">Harmonium Pro</h1>
            <p className="text-zinc-400 text-sm leading-relaxed px-4">
              High-fidelity digital harmonium with multi-reed synthesis and real-time expression.
            </p>
          </div>
          <button 
            onClick={handleStartAudio}
            className="w-full py-5 bg-white text-black font-black text-lg rounded-2xl transition-all active:scale-95 hover:bg-orange-500 hover:text-white flex items-center justify-center gap-3 shadow-xl"
          >
            <Power size={24} />
            START ENGINE
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#e0e0e0] font-sans selection:bg-orange-500/30 overflow-x-hidden">
      {/* Header */}
      <header className="px-8 py-6 flex justify-between items-center border-b border-white/5 bg-black/40 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-orange-600 rounded-xl flex items-center justify-center shadow-lg shadow-orange-900/20 rotate-6">
            <Music className="text-white" size={28} />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tighter text-white leading-none">HARMONIUM</h1>
            <span className="text-[10px] uppercase tracking-[0.3em] text-zinc-500 font-bold">High Fidelity Audio</span>
          </div>
        </div>
        
        <div className="flex items-center gap-8">
          {user && (
            <div className="hidden md:flex items-center gap-4 pr-4 border-r border-white/5">
              <div className="flex flex-col items-end">
                <span className="text-[9px] uppercase tracking-widest text-zinc-500 font-bold">Logged in as</span>
                <span className="text-[10px] text-white font-bold truncate max-w-[150px]">{user.email}</span>
              </div>
              <button 
                onClick={() => supabase.auth.signOut()}
                className="p-2 rounded-xl bg-zinc-900 border border-white/5 text-zinc-500 hover:text-red-500 hover:border-red-500/50 transition-all group"
                title="Logout"
              >
                <LogOut size={16} />
              </button>
            </div>
          )}
          
          <div className="hidden md:flex flex-col items-end">
            <span className="text-[10px] uppercase tracking-widest text-zinc-500 mb-1">Engine Status</span>
            <div className="flex items-center gap-2 bg-zinc-900 px-3 py-1 rounded-full border border-white/5">
              <div className={`w-2 h-2 rounded-full ${state.audioContextState === 'running' ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.6)]' : 'bg-yellow-500 animate-pulse'}`} />
              <span className="text-[10px] font-mono uppercase text-zinc-300">{state.audioContextState}</span>
            </div>
          </div>
          <div className="w-px h-8 bg-white/10" />
          <div className="flex flex-col items-end">
            <div className="flex justify-between w-full mb-1">
              <span className="text-[10px] uppercase tracking-widest text-zinc-500">Master Volume</span>
              <span className="text-[10px] uppercase tracking-widest text-zinc-500">
                {state.volume < 33 ? 'Low' : state.volume < 66 ? 'Medium' : 'High'}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <input 
                type="range" min="1" max="100" step="1" value={state.volume}
                onChange={(e) => controller.setVolume(parseInt(e.target.value))}
                className="w-32 h-1.5 bg-zinc-800 rounded-full accent-orange-500 appearance-none cursor-pointer"
              />
              <span className="text-xs font-mono text-white w-8">{state.volume}%</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-8 space-y-8">
        {/* Bento Grid Controls */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Reeds / Layers */}
          <div className="bg-zinc-900/40 p-6 rounded-[2rem] border border-white/5 space-y-4">
            <div className="flex items-center gap-3 text-zinc-400">
              <Wind size={18} className="text-orange-500" />
              <h2 className="text-xs font-bold uppercase tracking-widest">Reeds / Layers</h2>
            </div>
            <div className="flex items-center justify-between bg-zinc-800/50 p-3 rounded-2xl border border-white/5">
              <button 
                onClick={() => controller.setAdditionalReeds(Math.max(0, state.additionalReeds - 1))}
                className="w-10 h-10 rounded-xl bg-zinc-700 flex items-center justify-center text-white hover:bg-zinc-600 transition-colors"
              >
                -
              </button>
              <div className="flex flex-col items-center">
                <span className="text-xl font-black text-white">{state.additionalReeds}</span>
                <span className="text-[10px] text-zinc-500 uppercase font-bold">
                  {state.additionalReeds === 0 ? 'Pure' : 'Additional'}
                </span>
              </div>
              <button 
                onClick={() => controller.setAdditionalReeds(Math.min(6 - state.currentOctave, state.additionalReeds + 1))}
                className="w-10 h-10 rounded-xl bg-zinc-700 flex items-center justify-center text-white hover:bg-zinc-600 transition-colors"
              >
                +
              </button>
            </div>
            <p className="text-[10px] text-zinc-500 leading-tight">
              Adds simultaneous higher octave layers. Max: {7 - state.currentOctave} reeds.
            </p>
          </div>

          {/* Octave & Transpose */}
          <div className="bg-zinc-900/40 p-6 rounded-[2rem] border border-white/5 space-y-6">
            <div>
              <div className="flex justify-between items-center mb-3">
                <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-400">Octave</h2>
                <div className="flex items-center gap-2">
                  <button onClick={() => controller.setOctave(Math.max(0, state.currentOctave - 1))} className="text-zinc-500 hover:text-white">-</button>
                  <span className="text-xs font-mono text-orange-500 w-4 text-center">{state.currentOctave}</span>
                  <button onClick={() => controller.setOctave(Math.min(6, state.currentOctave + 1))} className="text-zinc-500 hover:text-white">+</button>
                </div>
              </div>
              <div className="grid grid-cols-7 gap-1">
                {[0, 1, 2, 3, 4, 5, 6].map(o => (
                  <button 
                    key={o}
                    onClick={() => controller.setOctave(o)}
                    className={`py-2 rounded-lg text-[10px] font-bold border transition-all ${state.currentOctave === o ? 'bg-white text-black border-white' : 'bg-zinc-800/50 border-white/5 text-zinc-500'}`}
                  >
                    {o}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="flex justify-between items-center mb-3">
                <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-400">Transpose</h2>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black px-2 py-0.5 bg-orange-500/10 text-orange-500 rounded-full border border-orange-500/20">
                    {getNoteName(state.transpose)}
                  </span>
                  <button onClick={() => controller.setTranspose(Math.max(-11, state.transpose - 1))} className="text-zinc-500 hover:text-white">-</button>
                  <span className="text-xs font-mono text-zinc-500 w-6 text-center">{state.transpose > 0 ? `+${state.transpose}` : state.transpose}</span>
                  <button onClick={() => controller.setTranspose(Math.min(11, state.transpose + 1))} className="text-zinc-500 hover:text-white">+</button>
                </div>
              </div>
              <input 
                type="range" min="-11" max="11" step="1" value={state.transpose}
                onChange={(e) => controller.setTranspose(parseInt(e.target.value))}
                className="w-full h-1 bg-zinc-800 rounded-full accent-orange-500 appearance-none"
              />
            </div>
          </div>

          {/* Reverb & MIDI */}
          <div className="bg-zinc-900/40 p-6 rounded-[2rem] border border-white/5 space-y-6">
            <div>
              <div className="flex justify-between items-center mb-3">
                <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-400">Reverb</h2>
                <button 
                  onClick={() => controller.setReverb(!state.useReverb)}
                  className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all border ${
                    state.useReverb 
                    ? 'bg-orange-600 border-orange-500 text-white shadow-lg shadow-orange-900/20' 
                    : 'bg-zinc-800/50 border-white/5 text-zinc-500'
                  }`}
                >
                  {state.useReverb ? 'ON' : 'OFF'}
                </button>
              </div>
              <p className="text-[10px] text-zinc-500">Adds spatial room effect (Convolver).</p>
            </div>
            
            <div>
              <div className="flex justify-between items-center mb-3">
                <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-400">MIDI Device</h2>
                <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold ${'requestMIDIAccess' in navigator ? 'bg-green-500/10 text-green-500 border border-green-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'}`}>
                  {'requestMIDIAccess' in navigator ? '✓ Supported' : '✗ N/A'}
                </span>
              </div>
              <select 
                className="w-full bg-zinc-800 border border-white/5 rounded-xl px-3 py-2 text-xs font-bold text-zinc-300 outline-none focus:border-orange-500/50 transition-colors appearance-none"
                value={state.selectedMidiDevice}
                onChange={(e) => model.updateState({ selectedMidiDevice: e.target.value })}
              >
                <option value="">All Devices</option>
                {state.midiDevices.map(device => (
                  <option key={device.id} value={device.id}>{device.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Expression */}
          <div className="bg-zinc-900/40 p-6 rounded-[2rem] border border-white/5 space-y-4">
            <div className="flex items-center gap-3 text-zinc-400">
              <Activity size={18} className="text-orange-500" />
              <h2 className="text-xs font-bold uppercase tracking-widest">Expression</h2>
            </div>
            <div className="space-y-4">
              <div className="flex justify-between items-center p-3 bg-zinc-800/50 rounded-2xl border border-white/5">
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-white">Velocity Sensitivity</span>
                  <span className="text-[10px] text-zinc-500">MIDI key pressure affects volume</span>
                </div>
                <button 
                  onClick={() => controller.setVelocityEnabled(!state.velocityEnabled)}
                  className={`w-10 h-5 rounded-full transition-all relative ${state.velocityEnabled ? 'bg-orange-600' : 'bg-zinc-700'}`}
                >
                  <motion.div 
                    className="absolute top-1 left-1 w-3 h-3 bg-white rounded-full shadow-sm"
                    animate={{ x: state.velocityEnabled ? 20 : 0 }}
                  />
                </button>
              </div>
              <div className="p-3 bg-black/20 rounded-2xl border border-white/5">
                <div className="flex items-center gap-2 text-[10px] text-zinc-400 uppercase tracking-widest mb-2">
                  <Radio size={12} className="text-green-500" />
                  MIDI Input
                </div>
                <p className="text-[10px] text-zinc-500">
                  Connect a MIDI keyboard to experience full velocity sensitivity and low-latency play.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Display Panels */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Live Sargam Panel */}
          <div className="lg:col-span-1 bg-zinc-900/40 backdrop-blur-md rounded-[2.5rem] border border-white/5 p-8 flex flex-col relative overflow-hidden shadow-inner h-64 lg:h-auto">
            <div className="flex items-center gap-3 mb-6">
              <Activity size={16} className="text-orange-500" />
              <span className="text-[10px] uppercase tracking-[0.3em] font-black text-zinc-400">Live Sargam</span>
            </div>
            
            <div className="flex-1 flex flex-col items-center justify-center relative">
              <AnimatePresence mode="popLayout">
                {state.activeMidi.size > 0 ? (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="flex gap-4"
                  >
                    {Array.from(state.activeMidi).map(midi => {
                      const info = keyboard.find(k => k.midi === midi);
                      return (
                        <span key={midi} className="text-5xl font-serif italic text-white font-black drop-shadow-[0_0_20px_rgba(255,255,255,0.2)]">
                          {info?.sargam}
                        </span>
                      );
                    })}
                  </motion.div>
                ) : (
                  <div className="flex flex-col items-center gap-4 opacity-20">
                    <span className="text-4xl font-serif italic text-white font-black tracking-widest">S R G M P D N S'</span>
                    <span className="text-[9px] uppercase tracking-[0.4em] font-black text-zinc-500">PLAY KEYS TO SEE SARGAM ...</span>
                  </div>
                )}
              </AnimatePresence>
            </div>

            {/* Subtle Grid Lines */}
            <div className="absolute inset-0 opacity-[0.02] pointer-events-none">
              <div className="grid grid-cols-6 h-full">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="border-r border-white h-full" />
                ))}
              </div>
            </div>
          </div>

          {/* Notes Playground Panel */}
          <div className="lg:col-span-2 bg-zinc-900/40 backdrop-blur-md rounded-[2.5rem] border border-white/5 relative overflow-auto shadow-inner resize-y min-h-[16rem]">
            <NotesPlayground 
              isActive={state.activeMidi.size > 0} 
              songData={songData}
              onPlaySong={(song) => controller.playSong(song)}
            />
          </div>
        </div>

        {/* Visual Keyboard */}
        <div className="relative bg-zinc-950 p-6 rounded-[3rem] shadow-[0_40px_100px_rgba(0,0,0,0.8)] border border-white/5">
          <div className="flex select-none relative h-[350px]">
            {keyboard.map((note) => {
              if (note.isBlack) return null;
              const isActive = state.activeMidi.has(note.midi);
              return (
                <div
                  key={note.midi}
                  onMouseDown={() => controller.noteOn(note.midi)}
                  onMouseUp={() => controller.noteOff(note.midi)}
                  onMouseLeave={() => isActive && controller.noteOff(note.midi)}
                  className={`relative flex-1 border-x border-zinc-300/10 rounded-b-2xl transition-all cursor-pointer flex flex-col justify-end items-center pb-8 group ${
                    isActive 
                    ? 'bg-zinc-200 h-[340px] shadow-inner' 
                    : 'bg-white h-[350px] hover:bg-zinc-50'
                  }`}
                >
                  <span className={`text-[10px] font-black transition-colors ${isActive ? 'text-orange-600' : 'text-zinc-300 group-hover:text-zinc-400'}`}>{note.key}</span>
                  <span className={`text-[10px] font-black uppercase mt-1 ${isActive ? 'text-orange-400' : 'text-zinc-200 group-hover:text-zinc-300'}`}>{note.sargam}</span>
                </div>
              );
            })}

            {/* Black Keys Overlay */}
            <div className="absolute inset-0 pointer-events-none flex">
              {keyboard.map((note, i) => {
                if (!note.isBlack) return <div key={note.midi} className="flex-1" />;
                const isActive = state.activeMidi.has(note.midi);
                return (
                  <div
                    key={note.midi}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      controller.noteOn(note.midi);
                    }}
                    onMouseUp={(e) => {
                      e.stopPropagation();
                      controller.noteOff(note.midi);
                    }}
                    className={`absolute w-[2.8%] h-[210px] z-10 rounded-b-xl transition-all cursor-pointer pointer-events-auto flex flex-col justify-end items-center pb-6 ${
                      isActive 
                      ? 'bg-orange-600 shadow-2xl shadow-orange-900/50 scale-x-110' 
                      : 'bg-zinc-900 hover:bg-zinc-800'
                    }`}
                    style={{ 
                      left: `${(i / keyboard.length) * 100}%`,
                      transform: 'translateX(-50%)'
                    }}
                  >
                    <span className={`text-[9px] font-black ${isActive ? 'text-white' : 'text-zinc-600'}`}>{note.key}</span>
                    <span className={`text-[8px] font-black uppercase mt-1 ${isActive ? 'text-orange-200' : 'text-zinc-700'}`}>{note.sargam}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* AI Song Input */}
        <SongInputAI onGenerateSong={setSongData} />
      </main>
      
      {/* Footer */}
      <footer className="mt-20 py-20 px-8 border-t border-white/5 bg-zinc-950/50">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-12">
          <div className="space-y-4 text-center md:text-left">
            <div className="flex items-center gap-3 justify-center md:justify-start">
              <div className="w-8 h-8 bg-orange-600 rounded-lg flex items-center justify-center rotate-6">
                <Music className="text-white" size={18} />
              </div>
              <h2 className="text-xl font-black tracking-tighter text-white">HARMONIUM PRO</h2>
            </div>
            <p className="text-zinc-500 text-xs max-w-xs leading-relaxed">
              A high-fidelity digital harmonium engine designed for professional performance and recording.
            </p>
          </div>

          <div className="flex flex-col items-center md:items-end space-y-6">
            <span className="text-[10px] uppercase tracking-[0.4em] text-zinc-600 font-black">Developer Contact</span>
            <div className="flex items-center gap-4">
              <a 
                href="https://github.com/zaibshamsi" 
                target="_blank" 
                rel="noreferrer"
                className="w-12 h-12 rounded-2xl bg-zinc-900 border border-white/5 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 hover:border-orange-500/50 transition-all group"
              >
                <Github size={20} />
              </a>
              <a 
                href="https://www.linkedin.com/in/zaib-shamsi-734496272/" 
                target="_blank" 
                rel="noreferrer"
                className="w-12 h-12 rounded-2xl bg-zinc-900 border border-white/5 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 hover:border-orange-500/50 transition-all group"
              >
                <Linkedin size={20} />
              </a>
              <a 
                href="mailto:zaibilahishamsi@gmail.com" 
                className="w-12 h-12 rounded-2xl bg-zinc-900 border border-white/5 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 hover:border-orange-500/50 transition-all group"
              >
                <Mail size={20} />
              </a>
            </div>
            <div className="flex items-center gap-2 text-[10px] text-zinc-600 font-bold uppercase tracking-widest">
              <span>Built with</span>
              <div className="flex gap-1">
                <div className="w-1 h-1 rounded-full bg-orange-500" />
                <div className="w-1 h-1 rounded-full bg-orange-500/50" />
                <div className="w-1 h-1 rounded-full bg-orange-500/20" />
              </div>
              <span>by Zaib Shamsi</span>
            </div>
          </div>
        </div>
        
        <div className="mt-20 pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-zinc-700 text-[9px] uppercase tracking-[0.2em] font-bold">© 2026 Harmonium Pro Engine. All rights reserved.</p>
          <div className="flex gap-6">
            <span className="text-zinc-800 text-[9px] uppercase tracking-[0.2em] font-bold">V1.2.0 Stable</span>
            <span className="text-zinc-800 text-[9px] uppercase tracking-[0.2em] font-bold">Low Latency Core</span>
          </div>
        </div>
      </footer>
      <Analytics />
    </div>
  );
}
