import type { ReactNode } from 'react';
import { GiCalculator, GiCombinationLock, GiScrollUnfurled } from 'react-icons/gi';
import { cx } from '../../lib/cx';

export type LockType = 'combo' | 'passphrase' | 'pin';

const lockTypes: Record<LockType, { name: string; icon: ReactNode }> = {
  combo: { name: 'Combo', icon: <GiCombinationLock size={16} aria-hidden="true" /> },
  passphrase: { name: 'Passphrase', icon: <GiScrollUnfurled size={16} aria-hidden="true" /> },
  pin: { name: 'PIN', icon: <GiCalculator size={16} aria-hidden="true" /> },
};

export function LockChip({ lockType, className }: { lockType: LockType; className?: string }) {
  const lock = lockTypes[lockType];
  return (
    <span className={cx('chip chip-lock', className)}>
      {lock.icon}
      {lock.name}
    </span>
  );
}

export type ChipVariant = 'draft' | 'board' | 'stat';

export function Chip({ variant = 'stat', children, className }: { variant?: ChipVariant; children: ReactNode; className?: string }) {
  return <span className={cx('chip', `chip-${variant}`, className)}>{children}</span>;
}

/** Status chip helpers keep the two published-state labels fixed. */
export function StatusChip({ published }: { published: boolean }) {
  return published ? <Chip variant="board">On the Board</Chip> : <Chip variant="draft">Draft</Chip>;
}
