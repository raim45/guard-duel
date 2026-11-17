import { VAULT, boltRects, rivetPositions, spokeEnds } from './geometry';

export interface VaultDoorStaticProps {
  size?: number;
  /** Swings the door plate open by 15 degrees to show the glowing interior. */
  ajar?: boolean;
  label?: string;
}

const INK = 'var(--color-ink)';
/** cos(15 degrees): the apparent width of a door plate swung 15 degrees on its left hinge. */
const AJAR_SCALE = 0.9659;

/**
 * A static, sealed or ajar vault door with an empty porthole. The animated door with the
 * Warden avatar and its four states is built in phase D2 on top of the same geometry.
 */
export function VaultDoorStatic({ size = 160, ajar = false, label = 'Vault door' }: VaultDoorStaticProps) {
  const { frame, disc, porthole, wheel } = VAULT;
  const spokes = spokeEnds();
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${VAULT.viewBox} ${VAULT.viewBox}`}
      role="img"
      aria-label={label}
      style={{ display: 'block' }}
    >
      <rect x={frame.x} y={frame.y} width={frame.size} height={frame.size} rx={frame.radius} fill="var(--color-plate-hi)" stroke={INK} strokeWidth={3} />
      {ajar && (
        <circle cx={disc.cx} cy={disc.cy} r={disc.r} fill="var(--color-brass)" fillOpacity={0.55} stroke={INK} strokeWidth={3} />
      )}
      <g style={{ transformBox: 'fill-box', transformOrigin: 'left center', transform: ajar ? `scaleX(${AJAR_SCALE})` : undefined }}>
        <circle cx={disc.cx} cy={disc.cy} r={disc.r} fill="var(--color-plate)" stroke={INK} strokeWidth={3} />
        {rivetPositions().map((rivet, index) => (
          <circle key={index} cx={rivet.x} cy={rivet.y} r={4} fill={INK} />
        ))}
        <circle cx={porthole.cx} cy={porthole.cy} r={porthole.r} fill="var(--color-world-deep)" stroke="var(--color-brass)" strokeWidth={6} />
        <circle cx={porthole.cx} cy={porthole.cy} r={porthole.r + 3} fill="none" stroke={INK} strokeWidth={3} />
        <circle cx={wheel.cx} cy={wheel.cy} r={wheel.r} fill="var(--color-brass)" stroke={INK} strokeWidth={3} />
        {spokes.map((end, index) => (
          <line key={index} x1={wheel.cx} y1={wheel.cy} x2={end.x} y2={end.y} stroke={INK} strokeWidth={5} strokeLinecap="round" />
        ))}
        <circle cx={wheel.cx} cy={wheel.cy} r={8} fill={INK} />
      </g>
      {boltRects().map((bolt, index) => (
        <rect key={index} x={bolt.x} y={bolt.y} width={bolt.width} height={bolt.height} rx={3} fill="var(--color-brass)" stroke={INK} strokeWidth={3} />
      ))}
      <path d="M186 84 h28 v14 q0 10 -14 16 q-14 -6 -14 -16 z" fill="var(--color-brass)" stroke={INK} strokeWidth={3} strokeLinejoin="round" transform="translate(0 -26)" />
    </svg>
  );
}
