import type { ReactNode } from 'react';
import { WardenAvatar } from '../game/WardenAvatar';
import { cx } from '../../lib/cx';

/** Messages are always rendered as plain text. React escapes them; line breaks are kept by CSS. */
export function CrackerBubble({ children }: { children: ReactNode }) {
  return (
    <div className="bubble-row-cracker">
      <p className="bubble bubble-cracker">{children}</p>
    </div>
  );
}

export interface WardenBubbleProps {
  children: ReactNode;
  seed: string;
  wardenName: string;
  className?: string;
}

export function WardenBubble({ children, seed, wardenName, className }: WardenBubbleProps) {
  return (
    <div className={cx('bubble-row-warden', className)}>
      <WardenAvatar seed={seed} size={32} label={`${wardenName}, the Warden`} />
      <p className="bubble bubble-warden">{children}</p>
    </div>
  );
}

export function SystemNote({ children }: { children: ReactNode }) {
  return (
    <div className="text-center">
      <p className="system-note">{children}</p>
    </div>
  );
}

/** The Warden avatar thinking, with three dots bouncing on a 120 ms stagger. */
export function ThinkingPlate({ seed, wardenName }: { seed: string; wardenName: string }) {
  return (
    <div className="bubble-row-warden" role="status">
      <WardenAvatar seed={seed} mood="thinking" size={32} label="" />
      <span className="bubble bubble-warden" aria-hidden="true">
        <span className="thinking-dots"><i style={{ '--i': 0 } as never} /><i style={{ '--i': 1 } as never} /><i style={{ '--i': 2 } as never} /></span>
      </span>
      <span className="sr-only">{wardenName} is thinking</span>
    </div>
  );
}
