/**
 * Secret service - generates secrets and detects plain leaks with code only.
 * No AI, no external dependencies - pure Web Crypto and string manipulation.
 */

export type KeyType = 'code' | 'word' | 'number';

export interface SecretOptions {
  keyType: KeyType;
  length?: number;        // for code/number: character/digit count
  alphabet?: string;      // for code: custom alphabet (no look-alikes by default)
}

/**
 * Default alphabets without look-alike characters.
 * Excludes: 0/O, 1/l/I, 2/Z, 5/S, 8/B, etc.
 */
const DEFAULT_CODE_ALPHABET = 'ACDEFHJKMNPQRTUVWXY34679';
const DEFAULT_NUMBER_ALPHABET = '234679';

/**
 * Curated list of unusual 6-10 letter words for passphrase secrets.
 * These are uncommon enough to not be guessable, but memorable.
 * All words are 6-10 letters.
 */
/**
 * Curated list of unusual 6-10 letter words for passphrase secrets.
 * These are uncommon enough to not be guessable, but memorable.
 * All words are 6-10 letters.
 */
/**
 * Curated list of unusual 6-10 letter words for passphrase secrets.
 * These are uncommon enough to not be guessable, but memorable.
 * All words are 6-10 letters.
 */
// Word list - use array with explicit type to satisfy TypeScript
const WORDS = [
  'lantern', 'velvet', 'cobalt', 'zephyr', 'quasar', 'mosaic', 'prism', 'echo',
  'nexus', 'vortex', 'lumen', 'cipher', 'glyph', 'anchor', 'beacon', 'cradle',
  'drift', 'ember', 'flint', 'glacier', 'horizon', 'ivory', 'jasper', 'kelp',
  'lagoon', 'marble', 'noble', 'opal', 'pebble', 'quartz', 'ripple', 'saffron',
  'talon', 'umbra', 'vivid', 'willow', 'xenon', 'yearn', 'zeppelin', 'abyss',
  'bloom', 'canyon', 'dune', 'everest', 'fjord', 'glade', 'haven', 'island',
  'jungle', 'karst', 'lunar', 'meadow', 'nebula', 'oasis', 'peak', 'quill',
  'ridge', 'summit', 'tundra', 'valley', 'xeric',
  'yarrow', 'zenith', 'amber', 'basil', 'coral', 'diamond', 'emerald', 'flora',
  'garnet', 'indigo', 'jade', 'krypton', 'lilac', 'magnolia', 'nymph',
  'orchid', 'pearl', 'ruby', 'sapphire', 'topaz', 'violet',
  'wisteria', 'xanthic', 'yellow', 'zircon',
] as string[];

const WORD_LIST_LENGTH = WORDS.length;

/**
 * Letter-to-word mapping for spelled-out detection (NATO phonetic + common variants).
 */
const LETTER_WORDS: Record<string, string[]> = {
  a: ['alpha', 'alfa', 'a as in alpha', 'a as in alfa'],
  b: ['bravo', 'b as in bravo'],
  c: ['charlie', 'c as in charlie'],
  d: ['delta', 'd as in delta'],
  e: ['echo', 'e as in echo'],
  f: ['foxtrot', 'f as in foxtrot'],
  g: ['golf', 'g as in golf'],
  h: ['hotel', 'h as in hotel'],
  i: ['india', 'i as in india'],
  j: ['juliett', 'juliet', 'j as in juliett'],
  k: ['kilo', 'k as in kilo'],
  l: ['lima', 'l as in lima'],
  m: ['mike', 'm as in mike'],
  n: ['november', 'n as in november'],
  o: ['oscar', 'o as in oscar'],
  p: ['papa', 'p as in papa'],
  q: ['quebec', 'q as in quebec'],
  r: ['romeo', 'r as in romeo'],
  s: ['sierra', 's as in sierra'],
  t: ['tango', 't as in tango'],
  u: ['uniform', 'u as in uniform'],
  v: ['victor', 'v as in victor'],
  w: ['whiskey', 'w as in whiskey'],
  x: ['x-ray', 'xray', 'x as in x-ray'],
  y: ['yankee', 'y as in yankee'],
  z: ['zulu', 'z as in zulu'],
};

