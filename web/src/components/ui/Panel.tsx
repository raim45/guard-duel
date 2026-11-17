import type { HTMLAttributes, ReactNode } from 'react';
import { cx } from '../../lib/cx';

export type PanelVariant = 'raised' | 'inset' | 'paper';

export interface PanelProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  variant?: PanelVariant;
  /** H3 title row. */
  title?: ReactNode;
  /** Optional icon at the left of the title row. */
  icon?: ReactNode;
  as?: 'div' | 'section' | 'article';
}

const frame: Record<PanelVariant, string> = {
  raised: 'panel',
  inset: 'inset',
  paper: 'paper',
};

export function Panel({ variant = 'raised', title, icon, as: Tag = 'div', className, children, ...rest }: PanelProps) {
  return (
    <Tag {...rest} className={cx(frame[variant], variant === 'raised' && 'panel-frame', className)}>
      {variant === 'raised' && (
        <span className="panel-rivets" aria-hidden="true"><i /><i /><i /><i /></span>
      )}
      <div className="panel-pad">
        {title ? (
          <h3 className="t-h3 mb-3 flex items-center gap-2">
            {icon ? <span aria-hidden="true" className="inline-flex">{icon}</span> : null}
            {title}
          </h3>
        ) : null}
        {children}
      </div>
    </Tag>
  );
}
