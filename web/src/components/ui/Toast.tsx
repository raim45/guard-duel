import { CircleCheck, Info, OctagonAlert } from 'lucide-react';
import { Toaster, toast } from 'sonner';
import { cx } from '../../lib/cx';

export type ToastKind = 'success' | 'error' | 'info';

const icons = {
  success: CircleCheck,
  error: OctagonAlert,
  info: Info,
} as const;

/** The toast visual: a small raised panel with a colored left stripe and an icon. */
export function ToastCard({ kind, message }: { kind: ToastKind; message: string }) {
  const Icon = icons[kind];
  return (
    <div className={cx('panel toast-card', `toast-${kind}`)} role="status">
      <Icon size={22} aria-hidden="true" className="flex-none" />
      <p className="t-body font-bold">{message}</p>
    </div>
  );
}

export function notify(kind: ToastKind, message: string): void {
  toast.custom(() => <ToastCard kind={kind} message={message} />, { duration: 4000 });
}

/** Mount once near the app root. Toasts appear at the top center for 4 seconds. */
export function AppToaster() {
  return <Toaster position="top-center" visibleToasts={3} />;
}
