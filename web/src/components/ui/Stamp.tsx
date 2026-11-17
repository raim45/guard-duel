import { cx } from '../../lib/cx';

export type StampKind = 'cracked' | 'held' | 'posted' | 'draft';

const labels: Record<StampKind, string> = {
  cracked: 'Cracked',
  held: 'Held',
  posted: 'Posted',
  draft: 'Draft',
};

/** A physical stamp: the only place the interface sets text in capitals. */
export function Stamp({ kind, className }: { kind: StampKind; className?: string }) {
  return (
    <span className={cx('stamp', `stamp-${kind}`, className)}>
      <span className="stamp-inner t-stamp">{labels[kind]}</span>
    </span>
  );
}
