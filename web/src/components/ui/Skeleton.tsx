import { VAULT } from '../vault/geometry';

/** Loading placeholder: the vault door outline in plate, pulsing between 0.5 and 0.8 opacity. */
export function Skeleton({ size = 160, label = 'Loading' }: { size?: number; label?: string }) {
  const { frame, disc } = VAULT;
  return (
    <div role="status" aria-label={label} className="skeleton inline-block" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${VAULT.viewBox} ${VAULT.viewBox}`} aria-hidden="true" style={{ display: 'block' }}>
        <rect x={frame.x} y={frame.y} width={frame.size} height={frame.size} rx={frame.radius} fill="none" stroke="var(--color-plate)" strokeWidth={10} />
        <circle cx={disc.cx} cy={disc.cy} r={disc.r} fill="none" stroke="var(--color-plate)" strokeWidth={10} />
        <circle cx={VAULT.porthole.cx} cy={VAULT.porthole.cy} r={VAULT.porthole.r} fill="none" stroke="var(--color-plate)" strokeWidth={10} />
        <circle cx={VAULT.wheel.cx} cy={VAULT.wheel.cy} r={VAULT.wheel.r} fill="none" stroke="var(--color-plate)" strokeWidth={10} />
      </svg>
    </div>
  );
}
