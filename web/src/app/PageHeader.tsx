import type { ReactNode } from 'react';

/** Page titles use H1 with one line of helper text in chalk-dim. */
export function PageHeader({ title, helper, actions }: { title: string; helper?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="t-h1">{title}</h1>
        {helper ? <p className="t-body text-chalk-dim">{helper}</p> : null}
      </div>
      {actions}
    </div>
  );
}
