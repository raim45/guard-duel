import { useEffect, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { AttemptsPips } from '../game/Meters';
import { Button, Dialog } from '../ui';
import type { LockType } from '../ui';

export interface KeyDialProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lockType: LockType;
  /** Key length when the format hint states it. Null shows one wide field instead of slots. */
  keyLength: number | null;
  attemptsTotal: number;
  attemptsLeft: number;
  /** Called with the guess exactly as entered (already uppercased for Combo and PIN). */
  onSubmit: (guess: string) => void;
  submitting?: boolean;
}

const WORD_MAX_LENGTH = 40;

/** Combo and PIN keys are uppercase letters and digits only; pasted spaces and dashes are dropped. */
export function cleanKeyInput(raw: string, lockType: LockType, keyLength: number | null): string {
  if (lockType === 'passphrase' || keyLength === null) return raw.slice(0, WORD_MAX_LENGTH);
  return raw.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, keyLength);
}

/**
 * The guess dialog. With a known length it shows one slot per character, but the slots are
 * only a picture: a single labelled input sits on top, so assistive tech sees one field.
 */
export function KeyDial({ open, onOpenChange, lockType, keyLength, attemptsTotal, attemptsLeft, onSubmit, submitting = false }: KeyDialProps) {
  const [value, setValue] = useState('');
  const slotted = keyLength !== null && lockType !== 'passphrase';

  // Start empty when opened, and clear the entry after a wrong guess uses an attempt.
  useEffect(() => {
    if (open) setValue('');
  }, [open, attemptsLeft]);

  const complete = slotted ? value.length === keyLength : value.trim().length > 0;

  const onChange = (event: ChangeEvent<HTMLInputElement>) => {
    setValue(cleanKeyInput(event.target.value, lockType, keyLength));
  };

  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    if (complete && !submitting) onSubmit(value);
  };

  const keepCaretAtEnd = (input: HTMLInputElement) => {
    const end = input.value.length;
    input.setSelectionRange(end, end);
  };

  const inputProps = {
    id: 'key-dial-input',
    value,
    onChange,
    autoComplete: 'off',
    autoCapitalize: lockType === 'passphrase' ? 'none' : 'characters',
    spellCheck: false,
    inputMode: lockType === 'pin' ? ('numeric' as const) : ('text' as const),
    'aria-label': 'The key',
    ...(slotted ? { 'aria-describedby': 'key-dial-length', maxLength: keyLength } : {}),
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Crack the key"
      footer={(
        <>
          <Button variant="quiet" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" form="key-dial-form" loading={submitting} disabled={!complete}>Try it</Button>
        </>
      )}
    >
      <form id="key-dial-form" onSubmit={submit} className="flex flex-col items-center gap-4">
        {slotted ? (
          <div className="key-slots">
            {Array.from({ length: keyLength }, (_, index) => (
              <span
                key={index}
                className="key-slot inset"
                data-active={index === Math.min(value.length, keyLength - 1)}
                aria-hidden="true"
              >
                {value[index] ?? ''}
              </span>
            ))}
            <input
              {...inputProps}
              className="key-input"
              onFocus={(event) => keepCaretAtEnd(event.currentTarget)}
              onSelect={(event) => keepCaretAtEnd(event.currentTarget)}
              onClick={(event) => keepCaretAtEnd(event.currentTarget)}
            />
            <span id="key-dial-length" className="sr-only">{keyLength} characters</span>
          </div>
        ) : (
          <input {...inputProps} className="key-wide inset" />
        )}
        <AttemptsPips total={attemptsTotal} used={attemptsTotal - attemptsLeft} />
      </form>
    </Dialog>
  );
}
