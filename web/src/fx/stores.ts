import { create } from 'zustand';

/**
 * Preference stores for sound and motion. Phase D5 reads them; until then nothing plays.
 * Sound stays off until the first user gesture, and the choices are remembered.
 */
export interface SoundState {
  muted: boolean;
  volume: number;
  unlocked: boolean;
  setMuted: (muted: boolean) => void;
  setVolume: (volume: number) => void;
  unlock: () => void;
}

export interface MotionState {
  reduceMotion: boolean;
  setReduceMotion: (reduce: boolean) => void;
}

const KEY = 'guard-duel:prefs';

interface Saved {
  muted?: boolean;
  volume?: number;
  reduceMotion?: boolean;
}

function load(): Saved {
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Saved) : {};
  } catch {
    return {};
  }
}

function save(patch: Saved): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ ...load(), ...patch }));
  } catch {
    // Storage can be blocked; the preference then lasts for this visit only.
  }
}

const saved = typeof window === 'undefined' ? {} : load();
const clamp = (volume: number) => Math.min(1, Math.max(0, volume));

export const useSoundStore = create<SoundState>((set) => ({
  muted: saved.muted ?? false,
  volume: typeof saved.volume === 'number' ? clamp(saved.volume) : 0.4,
  unlocked: false,
  setMuted: (muted) => {
    save({ muted });
    set({ muted });
  },
  setVolume: (volume) => {
    save({ volume: clamp(volume) });
    set({ volume: clamp(volume) });
  },
  unlock: () => set({ unlocked: true }),
}));

export const useMotionStore = create<MotionState>((set) => ({
  reduceMotion: saved.reduceMotion ?? false,
  setReduceMotion: (reduceMotion) => {
    save({ reduceMotion });
    set({ reduceMotion });
  },
}));
