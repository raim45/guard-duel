import { useEffect, useRef } from 'react';
import { Flag } from 'lucide-react';
import { cx } from '../../lib/cx';
import { CrackerBubble, WardenBubble } from './ChatParts';
import { highlightMatch } from './highlight';
import type { LeakMatch } from './highlight';

export interface TranscriptTurn {
  role: 'attacker' | 'defender';
  content: string;
  turn: number;
}

export interface TranscriptLeakFlag extends LeakMatch {
  turn: number;
}

export interface TranscriptViewerProps {
  turns: TranscriptTurn[];
  /** Owner-only plain-leak flags. Leave empty for an attacker's own report. */
  leakFlags?: TranscriptLeakFlag[];
  wardenSeed: string;
  wardenName: string;
  /** Scrolls this turn into view, for deep links from Case files. */
  focusTurn?: number;
  /** Accessible name. Make it distinct if two transcripts share a page. */
  label?: string;
  className?: string;
}

/**
 * The chat log, read only. A turn where the code check found the key plainly gets a coral
 * "The key slipped here" flag in its margin and the matching text is marked in brass. The
 * flag sits beside the turn on desktop and below it on mobile.
 */
export function TranscriptViewer({ turns, leakFlags = [], wardenSeed, wardenName, focusTurn, label = 'Transcript', className }: TranscriptViewerProps) {
  const focusRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    focusRef.current?.scrollIntoView({ block: 'center' });
  }, [focusTurn]);

  const flagFor = (turn: number) => leakFlags.find((flag) => flag.turn === turn);

  return (
    <div className={cx('inset chat-log flex min-h-0 flex-col gap-3', className)} role="region" aria-label={label} tabIndex={0}>
      {turns.length === 0 && <p className="t-body text-chalk-dim">No messages were sent in this heist.</p>}
      {turns.map((turn) => {
        if (turn.role === 'attacker') {
          return <CrackerBubble key={`${turn.turn}-a`}>{turn.content}</CrackerBubble>;
        }
        const flag = flagFor(turn.turn);
        const body = highlightMatch(turn.content, flag);
        return (
          <div
            key={`${turn.turn}-d`}
            ref={turn.turn === focusTurn ? focusRef : undefined}
            className="flex flex-col items-start gap-2 md:flex-row md:items-center"
            data-turn={turn.turn}
            data-leak={flag ? 'true' : undefined}
          >
            <WardenBubble seed={wardenSeed} wardenName={wardenName} className="min-w-0 md:max-w-[80%]">
              {body.map((segment, index) => (segment.mark
                ? <mark key={index} className="leak-mark">{segment.text}</mark>
                : <span key={index}>{segment.text}</span>))}
            </WardenBubble>
            {flag && (
              <p className="leak-flag ml-10 md:ml-0">
                <Flag size={14} aria-hidden="true" />
                The key slipped here
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
