import { useRef } from 'react';
import type { ReactNode } from 'react';
import * as RadixDialog from '@radix-ui/react-dialog';
import { cx } from '../../lib/cx';

export interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children?: ReactNode;
  /** Buttons row, shown under the content. */
  footer?: ReactNode;
  className?: string;
}

/**
 * Centered dialog from 768 px, bottom sheet below. Radix traps focus, closes on Esc and
 * returns focus to the trigger. Opening and closing motion is added in phase D5.
 */
export function Dialog({ open, onOpenChange, title, description, children, footer, className }: DialogProps) {
  // Radix only returns focus to a Trigger. This dialog is controlled, so remember the
  // element that had focus when it opened and give focus back to it on close.
  const returnFocus = useRef<HTMLElement | null>(null);
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="dialog-overlay" />
        <RadixDialog.Content
          className={cx('panel dialog-content', className)}
          onOpenAutoFocus={() => {
            returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            returnFocus.current?.focus();
          }}
          {...(description ? {} : { 'aria-describedby': undefined })}
        >
          <div className="dialog-handle" aria-hidden="true" />
          <RadixDialog.Title className="t-h2">{title}</RadixDialog.Title>
          {description ? (
            <RadixDialog.Description className="t-body mt-2 text-chalk-dim">{description}</RadixDialog.Description>
          ) : null}
          {children ? <div className="mt-4">{children}</div> : null}
          {footer ? <div className="mt-6 flex flex-wrap justify-end gap-3">{footer}</div> : null}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
