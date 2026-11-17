/**
 * Vault door geometry from the design doc (400 by 400 view box). Shared by the
 * skeleton and empty state now, and by the full VaultDoor in phase D2.
 */
export const VAULT = {
  viewBox: 400,
  frame: { x: 8, y: 8, size: 384, radius: 32 },
  disc: { cx: 200, cy: 210, r: 150 },
  rivetRingRadius: 132,
  rivetCount: 12,
  porthole: { cx: 200, cy: 150, r: 48 },
  wheel: { cx: 200, cy: 290, r: 44, spokes: 6 },
  bolts: { width: 36, height: 14, x: 8, count: 3 },
} as const;

export function rivetPositions(): Array<{ x: number; y: number }> {
  const { cx, cy } = VAULT.disc;
  return Array.from({ length: VAULT.rivetCount }, (_, index) => {
    const angle = (index / VAULT.rivetCount) * Math.PI * 2;
    return { x: cx + Math.cos(angle) * VAULT.rivetRingRadius, y: cy + Math.sin(angle) * VAULT.rivetRingRadius };
  });
}

export function spokeEnds(): Array<{ x: number; y: number }> {
  const { cx, cy, r, spokes } = VAULT.wheel;
  return Array.from({ length: spokes }, (_, index) => {
    const angle = (index / spokes) * Math.PI * 2;
    return { x: cx + Math.cos(angle) * (r - 6), y: cy + Math.sin(angle) * (r - 6) };
  });
}

/** Three bolt rectangles on the left edge, evenly spaced down the frame. */
export function boltRects(): Array<{ x: number; y: number; width: number; height: number }> {
  const { width, height, x, count } = VAULT.bolts;
  const top = 110;
  const gap = 90;
  return Array.from({ length: count }, (_, index) => ({ x, y: top + index * gap, width, height }));
}
