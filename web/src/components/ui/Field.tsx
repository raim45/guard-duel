import { forwardRef, useId } from 'react';
import { CircleAlert } from 'lucide-react';
import type { InputHTMLAttributes, ReactNode } from 'react';
import { cx } from '../../lib/cx';

export interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  /** Error text in plain words, shown under the field. */
  error?: string;
  help?: ReactNode;
}

/** A labelled text input on the inset surface, with its error shown under it. */
export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field({ label, error, help, className, id, ...rest }, ref) {
  const auto = useId();
  const inputId = id ?? auto;
  const messageId = `${inputId}-message`;
  return (
    <div className={className}>
      <label htmlFor={inputId} className="t-body mb-1 block font-bold">{label}</label>
      <input
        {...rest}
        ref={ref}
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || help ? messageId : undefined}
        className={cx('field-input inset', error && 'field-input-error')}
      />
      {error ? (
        <p id={messageId} className="t-small mt-1 flex items-center gap-1 font-bold" role="alert">
          <CircleAlert size={16} aria-hidden="true" className="flex-none text-coral" />
          {error}
        </p>
      ) : help ? (
        <p id={messageId} className="t-small mt-1 text-chalk-dim">{help}</p>
      ) : null}
    </div>
  );
});
