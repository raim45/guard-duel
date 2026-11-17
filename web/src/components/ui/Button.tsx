import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Zap } from 'lucide-react';
import { cx } from '../../lib/cx';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'quiet';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Shows the spinning bolt, keeps the label and the width, and ignores clicks. */
  loading?: boolean;
  leadingIcon?: ReactNode;
  /** Styleguide only: forces a visual state so every state can be seen at once. */
  previewState?: 'hover' | 'pressed' | 'focus';
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  leadingIcon,
  previewState,
  disabled,
  className,
  children,
  onClick,
  type = 'button',
  ...rest
}: ButtonProps) {
  const inactive = Boolean(disabled) || loading;
  const spinnerSize = size === 'lg' ? 18 : 16;
  return (
    <button
      {...rest}
      type={type}
      className={cx('btn', `btn-${variant}`, `btn-${size}`, className)}
      aria-disabled={disabled || undefined}
      aria-busy={loading || undefined}
      data-loading={loading || undefined}
      data-state={previewState}
      onClick={(event) => {
        if (inactive) {
          event.preventDefault();
          return;
        }
        onClick?.(event);
      }}
    >
      {loading && leadingIcon ? (
        <span className="btn-spinner" aria-hidden="true"><Zap size={spinnerSize} strokeWidth={2.5} /></span>
      ) : leadingIcon ? (
        <span aria-hidden="true" className="inline-flex">{leadingIcon}</span>
      ) : loading ? (
        <span className="btn-spinner btn-spinner-floating" aria-hidden="true"><Zap size={14} strokeWidth={2.5} /></span>
      ) : null}
      <span>{children}</span>
    </button>
  );
}