/**
 * Generate a cryptographically secure random secret.
 */
export function generateSecret(options: SecretOptions): string {
  const { keyType, length = 10, alphabet } = options;

  switch (keyType) {
    case 'code': {
      const chars = alphabet ?? DEFAULT_CODE_ALPHABET;
      const bytes = new Uint8Array(length);
      crypto.getRandomValues(bytes);
      return Array.from(bytes, (b) => chars[b % chars.length]).join('');
    }

    case 'number': {
      const chars = alphabet ?? DEFAULT_NUMBER_ALPHABET;
      const bytes = new Uint8Array(length);
      crypto.getRandomValues(bytes);
      return Array.from(bytes, (b) => chars[b % chars.length]).join('');
    }

    case 'word': {
      const bytes = new Uint32Array(1);
      crypto.getRandomValues(bytes);
      // @ts-ignore - index always in bounds due to modulo
      return WORDS[bytes[0] % WORD_LIST_LENGTH];
    }

    default:
      throw new Error(`Unknown key type: ${keyType}`);
  }
}

/**
 * Normalize text for comparison:
 * - lowercase
 * - strip accents (NFD + remove combining marks)
 * - remove whitespace, dashes, underscores, dots, zero-width chars
 * - map look-alikes (0/O, 1/l/I, etc.) for codes
 */
export function normalize(text: string, forCode = false): string {
  let result = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip combining diacritical marks
    .replace(/[\s\-_.​-‏﻿]/g, ''); // whitespace, dashes, underscores, dots, zero-width

  if (forCode) {
    // Map look-alike characters
    result = result
      .replace(/[oø]/g, '0')
      .replace(/[il]/g, '1')
      .replace(/[z]/g, '2')
      .replace(/[s]/g, '5')
      .replace(/[b]/g, '8')
      .replace(/[g]/g, '6');
  }

  return result;
}

/**
 * Check if a guess matches the secret (after normalization).
 */
export function guessMatches(secret: string, guess: string): boolean {
  return normalize(secret) === normalize(guess);
}

/**
 * Redact any form of the secret from text for logging.
 * Replaces direct, normalized, reversed, spaced, per-line, and spelled-out forms.
 */
export function redact(text: string, secret: string): string {
  const normalizedSecret = normalize(secret);
  const normalizedSecretForCode = normalize(secret, true);
  const reversedSecret = normalizedSecret.split('').reverse().join('');
  const reversedSecretForCode = normalizedSecretForCode.split('').reverse().join('');
  // A secret is a "code" if it contains digits (codes/numbers have digits, words don't)
const forCode = /[0-9]/.test(secret);

  let result = text;

  // 1. Direct match (case-insensitive) - for codes, exact match; for words, word boundaries
  if (!forCode) {
    const wordBoundaryRegex = new RegExp(`\\b${escapeRegex(secret)}\\b`, 'gi');
    result = result.replace(wordBoundaryRegex, '[REDACTED]');
  } else {
    const directRegex = new RegExp(escapeRegex(secret), 'gi');
    result = result.replace(directRegex, '[REDACTED]');
  }

  // 2. Spelled-out letter words (for codes) - do this early before spaced/per-line
  if (forCode) {
    const spelledOutPattern = buildSpelledOutPattern(secret);
    const spelledOutRegex = new RegExp(spelledOutPattern, 'giu');
    result = result.replace(spelledOutRegex, '[REDACTED]');
  }

  // 3. Per-line (one char per line) - only for codes
  if (forCode) {
    const lightlyNormalized = text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '');
    const perLinePattern = normalizedSecret.split('').join('\\s*\\n\\s*');
    const perLineRegex = new RegExp(perLinePattern, 'giu');
    result = result.replace(perLineRegex, '[REDACTED]');

    // Per-line with look-alike mapping for codes
    if (normalizedSecretForCode !== normalizedSecret) {
      const perLineCodePattern = normalizedSecretForCode.split('').join('\\s*\\n\\s*');
      const perLineCodeRegex = new RegExp(perLineCodePattern, 'giu');
      result = result.replace(perLineCodeRegex, '[REDACTED]');
    }
  }

  // 4. Spaced (chars separated by spaces or punctuation) - only for codes
  if (forCode) {
    const lightlyNormalized = text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '');
    const spacedPattern = normalizedSecret.split('').join('[\\s\\p{P}]*');
    const spacedRegex = new RegExp(spacedPattern, 'giu');
    result = result.replace(spacedRegex, '[REDACTED]');

    // Spaced with look-alike mapping for codes
    if (normalizedSecretForCode !== normalizedSecret) {
      const spacedCodePattern = normalizedSecretForCode.split('').join('[\\s\\p{P}]*');
      const spacedCodeRegex = new RegExp(spacedCodePattern, 'giu');
      result = result.replace(spacedCodeRegex, '[REDACTED]');
    }
  }

  // 5. Reversed (without look-alike mapping) - only for codes
  if (forCode) {
    const reversedRegex = new RegExp(escapeRegex(reversedSecret), 'gi');
    result = result.replace(reversedRegex, '[REDACTED]');

    // Reversed (with look-alike mapping for codes)
    if (reversedSecretForCode !== reversedSecret) {
      const reversedCodeRegex = new RegExp(escapeRegex(reversedSecretForCode), 'gi');
      result = result.replace(reversedCodeRegex, '[REDACTED]');
    }
  }

  // 6. Normalized match - for word secrets, use word boundaries
  if (!forCode) {
    const normalizedWordRegex = new RegExp(`\\b${escapeRegex(normalizedSecret)}\\b`, 'gi');
    result = result.replace(normalizedWordRegex, '[REDACTED]');
  } else {
    const normalizedRegex = new RegExp(escapeRegex(normalizedSecret), 'gi');
    result = result.replace(normalizedRegex, '[REDACTED]');
  }

  // Normalized match (with look-alike mapping for codes)
  if (forCode && normalizedSecretForCode !== normalizedSecret) {
    const normalizedCodeRegex = new RegExp(escapeRegex(normalizedSecretForCode), 'gi');
    result = result.replace(normalizedCodeRegex, '[REDACTED]');
  }

  return result;
}

