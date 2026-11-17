import { useMemo } from 'react';
import { GiSiren } from 'react-icons/gi';
import { cx } from '../../lib/cx';

const PICK_ROW_LIMIT = 12;

/**
 * One hooked lockpick. Game Icons only has a bundle of picks in a single glyph, which reads
 * as a blur at 28 px, so the pick is drawn here as a plain SVG path.
 */
function Lockpick({ spent }: { spent: boolean }) {
  return (
    <svg width={20} height={28} viewBox="0 0 20 28" className={cx('pick', spent ? 'pick-spent' : 'pick-ready')} data-spent={spent || undefined}>
      <path d="M6 19 a3 3 0 0 1 3 -3 V4 C9 2 11 1 13.5 1 H16 V4 H13.8 C12.6 4 12 4.5 12 5.5 V16 a3 3 0 0 1 3 3 V24 a3 3 0 0 1 -3 3 H9 a3 3 0 0 1 -3 -3 Z" strokeLinejoin="round" />
    </svg>
  );
}

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}

/* ---------- Picks meter ---------- */

export interface PicksMeterProps {
  total: number;
  used: number;
  className?: string;
}

/**
 * A row of lockpicks: brass while available, an outline tipped over once spent. Above 12
 * picks it becomes a 16 px bar with "8 of 12 picks". Changes are announced politely.
 */
export function PicksMeter({ total, used, className }: PicksMeterProps) {
  const left = Math.max(0, total - used);
  return (
    <div className={cx('inline-flex flex-col gap-1', className)}>
      {total > PICK_ROW_LIMIT ? (
        <div>
          <div className="picks-bar" aria-hidden="true">
            <div className="picks-bar-fill" style={{ width: `${(left / total) * 100}%` }} />
          </div>
          <p className="t-small mt-1 font-bold" aria-hidden="true">{left} of {total} picks</p>
        </div>
      ) : (
        <div className="flex flex-wrap gap-1" aria-hidden="true">
          {Array.from({ length: total }, (_, index) => {
            const spent = index >= left;
            return (
              <Lockpick key={index} spent={spent} />
            );
          })}
        </div>
      )}
      <span className="sr-only" aria-live="polite">{plural(left, 'pick')} left</span>
    </div>
  );
}

/* ---------- Patrol timer ---------- */

export function formatPatrol(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export type PatrolTone = 'calm' | 'warning' | 'alarm';

/** Under 60 s the time turns brass; under 30 s it becomes a coral pill and the lamp pulses. */
export function patrolTone(seconds: number): PatrolTone {
  if (seconds < 30) return 'alarm';
  if (seconds < 60) return 'warning';
  return 'calm';
}

function patrolSpoken(seconds: number): string {
  if (seconds < 30) return 'Under 30 seconds left';
  if (seconds < 60) return 'Under a minute left';
  return `${plural(Math.ceil(seconds / 60), 'minute')} left`;
}

export function PatrolTimer({ seconds, className }: { seconds: number; className?: string }) {
  const tone = patrolTone(seconds);
  // Announce only when the spoken value changes, not every second.
  const spoken = useMemo(() => patrolSpoken(seconds), [seconds]);
  return (
    <div className={cx('patrol', `patrol-${tone}`, className)}>
      <GiSiren size={26} aria-hidden="true" className={cx(tone === 'alarm' && 'lamp-pulse')} />
      <span className="patrol-time" role="timer" aria-label="Patrol time left">{formatPatrol(seconds)}</span>
      <span className="sr-only" aria-live="polite">{spoken}</span>
    </div>
  );
}

/* ---------- Attempts pips ---------- */

export interface AttemptsPipsProps {
  /** Wrong guesses allowed. */
  total: number;
  /** Wrong guesses already used. */
  used: number;
  className?: string;
}

export function AttemptsPips({ total, used, className }: AttemptsPipsProps) {
  const left = Math.max(0, total - used);
  return (
    <div className={cx('inline-flex items-center gap-2', className)}>
      <div className="flex gap-2" aria-hidden="true">
        {Array.from({ length: total }, (_, index) => {
          const spent = index >= left;
          return (
            <svg key={index} width={18} height={18} viewBox="0 0 18 18" className="pip" data-spent={spent || undefined}>
              <circle cx={9} cy={9} r={7.5} className="pip-disc" />
              {spent && <path d="M9 2.5 L7.5 7 L10.5 9 L8 11.5 L9.5 15.5" className="pip-crack" />}
            </svg>
          );
        })}
      </div>
      <span className="sr-only" aria-live="polite">{plural(left, 'attempt')} left</span>
    </div>
  );
}
