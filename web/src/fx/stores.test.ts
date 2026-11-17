import { describe, expect, it } from 'vitest';
import { useMotionStore, useSoundStore } from './stores';

describe('D0 preference stores', () => {
  it('keeps sound locked with a 0.4 default volume until a gesture', () => {
    const state = useSoundStore.getState();
    expect(state.unlocked).toBe(false);
    expect(state.volume).toBe(0.4);
  });

  it('clamps volume to the 0 to 1 range', () => {
    useSoundStore.getState().setVolume(3);
    expect(useSoundStore.getState().volume).toBe(1);
    useSoundStore.getState().setVolume(-1);
    expect(useSoundStore.getState().volume).toBe(0);
  });

  it('starts with motion enabled', () => {
    expect(useMotionStore.getState().reduceMotion).toBe(false);
  });
});
