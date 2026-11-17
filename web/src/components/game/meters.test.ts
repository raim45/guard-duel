import { describe, expect, it } from 'vitest';
import { formatPatrol, patrolTone } from './Meters';

describe('patrol timer', () => {
  it('formats seconds as mm:ss', () => {
    expect(formatPatrol(600)).toBe('10:00');
    expect(formatPatrol(522)).toBe('08:42');
    expect(formatPatrol(5)).toBe('00:05');
    expect(formatPatrol(-3)).toBe('00:00');
  });

  it('turns brass under 60 seconds and an alarm under 30', () => {
    expect(patrolTone(60)).toBe('calm');
    expect(patrolTone(59)).toBe('warning');
    expect(patrolTone(30)).toBe('warning');
    expect(patrolTone(29)).toBe('alarm');
    expect(patrolTone(0)).toBe('alarm');
  });
});
