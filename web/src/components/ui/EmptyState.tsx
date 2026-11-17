import { VaultDoor } from '../vault/VaultDoor';
import { Button } from './Button';

export interface EmptyStateProps {
  title: string;
  body?: string;
  actionLabel: string;
  onAction: () => void;
}

/** The vault door ajar by 15 degrees, one heading, one line and the obvious next action. */
export function EmptyState({ title, body, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-8 text-center">
      <VaultDoor state="ajar" size={160} label="Vault door" />
      <h3 className="t-h3 mt-2">{title}</h3>
      {body ? <p className="t-body max-w-[44ch] text-chalk-dim">{body}</p> : null}
      <Button className="mt-2" onClick={onAction}>{actionLabel}</Button>
    </div>
  );
}
