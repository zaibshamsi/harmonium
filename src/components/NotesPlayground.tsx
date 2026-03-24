import React, { useState } from 'react';
import { Pencil, FileText } from 'lucide-react';

interface NotesPlaygroundProps {
  isActive: boolean;
}

export const NotesPlayground: React.FC<NotesPlaygroundProps> = () => {
  const [notes, setNotes] = useState<string>('');

  return (
    <div className="w-full h-full flex flex-col p-8 relative">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 z-10">
        <div className="flex items-center gap-3">
          <Pencil size={16} className="text-orange-500" />
          <span className="text-[10px] uppercase tracking-[0.3em] font-black text-zinc-400">Notes Playground</span>
        </div>
        
        <div className="flex items-center gap-2 opacity-40">
          <FileText size={14} className="text-zinc-400" />
          <span className="text-[9px] uppercase tracking-[0.2em] font-black text-zinc-400">Glow Enabled</span>
        </div>
      </div>

      {/* Input Area */}
      <div className="flex-1 relative z-10">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Example: S R G M P D N S' ..."
          className="w-full h-full bg-transparent text-4xl font-serif italic text-white/90 outline-none resize-none placeholder:text-zinc-800 leading-relaxed"
        />
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
