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
  /** Heading level of the title. Use 2 when the panel sits directly under the page title. */
  titleLevel?: 2 | 3;
}

const frame: Record<PanelVariant, string> = {
  raised: 'panel',
  inset: 'inset',
  paper: 'paper',
};

export function Panel({ variant = 'raised', title, icon, as: Tag = 'div', titleLevel = 3, className, children, ...rest }: PanelProps) {
  const Heading = titleLevel === 2 ? 'h2' : 'h3';
  return (
    <Tag {...rest} className={cx(frame[variant], variant === 'raised' && 'panel-frame', className)}>
      {variant === 'raised' && (
        <span className="panel-rivets" aria-hidden="true"><i /><i /><i /><i /></span>
      )}
      <div className="panel-pad">
        {title ? (
          <Heading className="t-h3 mb-3 flex items-center gap-2">
            {icon ? <span aria-hidden="true" className="inline-flex">{icon}</span> : null}
            {title}
          </Heading>
        ) : null}
        {children}
      </div>
    </Tag>
  );
}
