import { useEffect, useState } from 'react';
import { TALKING_FRAME_MS, avatarDataUri } from './avatar';
import type { AvatarMood } from './avatar';
import { cx } from '../../lib/cx';

export type AvatarSize = 32 | 48 | 96 | 192;

export interface WardenAvatarProps {
  /** The guard id. It picks the avatar's color. */
  seed: string;
  mood?: AvatarMood;
  size?: AvatarSize;
  /** Crew members use a sky ring instead of brass. */
  crew?: boolean;
  /** Accessible name, for example "Bolt, the Warden". */
  label: string;
  className?: string;
}

/** Brass ring thickness: 6 px from 96 px up, thinner on the small sizes so a face still fits. */
function ringWidth(size: AvatarSize): number {
  if (size >= 96) return 6;
  if (size >= 48) return 4;
  return 3;
}

/** Alternates the talking mouth between its two frames every 140 ms. */
export function useTalkingFrame(active: boolean): number {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    if (!active) {
      setFrame(0);
      return;
    }
    const timer = window.setInterval(() => setFrame((value) => value + 1), TALKING_FRAME_MS);
    return () => window.clearInterval(timer);
  }, [active]);
  return frame;
}

/**
 * A round porthole with a 3 px ink outline and a brass ring holding the Warden's face.
 * The mood follows the request state only, never the outcome of a heist in progress.
 */
export function WardenAvatar({ seed, mood = 'idle', size = 96, crew = false, label, className }: WardenAvatarProps) {
  const frame = useTalkingFrame(mood === 'talking');
  const ring = ringWidth(size);
  return (
    <span
      className={cx('inline-block flex-none rounded-full border-[3px] border-ink', className)}
      style={{ width: size, height: size, padding: ring, background: crew ? 'var(--color-sky)' : 'var(--color-brass)' }}
    >
      <img
        src={avatarDataUri(seed, mood, frame)}
        alt={label}
        width={size - 6 - ring * 2}
        height={size - 6 - ring * 2}
        className="block rounded-full border-2 border-ink"
        style={{ width: '100%', height: '100%' }}
        draggable={false}
      />
    </span>
  );
}
