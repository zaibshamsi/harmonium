import React, { useState, useEffect } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import { Sparkles, Loader2, Music, Lock } from 'lucide-react';
import { motion } from 'motion/react';
import { supabase } from '../lib/supabase';
import { AuthModal } from './AuthModal';

import { SongData } from '../types';

interface SongInputAIProps {
  onGenerateSong: (song: SongData) => void;
}

export const SongInputAI: React.FC<SongInputAIProps> = ({ onGenerateSong }) => {
  const [songTitle, setSongTitle] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [user, setUser] = useState<any>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [usageCount, setUsageCount] = useState<number | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchUsageCount(session.user.id);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchUsageCount(session.user.id);
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUsageCount = async (userId: string) => {
    try {
      const { count, error } = await supabase
        .from('usage_logs')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);
      
      if (error) throw error;
      setUsageCount(count || 0);
    } catch (err) {
      console.error('Error fetching usage count:', err);
    }
  };

  let cachedIP: string | null = null;
  const getIP = async () => {
    if (cachedIP) return cachedIP;
    try {
      const res = await fetch('https://api.ipify.org?format=json');
      const data = await res.json();
      cachedIP = data.ip;
      return cachedIP;
    } catch (err) {
      return 'unknown';
    }
  };

  const checkLimits = async (userId: string) => {
    const ip = await getIP();
    
    const { count, error } = await supabase
      .from('usage_logs')
      .select('*', { count: 'exact', head: true })
      .or(`user_id.eq.${userId},ip_address.eq.${ip}`);

    if (error) {
      console.error('Error checking limits:', error);
      return { allowed: true, ip }; // Fail open if DB is slow
    }

    const totalCount = count || 0;
    if (totalCount >= 3) {
      return { allowed: false, ip };
    }
    return { allowed: true, ip };
  };

  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  const handleGenerateNotes = async () => {
    if (!user) {
      setIsAuthModalOpen(true);
      return;
    }

    if (!songTitle.trim()) {
      setError('Please enter a song title.');
      return;
    }

    if (cooldown > 0) {
      setError(`Please wait ${cooldown}s before generating again.`);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // 1. Check limits
      const { allowed, ip } = await checkLimits(user.id);
      if (!allowed) {
        throw new Error('You have reached the limit of 3 AI generations per account/IP.');
      }

      // 2. Call Gemini
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      const model = "gemini-3-flash-preview";
      
      const systemPrompt = `You are a professional Indian music transcription and performance generator.
Your task is NOT just to output notes, but to simulate how a human singer would perform the song on a harmonium.
You must generate expressive musical data in JSON format that includes timing, dynamics, and pitch movement.

STRICT RULES:
1. Use Sargam-based understanding (Sa Re Ga Ma) and map it correctly to notes.
2. SEARCH FIRST: Use Google Search to find the actual Sargam notations for the requested song.
3. Do NOT quantize timing. Use natural musical phrasing (e.g., start: 0.02 instead of 0.0).
4. Add expressive elements:
   - pitchCurve (Meend): Use for slides between notes. Keep 'v' (semitone offset) within -2.0 to +2.0.
   - vibrato: Only for long notes (>0.5 duration). Keep 'depth' within 0.05 to 0.2 (subtle).
   - velocity: Use 0.6 for soft notes, 0.9 for emphasized notes.
5. Legato: Allow notes to overlap slightly (e.g., Note A ends at 1.05 while Note B starts at 1.0) for a smooth feel.
6. Avoid robotic spacing. Human singers often start slightly late or early.
7. Return exactly 4-6 lines of the song.

The harmonium keyboard layout is:
White keys: \` q w e r t y u i o p [ ] \\
Black keys: 1 2 4 5 7 8 9 - =
 
Full mapping (key → Sargam → Western):
\`=Sa, 1=re, q=Re, 2=ga, w=Ga, e=Ma, 4=ma, r=Pa, 5=dha, t=Dha, 7=ni, y=Ni
u=Sa', 8=re', i=Re', 9=ga', o=Ga', p=Ma', -=ma', [=Pa', ==dha', ]=Dha', \\=ni'

OUTPUT FORMAT:
Return ONLY a valid JSON object:
{
  "song": "Official Title",
  "raga": "Specific Raga or Scale",
  "tempo": "Slow | Medium | Fast",
  "difficulty": "Beginner | Intermediate | Advanced",
  "tip": "Specific technique tip",
  "lines": [
    {
      "lyric": "Lyric phrase",
      "notes": [
        {
          "key": "char",
          "sargam": "name",
          "syllable": "text",
          "start": float, // Absolute start time in beats
          "duration": float, // Duration in beats
          "velocity": float, // 0.5-1.0
          "expression": {
            "pitchCurve": [{ "t": float, "v": float }], // t: 0-1 (relative to duration), v: semitone offset
            "vibrato": { "enabled": bool, "rate": float, "depth": float },
            "attack": float,
            "release": float
          }
        }
      ]
    }
  ]
}
Return ONLY raw JSON. Max 6 lines.`;

      const response = await ai.models.generateContent({
        model,
        contents: `Generate expressive harmonium playback data for the song: "${songTitle}"`,
        config: {
          systemInstruction: systemPrompt,
          responseMimeType: "application/json",
          tools: [{ googleSearch: {} }],
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              song: { type: Type.STRING },
              raga: { type: Type.STRING },
              tempo: { type: Type.STRING },
              difficulty: { type: Type.STRING },
              tip: { type: Type.STRING },
              lines: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    lyric: { type: Type.STRING },
                    notes: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          key: { type: Type.STRING },
                          sargam: { type: Type.STRING },
                          syllable: { type: Type.STRING },
                          start: { type: Type.NUMBER },
                          duration: { type: Type.NUMBER },
                          velocity: { type: Type.NUMBER },
                          expression: {
                            type: Type.OBJECT,
                            properties: {
                              pitchCurve: {
                                type: Type.ARRAY,
                                items: {
                                  type: Type.OBJECT,
                                  properties: {
                                    t: { type: Type.NUMBER },
                                    v: { type: Type.NUMBER }
                                  }
                                }
                              },
                              vibrato: {
                                type: Type.OBJECT,
                                properties: {
                                  enabled: { type: Type.BOOLEAN },
                                  rate: { type: Type.NUMBER },
                                  depth: { type: Type.NUMBER }
                                }
                              },
                              attack: { type: Type.NUMBER },
                              release: { type: Type.NUMBER }
                            }
                          }
                        },
                        required: ["key", "sargam", "syllable", "duration"],
                      },
                    },
                  },
                  required: ["lyric", "notes"],
                },
              },
            },
            required: ["song", "raga", "tempo", "difficulty", "tip", "lines"],
          },
        },
      });

      const data = JSON.parse(response.text || '{}') as SongData;
      console.log('[AI] Received Song Data:', data);
      
      const allNotes = data.lines.flatMap(l => l.notes);
      const hasV2 = allNotes.some(n => n.start !== undefined || n.expression !== undefined);
      console.log(`[AI] Expressive Data (V2) Detected: ${hasV2 ? 'YES ✅' : 'NO ❌'}`);

      if (data.lines && data.lines.length > 0) {
        // 3. Log usage
        await supabase.from('usage_logs').insert({
          user_id: user.id,
          ip_address: ip,
          song_title: songTitle
        });

        onGenerateSong(data);
        setSongTitle('');
        setCooldown(30); // 30 second cooldown
        fetchUsageCount(user.id);
      } else {
        throw new Error('AI failed to generate valid notes structure.');
      }
    } catch (err: any) {
      console.error('Error generating notes:', err);
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-zinc-900/40 p-8 rounded-[2.5rem] border border-white/5 shadow-inner space-y-6">
      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
      
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Sparkles size={18} className="text-orange-500" />
          <h2 className="text-xs font-black uppercase tracking-[0.3em] text-zinc-400">AI Song to Notes</h2>
        </div>
        {user && usageCount !== null && (
          <div className="flex items-center gap-2 bg-zinc-800/50 px-3 py-1 rounded-full border border-white/5">
            <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Usage: {usageCount}/3</span>
          </div>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <input
            type="text"
            value={songTitle}
            onChange={(e) => setSongTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleGenerateNotes()}
            placeholder="Enter a song (e.g., 'Tum Hi Ho', 'Let It Be')..."
            className="w-full bg-zinc-800/50 border border-white/5 rounded-2xl px-6 py-4 text-sm font-bold text-white outline-none focus:border-orange-500/50 transition-all placeholder:text-zinc-600"
          />
          <Music className="absolute right-6 top-1/2 -translate-y-1/2 text-zinc-700" size={18} />
        </div>
        
        <button
          onClick={handleGenerateNotes}
          disabled={isLoading || !songTitle.trim() || cooldown > 0 || (usageCount !== null && usageCount >= 3)}
          className="px-8 py-4 bg-orange-600 text-white font-black text-xs uppercase tracking-widest rounded-2xl transition-all active:scale-95 hover:bg-orange-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-xl shadow-orange-900/20 flex items-center justify-center gap-3 min-w-[180px]"
        >
          {isLoading ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              GENERATING...
            </>
          ) : cooldown > 0 ? (
            <>
              WAIT {cooldown}S
            </>
          ) : !user ? (
            <>
              <Lock size={16} />
              LOGIN TO GENERATE
            </>
          ) : usageCount !== null && usageCount >= 3 ? (
            <>
              LIMIT REACHED
            </>
          ) : (
            <>
              <Sparkles size={16} />
              GENERATE NOTES
            </>
          )}
        </button>
      </div>

      {error && (
        <motion.p 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-red-500 text-[10px] font-bold uppercase tracking-widest bg-red-500/10 p-3 rounded-xl border border-red-500/20"
        >
          {error}
        </motion.p>
      )}

      <p className="text-[10px] text-zinc-600 font-medium leading-relaxed">
        AI features require login. Each account/IP is limited to 3 total generations to prevent overuse.
      </p>
    </div>
  );
};
