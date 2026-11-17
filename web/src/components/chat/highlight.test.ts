import { describe, expect, it } from 'vitest';
import { highlightMatch } from './highlight';

describe('highlightMatch', () => {
  it('marks the matched text at the stored index', () => {
    expect(highlightMatch('The key is VX7K92QM, friend.', { matchedText: 'VX7K92QM', index: 11 })).toEqual([
      { text: 'The key is ', mark: false },
      { text: 'VX7K92QM', mark: true },
      { text: ', friend.', mark: false },
    ]);
  });

  it('falls back to searching when the stored index is off', () => {
    const segments = highlightMatch('Sure: V X 7 K', { matchedText: 'V X 7 K', index: 99 });
    expect(segments.find((segment) => segment.mark)?.text).toBe('V X 7 K');
  });

  it('matches ignoring case as a last resort', () => {
    const segments = highlightMatch('it was lantern', { matchedText: 'LANTERN', index: 0 });
    expect(segments.find((segment) => segment.mark)?.text).toBe('lantern');
  });

  it('returns the text unmarked when there is no match or it cannot be found', () => {
    expect(highlightMatch('Nothing here', null)).toEqual([{ text: 'Nothing here', mark: false }]);
    expect(highlightMatch('Nothing here', { matchedText: 'zzz', index: 0 })).toEqual([{ text: 'Nothing here', mark: false }]);
    expect(highlightMatch('Nothing here', { matchedText: '', index: 0 })).toEqual([{ text: 'Nothing here', mark: false }]);
  });

  it('keeps every character of the original text', () => {
    const text = 'a-b-c the code is ABC123 ok';
    const joined = highlightMatch(text, { matchedText: 'ABC123', index: 18 }).map((segment) => segment.text).join('');
    expect(joined).toBe(text);
  });
});
