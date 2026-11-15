import { describe, expect, it } from 'vitest';
import { CreateGuardInputSchema, GuardSchema, UpdateGuardInputSchema } from './schemas.js';

describe('guard schemas', () => {
  it('applies the Forge defaults and enforces the 20-character player order minimum', () => {
    const input = CreateGuardInputSchema.parse({
      name: 'Bolt',
      instructions: '12345678901234567890',
      fields: {},
      keyType: 'code',
    });

    expect(input.refusalStyle).toBe('polite');
    expect(input.talkativeness).toBe('normal');
    expect(input.revealKeyFormat).toBe(false);
    expect(input.fields).toEqual({
      stonewall: false,
      pokerFace: false,
      shortAnswers: false,
      languageLock: false,
    });
    expect(() => CreateGuardInputSchema.parse({ ...input, instructions: '1234567890123456789' })).toThrow();
  });

  it('accepts all documented Forge choices and permits an empty internal baseline guard', () => {
    const guard = GuardSchema.parse({
      id: 'a2da3846-48c9-48a7-8c07-3e6c57516800',
      name: 'Empty Warden',
      instructions: '',
      refusalStyle: 'cryptic',
      talkativeness: 'chatty',
      revealKeyFormat: true,
      fields: {},
      keyType: 'word',
      version: 1,
      createdAt: '2026-11-15T00:00:00.000Z',
      updatedAt: '2026-11-15T00:00:00.000Z',
    });

    expect(guard.refusalStyle).toBe('cryptic');
    expect(guard.talkativeness).toBe('chatty');
    expect(guard.revealKeyFormat).toBe(true);
  });

  it('validates optional updates to the new Forge fields', () => {
    expect(UpdateGuardInputSchema.parse({
      refusalStyle: 'playful',
      talkativeness: 'terse',
      revealKeyFormat: true,
    })).toEqual({
      refusalStyle: 'playful',
      talkativeness: 'terse',
      revealKeyFormat: true,
    });
  });
});
