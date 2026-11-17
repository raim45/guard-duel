import { describe, expect, it } from 'vitest';
import { MOOD_FACES, avatarCacheSize, avatarDataUri } from './avatar';

const decode = (uri: string) => decodeURIComponent(uri.split(',').slice(1).join(','));

describe('Warden avatar moods', () => {
  it('matches the design mood table', () => {
    expect(MOOD_FACES.idle).toEqual({ eyes: 'frame1', mouths: ['smile01'] });
    expect(MOOD_FACES.thinking).toEqual({ eyes: 'eva', mouths: ['diagram'] });
    expect(MOOD_FACES.talking).toEqual({ eyes: 'frame1', mouths: ['smile01', 'diagram'] });
    expect(MOOD_FACES.cracked).toEqual({ eyes: 'bulging', mouths: ['diagram'] });
    expect(MOOD_FACES.held).toEqual({ eyes: 'hearts', mouths: ['smile02'] });
  });

  it('renders an SVG data URI and is deterministic for a seed', () => {
    const first = avatarDataUri('guard-1', 'idle');
    expect(first.startsWith('data:image/svg+xml')).toBe(true);
    expect(decode(first)).toContain('<svg');
    expect(avatarDataUri('guard-1', 'idle')).toBe(first);
  });

  it('draws a different face for each mood and for different seeds', () => {
    const faces = (['idle', 'thinking', 'cracked', 'held'] as const).map((mood) => avatarDataUri('guard-2', mood));
    expect(new Set(faces).size).toBe(4);
    expect(avatarDataUri('guard-3', 'idle')).not.toBe(avatarDataUri('guard-4', 'idle'));
  });

  it('alternates the talking mouth between two frames', () => {
    expect(avatarDataUri('guard-5', 'talking', 0)).not.toBe(avatarDataUri('guard-5', 'talking', 1));
    expect(avatarDataUri('guard-5', 'talking', 2)).toBe(avatarDataUri('guard-5', 'talking', 0));
  });

  it('memoises per seed, eyes and mouth', () => {
    const before = avatarCacheSize();
    avatarDataUri('guard-6', 'held');
    avatarDataUri('guard-6', 'held');
    expect(avatarCacheSize()).toBe(before + 1);
  });
});
