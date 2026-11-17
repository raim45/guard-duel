import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowDown } from 'lucide-react';
import { Button } from '../ui';
import { cx } from '../../lib/cx';
import { CrackerBubble, SystemNote, ThinkingPlate, WardenBubble } from './ChatParts';

export type ChatItem =
  | { id: string; kind: 'cracker'; text: string }
  | { id: string; kind: 'warden'; text: string }
  | { id: string; kind: 'note'; text: string };

export interface ChatLogProps {
  items: ChatItem[];
  wardenSeed: string;
  wardenName: string;
  /** Shows the thinking plate while a request is in flight. */
  thinking?: boolean;
  className?: string;
}

const NEAR_BOTTOM_PX = 48;

/**
 * The live conversation: an inset region with role="log". It follows new messages while the
 * reader is at the bottom, and shows a "Jump to latest" pill once they have scrolled up.
 */
export function ChatLog({ items, wardenSeed, wardenName, thinking = false, className }: ChatLogProps) {
  const scroller = useRef<HTMLDivElement>(null);
  const [atBottom, setAtBottom] = useState(true);
  const stick = useRef(true);

  const scrollToEnd = () => {
    const node = scroller.current;
    if (node) node.scrollTop = node.scrollHeight;
  };

  useLayoutEffect(() => {
    if (stick.current) scrollToEnd();
  }, [items.length, thinking]);

  useEffect(() => {
    scrollToEnd();
  }, []);

  const onScroll = () => {
    const node = scroller.current;
    if (!node) return;
    const near = node.scrollHeight - node.scrollTop - node.clientHeight < NEAR_BOTTOM_PX;
    stick.current = near;
    setAtBottom(near);
  };

  return (
    <div className={cx('relative inset min-h-0', className)}>
      <div
        ref={scroller}
        role="log"
        aria-live="polite"
        aria-label="Conversation with the Warden"
        tabIndex={0}
        onScroll={onScroll}
        className="chat-log flex h-full flex-col gap-3"
      >
        {items.map((item) => {
          if (item.kind === 'cracker') return <CrackerBubble key={item.id}>{item.text}</CrackerBubble>;
          if (item.kind === 'warden') return <WardenBubble key={item.id} seed={wardenSeed} wardenName={wardenName}>{item.text}</WardenBubble>;
          return <SystemNote key={item.id}>{item.text}</SystemNote>;
        })}
        {thinking && <ThinkingPlate seed={wardenSeed} wardenName={wardenName} />}
      </div>
      {!atBottom && (
        <Button
          size="sm"
          variant="secondary"
          className="jump-pill"
          leadingIcon={<ArrowDown size={18} />}
          onClick={() => {
            stick.current = true;
            scrollToEnd();
            setAtBottom(true);
          }}
        >
          Jump to latest
        </Button>
      )}
    </div>
  );
}
