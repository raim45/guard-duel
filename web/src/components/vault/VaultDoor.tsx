import { useId } from 'react';
import { avatarDataUri } from '../game/avatar';
import type { AvatarMood } from '../game/avatar';
import { VAULT, boltRects, rivetPositions, spokeEnds } from './geometry';

export type VaultState = 'sealed' | 'ajar' | 'opening' | 'open' | 'bolted';

export interface VaultDoorProps {
  /** Rendered width and height in px. Design sizes: 280 heist (140 mobile), 160 Board, 200 Forge. */
  size?: number;
  state?: VaultState;
  /** The guard id. Without it the porthole is empty. */
  seed?: string;
  /** Overrides the mood the state would pick. Moods follow state, never who is winning. */
  mood?: AvatarMood;
  /** Times this vault was cracked. Drawn as chalk scratch marks in groups of five. */
  dents?: number;
  label?: string;
}

const INK = 'var(--color-ink)';
const HINGE = '50px 210px';
const MAX_TALLY_GROUPS = 6;

/**
 * Static pose for each state. Each part is its own group with a set transform origin, so
 * phase D5 can animate the parts separately and land on these same poses.
 */
const POSES: Record<VaultState, { door: string; wheel: number; boltDx: number; interior: number; keyDy: number; mood: AvatarMood }> = {
  sealed: { door: 'none', wheel: 0, boltDx: 0, interior: 0, keyDy: 24, mood: 'idle' },
  ajar: { door: 'scaleX(0.9659)', wheel: 0, boltDx: 0, interior: 0.55, keyDy: 24, mood: 'idle' },
  opening: { door: 'scaleX(0.6) skewY(-3deg)', wheel: 270, boltDx: -8, interior: 0.8, keyDy: 12, mood: 'cracked' },
  open: { door: 'scaleX(0.18) skewY(-6deg)', wheel: 540, boltDx: -8, interior: 1, keyDy: 0, mood: 'cracked' },
  bolted: { door: 'none', wheel: 0, boltDx: 14, interior: 0, keyDy: 24, mood: 'held' },
};

function Tally({ dents }: { dents: number }) {
  const capped = Math.min(dents, MAX_TALLY_GROUPS * 5);
  const groups = Math.ceil(capped / 5);
  return (
    <g stroke="rgba(234, 244, 246, 0.85)" strokeWidth={3} strokeLinecap="round" fill="none">
      {Array.from({ length: groups }, (_, group) => {
        const marks = Math.min(5, capped - group * 5);
        const top = 62 + group * 46;
        return (
          <g key={group}>
            {Array.from({ length: Math.min(4, marks) }, (_, mark) => (
              <line key={mark} x1={362 + mark * 6} y1={top} x2={362 + mark * 6} y2={top + 26} />
            ))}
            {marks === 5 && <line x1={359} y1={top + 22} x2={385} y2={top + 4} />}
          </g>
        );
      })}
    </g>
  );
}

