import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, errorMessage } from '../api';
import type { MyGuard, OwnerSession } from '../api';
import { PageHeader } from '../app/PageHeader';
import { TranscriptViewer } from '../components/chat';
import { Button, Dialog, EmptyState, Panel, Skeleton, Stamp, StatTile, Tabs, notify } from '../components/ui';
import { cx } from '../lib/cx';
import { useMediaQuery } from '../lib/useMediaQuery';

type Filter = 'all' | 'cracked' | 'held';
interface Row extends OwnerSession {
  guardId: string;
}

const dateFormat = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

function isHeld(outcome: OwnerSession['outcome']): boolean {
  return outcome === 'held' || outcome === 'expired';
}

function HeistList({ rows, selectedId, onSelect }: { rows: Row[]; selectedId: string | null; onSelect: (row: Row) => void }) {
  return (
    <ul className="flex flex-col gap-3">
      {rows.map((row) => (
        <li key={row.id}>
          <button
            type="button"
            onClick={() => onSelect(row)}
            aria-current={row.id === selectedId || undefined}
            className={cx('case-row', row.id === selectedId && 'case-row-on')}
          >
            <span className="chip chip-callsign">{row.attackerCallsign}</span>
            {row.outcome === 'cracked' ? <Stamp kind="cracked" size="sm" /> : <Stamp kind="held" size="sm" />}
            <span className="t-small ml-auto text-right">
              <span className="block font-bold">{row.picksUsed} picks</span>
              <span className="block text-chalk-dim">{dateFormat.format(new Date(row.createdAt))}</span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function Viewer({ row, guard, onPatch }: { row: Row; guard: MyGuard; onPatch: (row: Row, turn: number) => void }) {
  const firstFlag = row.leakFlags[0];
  return (
    <div className="flex min-h-0 flex-col gap-4">
      <TranscriptViewer
        label={`Transcript of ${row.attackerCallsign}'s heist`}
        turns={row.transcript}
        leakFlags={row.leakFlags}
        wardenSeed={guard.lookSeed}
        wardenName={guard.name}
        focusTurn={firstFlag?.turn}
        className="max-h-[60dvh]"
      />
      {row.winningGuess && <p className="t-small text-chalk-dim">Winning guess: <span className="font-bold text-chalk">{row.winningGuess}</span></p>}
      {firstFlag && <Button onClick={() => onPatch(row, firstFlag.turn)}>Patch the orders</Button>}
    </div>
  );
}

/** Screen 7: attacks on the player's Wardens, with transcripts and owner-only leak flags. */
export function CaseFiles() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const desktop = useMediaQuery('(min-width: 1024px)');
  const [filter, setFilter] = useState<Filter>('all');
  const [versionFilter, setVersionFilter] = useState('all');
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [sheet, setSheet] = useState<Row | null>(null);

  const mine = useQuery({ queryKey: ['mine'], queryFn: () => api.listMine() });
  const guards = mine.data ?? [];
  const families = useMemo(() => {
    const map = new Map<string, MyGuard[]>();
    for (const guard of guards) map.set(guard.familyId, [...(map.get(guard.familyId) ?? []), guard]);
    return [...map.values()].map((versions) => [...versions].sort((a, b) => b.version - a.version));
  }, [guards]);

  const wanted = params.get('guard');
  const current = families.find((versions) => versions.some((guard) => guard.id === wanted)) ?? families[0];
  const latest = current?.[0];
  const versionIds = versionFilter === 'all' ? (current ?? []).map((guard) => guard.id) : [versionFilter];

  const sessionQueries = useQueries({
    queries: versionIds.map((id) => ({ queryKey: ['owner-sessions', id], queryFn: () => api.ownerSessions(id) })),
  });
  const loading = mine.isPending || sessionQueries.some((query) => query.isPending);
  const failed = mine.isError || sessionQueries.some((query) => query.isError);

  const rows: Row[] = useMemo(
    () => sessionQueries.flatMap((query, index) => (query.data?.sessions ?? []).map((session) => ({ ...session, guardId: versionIds[index] ?? '' })))
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)),
    [sessionQueries.map((query) => query.dataUpdatedAt).join(','), versionIds.join(',')],
  );
  const finished = rows.filter((row) => row.status !== 'active');
  const visible = finished.filter((row) => filter === 'all' || (filter === 'cracked' ? row.outcome === 'cracked' : isHeld(row.outcome)));
  const selected = visible.find((row) => row.id === pickedId) ?? visible[0] ?? null;

  const cracked = finished.filter((row) => row.outcome === 'cracked');
  const average = cracked.length ? (cracked.reduce((sum, row) => sum + row.picksUsed, 0) / cracked.length).toFixed(1) : '0';

  const post = useMutation({
    mutationFn: (guard: MyGuard) => api.publishGuard(guard.id, true),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['mine'] });
      notify('success', 'Posted.');
    },
    onError: (failure) => notify('error', errorMessage(failure)),
  });

  const patch = (row: Row, turn: number) => navigate(`/forge/${row.guardId}?patch=${turn}`);
  const guardOf = (row: Row) => current?.find((guard) => guard.id === row.guardId) ?? latest;

  if (mine.isSuccess && families.length === 0) {
    return (
      <>
        <PageHeader title="Case files" helper="Every attack on your Wardens, with the transcript." />
        <EmptyState title="No Wardens yet. The Forge is open." actionLabel="Build a Warden" onAction={() => navigate('/forge')} />
      </>
    );
  }

  return (
    <>
      <PageHeader title="Case files" helper="Every attack on your Wardens, with the transcript." />

      {current && latest && (
        <div className="mb-6 flex flex-wrap items-end gap-4">
          <div className="min-w-[200px]">
            <label htmlFor="case-warden" className="t-small mb-1 block font-bold">Warden</label>
            <select
              id="case-warden"
              className="field-input inset"
              value={latest.id}
              onChange={(event) => { setParams({ guard: event.target.value }); setVersionFilter('all'); setPickedId(null); }}
            >
              {families.map((versions) => <option key={versions[0]?.familyId} value={versions[0]?.id}>{versions[0]?.name}</option>)}
            </select>
          </div>
          <div className="min-w-[160px]">
            <label htmlFor="case-version" className="t-small mb-1 block font-bold">Version</label>
            <select id="case-version" className="field-input inset" value={versionFilter} onChange={(event) => { setVersionFilter(event.target.value); setPickedId(null); }}>
              <option value="all">All versions</option>
              {current.map((guard) => <option key={guard.id} value={guard.id}>Version {guard.version}</option>)}
            </select>
          </div>
        </div>
      )}

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatTile value={finished.length} label="Heists" />
        <StatTile value={cracked.length} label="Cracked" />
        <StatTile value={finished.filter((row) => isHeld(row.outcome)).length} label="Held" />
        <StatTile value={average} label="Average picks to crack" />
      </div>

      {loading && <div className="flex justify-center py-12"><Skeleton size={140} label="Loading case files" /></div>}
      {failed && !loading && <EmptyState title="Something broke on our side. Try again in a moment." actionLabel="Try again" onAction={() => { void mine.refetch(); sessionQueries.forEach((query) => void query.refetch()); }} />}

      {!loading && !failed && finished.length === 0 && latest && (
        latest.published || current?.some((guard) => guard.published)
          ? <EmptyState title="No one has tried this vault yet. It's on the Board, waiting." actionLabel="Open the Board" onAction={() => navigate('/board')} />
          : <EmptyState title="Post this Warden to get attackers." actionLabel="Post to the Board" onAction={() => post.mutate(latest)} />
      )}

      {!loading && !failed && finished.length > 0 && (
        <>
          <div className="mb-4">
            <Tabs
              label="Filter heists"
              value={filter}
              onValueChange={(value) => { setFilter(value as Filter); setPickedId(null); }}
              items={[{ value: 'all', label: 'All' }, { value: 'cracked', label: 'Cracked' }, { value: 'held', label: 'Held' }]}
            />
          </div>
          {visible.length === 0 ? (
            <p className="t-body text-chalk-dim">No heists match this filter.</p>
          ) : (
            <div className="grid gap-6 lg:grid-cols-[minmax(280px,380px)_1fr]">
              <HeistList rows={visible} selectedId={desktop ? selected?.id ?? null : null} onSelect={(row) => (desktop ? setPickedId(row.id) : setSheet(row))} />
              {desktop && selected && guardOf(selected) && (
                <Panel titleLevel={2} title={`${selected.attackerCallsign}'s heist`}>
                  <Viewer row={selected} guard={guardOf(selected) as MyGuard} onPatch={patch} />
                </Panel>
              )}
            </div>
          )}
        </>
      )}

      <Dialog
        open={sheet !== null && !desktop}
        onOpenChange={(open) => { if (!open) setSheet(null); }}
        title={sheet ? `${sheet.attackerCallsign}'s heist` : 'Heist'}
        footer={<Button variant="quiet" onClick={() => setSheet(null)}>Close</Button>}
      >
        {sheet && guardOf(sheet) && <Viewer row={sheet} guard={guardOf(sheet) as MyGuard} onPatch={patch} />}
      </Dialog>
    </>
  );
}
