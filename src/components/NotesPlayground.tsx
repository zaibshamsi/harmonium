import React, { useState } from 'react';
import { Pencil, FileText, Play, Music } from 'lucide-react';
import { SongData } from '../types';

interface NotesPlaygroundProps {
  isActive: boolean;
  songData: SongData | null;
  onPlaySong: (song: SongData) => void;
}

export const NotesPlayground: React.FC<NotesPlaygroundProps> = ({ songData, onPlaySong }) => {
  return (
    <div className="w-full h-full flex flex-col p-8 relative">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 z-10">
        <div className="flex items-center gap-3">
          <Pencil size={16} className="text-orange-500" />
          <span className="text-[10px] uppercase tracking-[0.3em] font-black text-zinc-400">Notes Playground</span>
        </div>
        
        {songData && (
          <button 
            onClick={() => onPlaySong(songData)}
            className="flex items-center gap-2 bg-orange-600 hover:bg-orange-500 text-white px-4 py-1.5 rounded-full transition-all active:scale-95 shadow-lg shadow-orange-900/20"
          >
            <Play size={12} fill="currentColor" />
            <span className="text-[10px] uppercase tracking-[0.2em] font-black">Play Song</span>
          </button>
        )}

        <div className="flex items-center gap-2 opacity-40">
          <FileText size={14} className="text-zinc-400" />
          <span className="text-[9px] uppercase tracking-[0.2em] font-black text-zinc-400">Glow Enabled</span>
        </div>
      </div>

      {/* Display Area */}
      <div className="flex-1 relative z-10 overflow-y-auto custom-scrollbar">
        {songData ? (
          <div className="space-y-6">
            <div className="flex flex-wrap gap-4 items-center">
              <h3 className="text-2xl font-black text-white tracking-tight">[{songData.song}]</h3>
              <div className="flex gap-2">
                <span className="px-2 py-0.5 bg-zinc-800 text-[9px] font-bold text-zinc-400 rounded uppercase tracking-widest border border-white/5">Raga: {songData.raga}</span>
                <span className="px-2 py-0.5 bg-zinc-800 text-[9px] font-bold text-zinc-400 rounded uppercase tracking-widest border border-white/5">Tempo: {songData.tempo}</span>
                <span className="px-2 py-0.5 bg-zinc-800 text-[9px] font-bold text-zinc-400 rounded uppercase tracking-widest border border-white/5">Difficulty: {songData.difficulty}</span>
              </div>
            </div>
            
            <div className="flex items-start gap-3 p-3 bg-orange-500/5 border border-orange-500/10 rounded-2xl">
              <Music size={14} className="text-orange-500 mt-0.5 shrink-0" />
              <p className="text-[10px] text-zinc-400 font-medium italic leading-relaxed">
                Tip: {songData.tip}
              </p>
            </div>

            <div className="space-y-8 pt-4">
              {songData.lines.map((line, idx) => (
                <div key={idx} className="space-y-3 group">
                  <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest group-hover:text-zinc-300 transition-colors">{line.lyric}</p>
                  <div className="flex flex-wrap gap-x-6 gap-y-4">
                    {line.notes.map((note, nIdx) => (
                      <div key={nIdx} className="flex flex-col items-center gap-1">
                        <span className="text-2xl font-serif italic text-white font-black">{note.sargam}</span>
                        <span className="text-[9px] font-mono text-orange-500/60 font-bold bg-orange-500/5 px-1.5 rounded border border-orange-500/10">{note.key}</span>
                        <span className="text-[8px] text-zinc-600 font-bold uppercase tracking-tighter">{note.syllable}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center opacity-20 text-center space-y-4">
            <Music size={48} className="text-white" />
            <div className="space-y-1">
              <p className="text-xl font-serif italic text-white font-black tracking-widest">S R G M P D N S'</p>
              <p className="text-[9px] uppercase tracking-[0.4em] font-black text-zinc-500">GENERATE A SONG TO START ...</p>
            </div>
          </div>
        )}
      </div>

      {/* Subtle Vertical Grid Lines */}
      <div className="absolute inset-0 opacity-[0.02] pointer-events-none">
        <div className="grid grid-cols-12 h-full">
          {[...Array(12)].map((_, i) => (
            <div key={i} className="border-r border-white h-full" />
          ))}
        </div>
      </div>
    </div>
  );
};
