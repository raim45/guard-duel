import { createAvatar } from '@dicebear/core';
import * as botttsNeutral from '@dicebear/bottts-neutral';

export type AvatarMood = 'idle' | 'thinking' | 'talking' | 'cracked' | 'held';

type Eyes = 'frame1' | 'eva' | 'bulging' | 'hearts';
type Mouth = 'smile01' | 'diagram' | 'smile02';

/**
 * The mood table from the design doc. Talking alternates its mouth between the two
 * frames every 140 ms; every other mood is a single fixed face.
 */
export const MOOD_FACES: Record<AvatarMood, { eyes: Eyes; mouths: [Mouth] | [Mouth, Mouth] }> = {
  idle: { eyes: 'frame1', mouths: ['smile01'] },
  thinking: { eyes: 'eva', mouths: ['diagram'] },
  talking: { eyes: 'frame1', mouths: ['smile01', 'diagram'] },
  cracked: { eyes: 'bulging', mouths: ['diagram'] },
  held: { eyes: 'hearts', mouths: ['smile02'] },
};

export const TALKING_FRAME_MS = 140;

/**
 * bottts-neutral varies by seed only through its background color (19 DiceBear defaults);
 * the mood sets the eyes and mouth. See the D2 report for the design gap this leaves.
 */
const cache = new Map<string, string>();

/**
 * Renders a Warden face locally as an SVG data URI. Memoised per seed, mood and mouth
 * frame, so each combination is generated once.
 */
export function avatarDataUri(seed: string, mood: AvatarMood, frame = 0): string {
  const face = MOOD_FACES[mood];
  const mouth = face.mouths[frame % face.mouths.length] ?? face.mouths[0];
  const key = `${seed}|${face.eyes}|${mouth}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const uri = createAvatar(botttsNeutral, {
    seed,
    eyes: [face.eyes],
    mouth: [mouth],
  }).toDataUri();
  cache.set(key, uri);
  return uri;
}

export function avatarCacheSize(): number {
  return cache.size;
}
