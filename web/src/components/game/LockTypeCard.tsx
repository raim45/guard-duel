import type { ReactNode } from 'react';
import { Check } from 'lucide-react';
import { GiCalculator, GiCombinationLock, GiScrollUnfurled } from 'react-icons/gi';
import { cx } from '../../lib/cx';
import type { LockType } from '../ui';

/** Samples are decoration only. They are never real keys. */
export const LOCK_TYPES: ReadonlyArray<{ value: LockType; name: string; hint: string; sample: string; icon: ReactNode }> = [
  { value: 'combo', name: 'Combo', hint: 'Hard to guess. It can only leak.', sample: 'VX7K-92QM', icon: <GiCombinationLock size={32} /> },
  { value: 'passphrase', name: 'Passphrase', hint: 'Easier to say, easier to guess.', sample: 'lantern', icon: <GiScrollUnfurled size={32} /> },
  { value: 'pin', name: 'PIN', hint: 'Short and sneaky.', sample: '4081', icon: <GiCalculator size={32} /> },
];

export interface LockTypeGroupProps {
  value: LockType;
  onChange: (value: LockType) => void;
  /** Shared name for the radio inputs. */
  name?: string;
  className?: string;
}

/**
 * Three cards in a radio group. Real radio inputs give arrow-key movement and the correct
 * semantics; the cards are their labels.
 */
export function LockTypeGroup({ value, onChange, name = 'lock-type', className }: LockTypeGroupProps) {
  return (
    <fieldset className={cx('grid gap-4 border-0 p-0 md:grid-cols-3', className)}>
      <legend className="sr-only">Lock type</legend>
      {LOCK_TYPES.map((lock) => {
        const selected = lock.value === value;
        return (
          <label key={lock.value} className={cx('lock-card', selected && 'lock-card-on')}>
            <input
              type="radio"
              name={name}
              value={lock.value}
              checked={selected}
              onChange={() => onChange(lock.value)}
              className="sr-only"
            />
            <span className="flex items-start justify-between">
              <span aria-hidden="true">{lock.icon}</span>
              {selected && (
                <span className="lock-check" aria-hidden="true"><Check size={18} strokeWidth={4} /></span>
              )}
            </span>
            <span className="t-h3 mt-2 block">{lock.name}</span>
            <span className="t-small block">{lock.hint}</span>
            <span className="lock-ticket" aria-hidden="true">{lock.sample}</span>
          </label>
        );
      })}
    </fieldset>
  );
}