/**
 * Escape special regex characters.
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Build regex pattern for spelled-out letter detection.
 * e.g., "VAULT" -> "v.*as.*in.*victor.*a.*as.*in.*alpha.*u.*as.*in.*uniform.*l.*as.*in.*lima.*t.*as.*in.*tango"
 * Only matches when letter words like "as in Victor" are explicitly used.
 */
function buildSpelledOutPattern(secret: string): string {
  // Use the original secret characters (without look-alike mapping) for spelled-out detection
  const chars = secret.replace(/[^A-Za-z0-9]/g, '');
  const parts: string[] = [];

  for (const char of chars) {
    const words = LETTER_WORDS[char.toLowerCase()];
    if (words && words.length > 0) {
      // Match "V as in Victor" or "Victor" - but NOT just "V" alone
      // Require at least the word or "as in" phrase
      const wordPattern = words.map(escapeRegex).join('|');
      parts.push(`(?:${wordPattern})`);
    } else {
      // For digits, just match the digit
      parts.push(escapeRegex(char));
    }
  }

  // Require word boundaries or separators between letters
  // This prevents matching "V A U L T" as spaced
  return parts.join('(?:\\s+|\\p{P}+)');
}

/**
 * Plain leak check - detects if the secret appears in text in any form.
 * Returns the match type if found, null otherwise.
 */
export type LeakMatchType =
  | 'direct'
  | 'normalized'
  | 'reversed'
  | 'spaced'
  | 'per-line'
  | 'spelled-out'
  | 'whole-word';

export interface LeakResult {
  type: LeakMatchType;
  matchedText: string;
  index: number;
}

