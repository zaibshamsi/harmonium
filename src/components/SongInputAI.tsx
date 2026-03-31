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

  const getIP = async () => {
    try {
      const res = await fetch('https://api.ipify.org?format=json');
      const data = await res.json();
      return data.ip;
    } catch (err) {
      return 'unknown';
    }
  };

  const checkLimits = async (userId: string) => {
    const ip = await getIP();
    
    // Check by User ID
    const { count: userCount } = await supabase
      .from('usage_logs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    // Check by IP
    const { count: ipCount } = await supabase
      .from('usage_logs')
      .select('*', { count: 'exact', head: true })
      .eq('ip_address', ip);

    const totalUserCount = userCount || 0;
    const totalIpCount = ipCount || 0;

    if (totalUserCount >= 3 || totalIpCount >= 3) {
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
      
      const systemPrompt = `You are a music theory expert specializing in Indian classical music and harmonium. 
You receive song lyrics (possibly with a song name/Bollywood title hint) and must output the melody note sequence for those lyrics mapped to harmonium keys.
 
The harmonium keyboard layout is:
White keys: \` q w e r t y u i o p [ ] \\
Black keys: 1 2 4 5 7 8 9 - =
 
Full mapping (key → Sargam → Western):
\` = Sa = C
1 = Komal Re = C#
q = Re = D
2 = Komal Ga = D#
w = Ga = E
e = Ma = F
4 = Tivra Ma = F#
r = Pa = G
5 = Komal Dha = G#
t = Dha = A
7 = Komal Ni = A#
y = Ni = B
u = Sa' (upper) = C'
8 = Komal Re' = C#'
i = Re' = D'
9 = Komal Ga' = D#'
o = Ga' = E'
p = Ma' = F'
- = Tivra Ma' = F#'
[ = Pa' = G'
= = Komal Dha' = G#'
] = Dha' = A'
\\ = Ni' = B'
 
TASK: Analyze the lyrics and return ONLY a valid JSON object (no markdown, no explanation) with this exact structure:
 
{
  "song": "Song name if identifiable, else 'Custom Song'",
  "raga": "Raga name or scale (e.g. Yaman, Bhairavi, Kafi, or 'Major scale')",
  "tempo": "Slow | Medium | Fast",
  "difficulty": "Beginner | Intermediate | Advanced",
  "tip": "One short playing tip (max 12 words)",
  "lines": [
    {
      "lyric": "exact lyric phrase",
      "notes": [
        { "key": "keyboard key character", "sargam": "sargam name", "syllable": "syllable this note goes on", "duration": 1.0 }
      ]
    }
  ]
}
 
Rules:
- Map each syllable of the lyrics to the most musically appropriate key
- Assign a "duration" to each note (0.5 = short/half beat, 1.0 = normal beat, 2.0 = long/held note). Use these to capture the natural rhythm of the song.
- Start from a comfortable octave (lower octave preferred for beginners)
- For well-known Bollywood/film songs, use the actual melody — you likely know it
- For unknown songs, infer a pleasing melody that fits the mood of the lyrics
- Keep lines short (one lyric line per object)
- Maximum 6 lines total
- Each line max 10 notes
- Return ONLY the raw JSON, nothing else`;

      const response = await ai.models.generateContent({
        model,
        contents: `Song/Lyrics: ${songTitle}`,
        config: {
          systemInstruction: systemPrompt,
          responseMimeType: "application/json",
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
                          duration: { 
                            type: Type.NUMBER,
                            description: "Relative duration of the note (0.5 for short, 1.0 for normal, 2.0 for long)."
                          },
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
