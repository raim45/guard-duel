import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api, errorMessage, isErrorCode } from '../api';
import type { AttackResult, ReportReason } from '../api';
import { TranscriptViewer } from '../components/chat';
import { VaultDoor } from '../components/vault/VaultDoor';
import { Button, Dialog, EmptyState, Panel, Skeleton, Stamp, StatTile, notify } from '../components/ui';
import { forgetHeist } from '../lib/heistStore';
import { formatPatrol } from '../components/game';

const REASONS: Array<{ value: ReportReason; label: string }> = [
  { value: 'offensive_orders', label: 'Offensive orders' },
  { value: 'warden_is_broken', label: 'Warden is broken' },
  { value: 'something_else', label: 'Something else' },
];

function headline(result: AttackResult): { title: string; line: string } {
  switch (result.outcome) {
    case 'cracked':
      return { title: 'Cracked.', line: `You got the key in ${result.picksUsed} ${result.picksUsed === 1 ? 'pick' : 'picks'}.` };
    case 'expired':
      return { title: 'Held.', line: 'The patrol arrived first.' };
    case 'errored':
      return { title: 'Cut short.', line: "This heist was cut short, so it doesn't count." };
    default:
      return { title: 'Held.', line: 'The Warden kept the key.' };
  }
}

function ReportDialog({ open, onOpenChange, guardId }: { open: boolean; onOpenChange: (open: boolean) => void; guardId: string }) {
  const [reason, setReason] = useState<ReportReason>('offensive_orders');
  const [note, setNote] = useState('');
  const send = useMutation({
    mutationFn: () => api.createReport(guardId, reason, note.trim() || undefined),
    onSuccess: () => {
      notify('success', 'Reported.');
      onOpenChange(false);
    },
    onError: (failure) => notify('error', errorMessage(failure)),
  });
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Report this Warden"
      footer={(
        <>
          <Button variant="quiet" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button loading={send.isPending} onClick={() => send.mutate()}>Send report</Button>
        </>
      )}
    >
      <fieldset className="flex flex-col gap-2 border-0 p-0">
        <legend className="sr-only">Reason</legend>
        {REASONS.map((item) => (
          <label key={item.value} className="lock-card !p-3" data-on={reason === item.value || undefined} style={reason === item.value ? { background: 'var(--color-brass)', color: 'var(--color-ink)' } : undefined}>
            <input type="radio" name="report-reason" className="sr-only" checked={reason === item.value} onChange={() => setReason(item.value)} />
            <span className="t-body font-bold">{item.label}</span>
          </label>
        ))}
      </fieldset>
      <label htmlFor="report-note" className="t-body mb-1 mt-4 block font-bold">Note (optional)</label>
      <textarea id="report-note" rows={3} maxLength={2000} value={note} onChange={(event) => setNote(event.target.value)} className="composer-input inset" />
    </Dialog>
  );
}

/** Screen 6: what happened, what the player earned the right to see, and where to go next. */
export function Report() {
  const { sessionId = '' } = useParams();
  const navigate = useNavigate();
  const [reporting, setReporting] = useState(false);
  const result = useQuery({
    queryKey: ['result', sessionId],
    queryFn: async () => {
      const value = await api.attackResult(sessionId);
      forgetHeist(sessionId);
      return value;
    },
    retry: false,
  });

  const again = useMutation({
    mutationFn: (guardId: string) => api.startAttack(guardId),
    onSuccess: (started) => navigate(`/heist/${started.sessionId}`),
    onError: (failure) => notify('error', errorMessage(failure)),
  });

  if (result.isPending) return <div className="flex min-h-[50dvh] items-center justify-center"><Skeleton size={160} label="Loading the report" /></div>;
  if (result.isError) {
    if (isErrorCode(result.error, 'SESSION_ACTIVE')) {
      return <EmptyState title="This heist is still going." actionLabel="Back to the heist" onAction={() => navigate(`/heist/${sessionId}`)} />;
    }
    return <EmptyState title="Something broke on our side. Try again in a moment." actionLabel="Try again" onAction={() => void result.refetch()} />;
  }

  const data = result.data;
  const { title, line } = headline(data);
  const owner = data.leakFlags !== undefined;
  const cracked = data.outcome === 'cracked';

  return (
    <>
      <div className="grid gap-8 lg:grid-cols-[340px_1fr]">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <Panel>
            <div className="flex flex-col items-center gap-4">
              <VaultDoor size={160} state={cracked ? 'open' : 'bolted'} seed={data.guard.lookSeed} label={`${data.guard.name}'s vault`} />
              {data.outcome === 'errored' ? null : <Stamp kind={cracked ? 'cracked' : 'held'} size="sm" />}
              <p className="lock-ticket !mt-0 text-center">The key was {data.key}</p>
              <div className="grid w-full grid-cols-3 gap-2">
                <StatTile value={data.picksUsed} label="Picks used" />
                <StatTile value={formatPatrol(data.secondsUsed)} label="Time used" />
                <StatTile value={data.wrongGuesses} label="Attempts used" />
              </div>
            </div>
          </Panel>
        </aside>

        <section className="min-w-0">
          <h1 className="t-h1">{title}</h1>
          <p className="t-body mb-6 text-chalk-dim">{line}</p>
          {data.outcome === 'errored' && <Button className="mb-6" onClick={() => again.mutate(data.guard.id)} loading={again.isPending}>Start again</Button>}

          <TranscriptViewer
            label="Heist transcript"
            turns={data.transcript}
            leakFlags={data.leakFlags}
            wardenSeed={data.guard.lookSeed}
            wardenName={data.guard.name}
            className="max-h-[60dvh]"
          />

          {data.orders && (
            <div className="paper mt-6 p-4">
              <h2 className="t-h3 mb-1">The orders</h2>
              {!owner && <p className="t-small mb-2">You cracked it, so the orders are yours to read.</p>}
              <p className="t-body whitespace-pre-wrap">{data.orders}</p>
            </div>
          )}

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button onClick={() => navigate('/board')}>Try another vault</Button>
            <Button variant="secondary" loading={again.isPending} onClick={() => again.mutate(data.guard.id)}>Try this vault again</Button>
            {!owner && <Button variant="quiet" onClick={() => setReporting(true)}>Report this Warden</Button>}
          </div>
        </section>
      </div>
      <ReportDialog open={reporting} onOpenChange={setReporting} guardId={data.guard.id} />
    </>
  );
}