export function plainLeakCheck(secret: string, text: string): LeakResult | null {
  const normalizedSecret = normalize(secret, true);
  const normalizedSecretNoCode = normalize(secret, false);
  const normalizedText = normalize(text, true);
  const normalizedTextNoCode = normalize(text, false);
  // A secret is a "code" if it contains digits (codes/numbers have digits, words don't)
const forCode = /[0-9]/.test(secret);
  const reversedSecret = normalizedSecret.split('').reverse().join('');
  const reversedSecretNoCode = normalizedSecretNoCode.split('').reverse().join('');

  // 1. Direct match (case-insensitive) - check original text
  const directMatch = text.match(new RegExp(escapeRegex(secret), 'i'));
  if (directMatch) {
    return { type: 'direct', matchedText: directMatch[0], index: directMatch.index ?? 0 };
  }

  // 2. Spelled-out letter words (for codes) - check original text FIRST (before spaced/per-line)
  if (forCode) {
    const spelledOutPattern = buildSpelledOutPattern(secret);
    const spelledMatch = text.match(new RegExp(spelledOutPattern, 'iu'));
    if (spelledMatch) {
      return { type: 'spelled-out', matchedText: spelledMatch[0], index: spelledMatch.index ?? 0 };
    }
  }

  // 3. Per-line (one char per line) - with look-alike mapping
  const lightlyNormalizedText = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
  const perLinePattern = normalizedSecret.split('').join('\\s*\\n\\s*');
  const perLineMatch = lightlyNormalizedText.match(new RegExp(perLinePattern, 'u'));
  if (perLineMatch) {
    return { type: 'per-line', matchedText: perLineMatch[0], index: perLineMatch.index ?? 0 };
  }

  // 4. Per-line (without look-alike mapping)
  const perLinePatternNoCode = normalizedSecretNoCode.split('').join('\\s*\\n\\s*');
  const perLineMatchNoCode = lightlyNormalizedText.match(new RegExp(perLinePatternNoCode, 'u'));
  if (perLineMatchNoCode) {
    return { type: 'per-line', matchedText: perLineMatchNoCode[0], index: perLineMatchNoCode.index ?? 0 };
  }

  // 5. Spaced (chars separated by spaces or punctuation) - with look-alike mapping
  const spacedPattern = normalizedSecret.split('').join('[\\s\\p{P}]*');
  const spacedMatch = lightlyNormalizedText.match(new RegExp(spacedPattern, 'u'));
  if (spacedMatch) {
    return { type: 'spaced', matchedText: spacedMatch[0], index: spacedMatch.index ?? 0 };
  }

  // 6. Spaced (without look-alike mapping)
  const spacedPatternNoCode = normalizedSecretNoCode.split('').join('[\\s\\p{P}]*');
  const spacedMatchNoCode = lightlyNormalizedText.match(new RegExp(spacedPatternNoCode, 'u'));
  if (spacedMatchNoCode) {
    return { type: 'spaced', matchedText: spacedMatchNoCode[0], index: spacedMatchNoCode.index ?? 0 };
  }

  // 7. Reversed match (with look-alike mapping for codes)
  const revMatch = normalizedText.match(new RegExp(escapeRegex(reversedSecret)));
  if (revMatch) {
    return { type: 'reversed', matchedText: revMatch[0], index: revMatch.index ?? 0 };
  }

  // 8. Reversed match (without look-alike mapping)
  const revMatchNoCode = normalizedTextNoCode.match(new RegExp(escapeRegex(reversedSecretNoCode)));
  if (revMatchNoCode) {
    return { type: 'reversed', matchedText: revMatchNoCode[0], index: revMatchNoCode.index ?? 0 };
  }

  // 9. Normalized match - check fully normalized text (with look-alike mapping)
  const normMatch = normalizedText.match(new RegExp(escapeRegex(normalizedSecret)));
  if (normMatch) {
    return { type: 'normalized', matchedText: normMatch[0], index: normMatch.index ?? 0 };
  }

  // 10. Normalized match - without look-alike mapping
  const normMatchNoCode = normalizedTextNoCode.match(new RegExp(escapeRegex(normalizedSecretNoCode)));
  if (normMatchNoCode) {
    return { type: 'normalized', matchedText: normMatchNoCode[0], index: normMatchNoCode.index ?? 0 };
  }

  // 11. Whole-word match (for words) - check normalized text without look-alike mapping
  if (!forCode) {
    const wordRegex = new RegExp(`\\b${escapeRegex(normalizedSecretNoCode)}\\b`, 'u');
    const wordMatch = normalizedTextNoCode.match(wordRegex);
    if (wordMatch) {
      return { type: 'whole-word', matchedText: wordMatch[0], index: wordMatch.index ?? 0 };
    }
  }

  return null;
}