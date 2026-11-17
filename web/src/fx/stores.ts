import { create } from 'zustand';

/**
 * Placeholder stores for design phase D5. D0 only holds the preferences; no sound or
 * motion is produced yet (Stage 8). Sound stays off until the first user gesture.
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

export const useSoundStore = create<SoundState>((set) => ({
  muted: false,
  volume: 0.4,
  unlocked: false,
  setMuted: (muted) => set({ muted }),
  setVolume: (volume) => set({ volume: Math.min(1, Math.max(0, volume)) }),
  unlock: () => set({ unlocked: true }),
}));

export const useMotionStore = create<MotionState>((set) => ({
  reduceMotion: false,
  setReduceMotion: (reduceMotion) => set({ reduceMotion }),
}));
