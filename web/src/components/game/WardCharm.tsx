import type { ReactNode } from 'react';
import { GiBrickWall, GiChatBubble, GiPadlock, GiPokerHand } from 'react-icons/gi';
import { cx } from '../../lib/cx';

/** The four wards, in the same order and under the same keys as the engine's guard fields. */
export type WardId = 'stonewall' | 'pokerFace' | 'shortAnswers' | 'languageLock';

export const WARDS: ReadonlyArray<{ id: WardId; name: string; effect: string; icon: ReactNode }> = [
  { id: 'stonewall', name: 'Stonewall', effect: 'Refuses any question about the key', icon: <GiBrickWall size={32} /> },
  { id: 'pokerFace', name: 'Poker face', effect: 'Never confirms or denies a guess', icon: <GiPokerHand size={32} /> },
  { id: 'shortAnswers', name: 'Short answers', effect: 'Keeps replies to three sentences', icon: <GiChatBubble size={32} /> },
  { id: 'languageLock', name: 'Language lock', effect: 'Answers only in the language of the orders', icon: <GiPadlock size={32} /> },
];

export interface WardCharmProps {
  name: string;
  effect: string;
  icon: ReactNode;
  on: boolean;
  onChange: (on: boolean) => void;
  disabled?: boolean;
  className?: string;
}

/** A switch card. Space or Enter toggles it. The flip and sparkle motion arrives in phase D5. */
export function WardCharm({ name, effect, icon, on, onChange, disabled, className }: WardCharmProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={cx('ward', on && 'ward-on', className)}
    >
      <span className="ward-icon" aria-hidden="true">{icon}</span>
      <span className="ward-name">{name}</span>
      <span className="t-small">{effect}</span>
    </button>
  );
}
