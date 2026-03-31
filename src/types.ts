export interface SongNote {
  key: string;
  sargam: string;
  syllable: string;
  duration: number; // Relative duration (e.g., 0.5, 1, 2)
}

export interface SongLine {
  lyric: string;
  notes: SongNote[];
}

export interface SongData {
  song: string;
  raga: string;
  tempo: string;
  difficulty: string;
  tip: string;
  lines: SongLine[];
}
