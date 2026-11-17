import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import { Button } from '../ui';
import { cx } from '../../lib/cx';

export interface ComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSend: (message: string) => void;
  /** Message length limit from the server settings. */
  maxLength: number;
  /** True while the Warden is thinking, or the screen is offline. */
  disabled?: boolean;
  /** Length of the cooldown between messages, in seconds. */
  cooldownSeconds?: number;
  /** Unix ms when the current cooldown began. The ring sweeps over the cooldown time. */
  cooldownStartedAt?: number | null;
  /** Small line under the field, for example the rate-limit note. */
  note?: string;
  /** Slot beside Send, for example the mobile "Crack" button. */
  secondaryAction?: ReactNode;
  className?: string;
}

const MAX_LINES = 5;
const LINE_HEIGHT = 24;
const FIELD_PADDING = 20;
const COUNTER_THRESHOLD = 0.2;

/**
 * The message box: grows from 1 to 5 lines, Enter sends and Shift+Enter adds a line. It is
 * disabled while the Warden is thinking or during the cooldown, which shows as a ring
 * sweeping around the Send button.
 */
export function Composer({
  value,
  onChange,
  onSend,
  maxLength,
  disabled = false,
  cooldownSeconds = 0,
  cooldownStartedAt = null,
  note,
  secondaryAction,
  className,
}: ComposerProps) {
  const field = useRef<HTMLTextAreaElement>(null);
  const [now, setNow] = useState(() => Date.now());

  const cooldownEnd = cooldownStartedAt != null && cooldownSeconds > 0 ? cooldownStartedAt + cooldownSeconds * 1000 : 0;
  const cooling = cooldownEnd > now;

  useEffect(() => {
    if (!cooldownEnd) return;
    const remaining = cooldownEnd - Date.now();
    if (remaining <= 0) {
      setNow(Date.now());
      return;
    }
    const timer = window.setTimeout(() => setNow(Date.now()), remaining + 20);
    setNow(Date.now());
    return () => window.clearTimeout(timer);
  }, [cooldownEnd]);

  // Grow the field from 1 to 5 lines, and refit when its width changes.
  useLayoutEffect(() => {
    const node = field.current;
    if (!node) return;
    const fit = () => {
      node.style.height = 'auto';
      const max = MAX_LINES * LINE_HEIGHT + FIELD_PADDING + 6;
      node.style.height = `${Math.min(Math.max(node.scrollHeight + 6, 48), max)}px`;
      node.style.overflowY = node.scrollHeight + 6 > max ? 'auto' : 'hidden';
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(node);
    return () => observer.disconnect();
  }, [value]);

  const blocked = disabled || cooling;
  const canSend = !blocked && value.trim().length > 0;
  const remaining = maxLength - value.length;
  const showCounter = remaining <= maxLength * COUNTER_THRESHOLD;

  const send = () => {
    if (canSend) onSend(value);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      send();
    }
  };

  const elapsed = cooling && cooldownStartedAt != null ? (now - cooldownStartedAt) / 1000 : 0;

  return (
    <div className={cx('flex flex-col gap-1', className)}>
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[220px] flex-1">
          <label htmlFor="composer-message" className="sr-only">Message to the Warden</label>
          <textarea
            id="composer-message"
            ref={field}
            value={value}
            rows={1}
            maxLength={maxLength}
            disabled={disabled}
            placeholder="Say something to the Warden..."
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={onKeyDown}
            className="composer-input inset"
          />
        </div>
        <div className="ml-auto flex flex-none items-end gap-3">
        {secondaryAction}
        <span className="relative inline-flex flex-none">
          {cooling && (
            <svg
              key={cooldownStartedAt}
              className="cooldown-ring"
              aria-hidden="true"
              style={{ '--cooldown': `${cooldownSeconds}s`, '--cooldown-delay': `-${elapsed}s` } as never}
            >
              <rect x="1.5" y="1.5" rx="17" pathLength="100" />
            </svg>
          )}
          <Button size="lg" disabled={!canSend} onClick={send}>Send</Button>
        </span>
        </div>
      </div>
      <div className="flex min-h-5 items-start justify-between gap-3 px-1">
        <p className="t-small text-chalk-dim">{note ?? ''}</p>
        {showCounter && <p className="t-small flex-none font-bold">{remaining} left</p>}
      </div>
    </div>
  );
}
