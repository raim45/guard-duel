/**
 * The API sends the key format as plain text, for example "A 10-character code" or
 * "A 10-digit PIN". Returns the key length when the hint states one, otherwise null
 * (a passphrase hint is just "A word", and a missing hint means the format is hidden).
 */
export function keyLengthFromHint(hint: string | null | undefined): number | null {
  const match = hint?.match(/(\d+)-(?:character|digit)/i);
  if (!match) return null;
  const length = Number(match[1]);
  return Number.isInteger(length) && length > 0 && length <= 64 ? length : null;
}
