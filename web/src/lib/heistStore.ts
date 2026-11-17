import type { Limits, LockTypeValue } from '../api';

/**
 * What the Heist screen needs to resume after a reload. It holds no secret and no orders:
 * only the session id and the public Warden details the player already saw.
 */
export interface StoredHeist {
  sessionId: string;
  guardId: string;
  guardName: string;
  lookSeed: string;
  lockType: LockTypeValue;
  keyFormatHint: string | null;
  limits: Limits;
  startedAt: string;
}

const KEY = 'guard-duel:heists';

function readAll(): Record<string, StoredHeist> {
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Record<string, StoredHeist>) : {};
  } catch {
    return {};
  }
}

function writeAll(value: Record<string, StoredHeist>): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(value));
  } catch {
    // Storage can be blocked; resuming a heist after a reload then is not possible.
  }
}

export function saveHeist(heist: StoredHeist): void {
  writeAll({ ...readAll(), [heist.sessionId]: heist });
}

export function loadHeist(sessionId: string): StoredHeist | null {
  return readAll()[sessionId] ?? null;
}

export function findHeistForGuard(guardId: string): StoredHeist | null {
  return Object.values(readAll()).find((heist) => heist.guardId === guardId) ?? null;
}

export function forgetHeist(sessionId: string): void {
  const all = readAll();
  delete all[sessionId];
  writeAll(all);
}
