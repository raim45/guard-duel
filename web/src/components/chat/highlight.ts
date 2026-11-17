export interface Segment {
  text: string;
  mark: boolean;
}

export interface LeakMatch {
  matchedText: string;
  index: number;
}

/**
 * Splits a Warden reply into plain and highlighted segments for the owner's transcript.
 * It trusts the stored index when it points at the matched text, and otherwise looks the
 * text up (exact, then ignoring case). If the text cannot be found the reply is returned
 * unmarked; the turn still carries its "The key slipped here" flag.
 */
export function highlightMatch(text: string, match?: LeakMatch | null): Segment[] {
  if (!match || match.matchedText.length === 0) return [{ text, mark: false }];
  const { matchedText, index } = match;
  let start = text.slice(index, index + matchedText.length) === matchedText ? index : text.indexOf(matchedText);
  if (start < 0) start = text.toLowerCase().indexOf(matchedText.toLowerCase());
  if (start < 0) return [{ text, mark: false }];
  const end = start + matchedText.length;
  return [
    { text: text.slice(0, start), mark: false },
    { text: text.slice(start, end), mark: true },
    { text: text.slice(end), mark: false },
  ].filter((segment) => segment.text.length > 0);
}