export function VaultDoor({ size = 160, state = 'sealed', seed, mood, dents = 0, label = 'Vault door' }: VaultDoorProps) {
  const clipId = useId();
  const { frame, disc, porthole, wheel } = VAULT;
  const pose = POSES[state];
  const spokes = spokeEnds();
  const face = seed ? avatarDataUri(seed, mood ?? pose.mood) : null;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${VAULT.viewBox} ${VAULT.viewBox}`}
      role="img"
      aria-label={`${label}, ${state}`}
      data-state={state}
      style={{ display: 'block' }}
    >
      <defs>
        <clipPath id={`${clipId}-disc`}><circle cx={disc.cx} cy={disc.cy} r={disc.r} /></clipPath>
        <clipPath id={`${clipId}-face`}><circle cx={porthole.cx} cy={porthole.cy} r={porthole.r - 3} /></clipPath>
      </defs>

      <g data-part="frame">
        <rect x={frame.x} y={frame.y} width={frame.size} height={frame.size} rx={frame.radius} fill="var(--color-plate-hi)" stroke={INK} strokeWidth={3} />
      </g>

      <g data-part="tally">{dents > 0 && <Tally dents={dents} />}</g>

      <g data-part="interior" style={{ transformOrigin: `${disc.cx}px ${disc.cy}px` }}>
        <circle cx={disc.cx} cy={disc.cy} r={disc.r} fill="var(--color-world-deep)" stroke={INK} strokeWidth={3} />
        <circle cx={disc.cx} cy={disc.cy} r={disc.r} fill="var(--color-brass)" fillOpacity={pose.interior} />
        <g clipPath={`url(#${clipId}-disc)`}>
          <g data-part="key" style={{ transform: `translateY(${pose.keyDy}px)`, opacity: pose.interior > 0 ? 1 : 0 }}>
            <circle cx={200} cy={300} r={15} fill="var(--color-brass)" stroke={INK} strokeWidth={3} />
            <circle cx={200} cy={300} r={5} fill="var(--color-world-deep)" />
            <rect x={196} y={314} width={8} height={36} fill="var(--color-brass)" stroke={INK} strokeWidth={3} />
            <rect x={204} y={334} width={10} height={6} fill="var(--color-brass)" stroke={INK} strokeWidth={3} />
            <rect x={204} y={344} width={8} height={6} fill="var(--color-brass)" stroke={INK} strokeWidth={3} />
          </g>
        </g>
      </g>

      <g data-part="door" style={{ transformOrigin: HINGE, transform: pose.door }}>
        <circle cx={disc.cx} cy={disc.cy} r={disc.r} fill="var(--color-plate)" stroke={INK} strokeWidth={3} />
        {rivetPositions().map((rivet, index) => (
          <circle key={index} cx={rivet.x} cy={rivet.y} r={4} fill={INK} />
        ))}
        <g data-part="porthole">
          <circle cx={porthole.cx} cy={porthole.cy} r={porthole.r} fill="var(--color-world-deep)" />
          {face && (
            <image
              href={face}
              x={porthole.cx - porthole.r}
              y={porthole.cy - porthole.r}
              width={porthole.r * 2}
              height={porthole.r * 2}
              clipPath={`url(#${clipId}-face)`}
            />
          )}
          <circle cx={porthole.cx} cy={porthole.cy} r={porthole.r} fill="none" stroke="var(--color-brass)" strokeWidth={6} />
          <circle cx={porthole.cx} cy={porthole.cy} r={porthole.r + 3} fill="none" stroke={INK} strokeWidth={3} />
        </g>
        <g data-part="keyhole">
          <path d="M186 58 h28 v14 q0 10 -14 16 q-14 -6 -14 -16 z" fill="var(--color-brass)" stroke={INK} strokeWidth={3} strokeLinejoin="round" />
          <circle cx={200} cy={68} r={3.5} fill={INK} />
        </g>
        <g data-part="wheel" style={{ transformOrigin: `${wheel.cx}px ${wheel.cy}px`, transform: `rotate(${pose.wheel}deg)` }}>
          <circle cx={wheel.cx} cy={wheel.cy} r={wheel.r} fill="var(--color-brass)" stroke={INK} strokeWidth={3} />
          {spokes.map((end, index) => (
            <line key={index} x1={wheel.cx} y1={wheel.cy} x2={end.x} y2={end.y} stroke={INK} strokeWidth={5} strokeLinecap="round" />
          ))}
          <circle cx={wheel.cx} cy={wheel.cy} r={8} fill={INK} />
        </g>
      </g>

      <g data-part="bolts" style={{ transform: `translateX(${pose.boltDx}px)` }}>
        {boltRects().map((bolt, index) => (
          <rect key={index} x={bolt.x} y={bolt.y} width={bolt.width} height={bolt.height} rx={3} fill="var(--color-brass)" stroke={INK} strokeWidth={3} />
        ))}
      </g>
    </svg>
  );
}
