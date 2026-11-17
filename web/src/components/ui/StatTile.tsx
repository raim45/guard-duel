import type { ReactNode } from 'react';
import { cx } from '../../lib/cx';

export function StatTile({ value, label, className }: { value: ReactNode; label: string; className?: string }) {
  return (
    <div className={cx('stat-tile', className)}>
      <p className="stat-tile-value">{value}</p>
      <p className="t-small text-chalk-dim">{label}</p>
    </div>
  );
}
