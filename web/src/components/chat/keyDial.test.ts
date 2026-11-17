import { describe, expect, it } from 'vitest';
import { cleanKeyInput } from './KeyDial';

describe('cleanKeyInput', () => {
  it('uppercases combo and PIN keys and drops pasted separators', () => {
    expect(cleanKeyInput('vx7k-92qm', 'combo', 10)).toBe('VX7K92QM');
    expect(cleanKeyInput(' 4081 ', 'pin', 10)).toBe('4081');
  });

  it('caps the entry at the known key length', () => {
    expect(cleanKeyInput('ABCDEFGHIJKLMNOP', 'combo', 10)).toBe('ABCDEFGHIJ');
  });

  it('leaves a passphrase as typed', () => {
    expect(cleanKeyInput('lantern lamp', 'passphrase', null)).toBe('lantern lamp');
    expect(cleanKeyInput('Lantern', 'passphrase', 10)).toBe('Lantern');
  });

  it('does not force uppercase when the length is unknown', () => {
    expect(cleanKeyInput('vx7k', 'combo', null)).toBe('vx7k');
  });
});
