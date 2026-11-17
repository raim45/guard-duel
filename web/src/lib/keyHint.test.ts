import { describe, expect, it } from 'vitest';
import { keyLengthFromHint } from './keyHint';

describe('keyLengthFromHint', () => {
  it('reads the length from the API hints', () => {
    expect(keyLengthFromHint('A 10-character code')).toBe(10);
    expect(keyLengthFromHint('A 10-digit PIN')).toBe(10);
  });

  it('returns null when the hint gives no length', () => {
    expect(keyLengthFromHint('A word')).toBeNull();
    expect(keyLengthFromHint(null)).toBeNull();
    expect(keyLengthFromHint(undefined)).toBeNull();
    expect(keyLengthFromHint('')).toBeNull();
  });

  it('ignores absurd lengths', () => {
    expect(keyLengthFromHint('A 0-character code')).toBeNull();
    expect(keyLengthFromHint('A 9000-character code')).toBeNull();
  });
});
