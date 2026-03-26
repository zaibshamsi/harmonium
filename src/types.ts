export interface NoteExpression {
  pitchCurve?: { t: number; v: number }[];
  vibrato?: {
    enabled: boolean;
    rate: number;
    depth: number;
  };
  attack?: number;
  release?: number;
}

export interface SongNote {
  key: string;
  sargam: string;
  syllable: string;
  duration: number; // Relative duration (e.g., 0.5, 1, 2)
  start?: number; // Absolute start time in beats
  velocity?: number; // 0.0 to 1.0
  expression?: NoteExpression;
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
