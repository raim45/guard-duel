import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { api, errorMessage, isErrorCode } from '../api';
import type { BoardItem, BoardLockFilter, BoardSort, Limits } from '../api';
import { PageHeader } from '../app/PageHeader';
import { WardenAvatar } from '../components/game';
import { VaultDoor } from '../components/vault/VaultDoor';
import { Button, Dialog, EmptyState, LockChip, Skeleton, Tabs } from '../components/ui';
import { cx } from '../lib/cx';
import { findHeistForGuard, saveHeist } from '../lib/heistStore';

const LOCK_FILTERS: Array<{ value: BoardLockFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'combo', label: 'Combo' },
  { value: 'passphrase', label: 'Passphrase' },
  { value: 'pin', label: 'PIN' },
];

export function hintSentence(hint: string): string {
  return `The key: ${hint.charAt(0).toLowerCase()}${hint.slice(1)}`;
}

export function limitsSentence(limits: Limits): string {
  const minutes = Math.round(limits.patrolSeconds / 60);
  return `${limits.picks} picks, ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}, ${limits.wrongAttempts} attempts`;
}

function isTough(item: BoardItem): boolean {
  return item.attempts >= 20 && item.breakRate !== null && item.breakRate < 0.1;
}

function BoardTile({ item, wide, mine, onOpen }: { item: BoardItem; wide: boolean; mine: boolean; onOpen: () => void }) {
  const untouched = item.attempts === 0;
  return (
    <button type="button" onClick={onOpen} className="tile panel panel-frame">
      {wide && <span className="ribbon">Just posted</span>}
      {isTough(item) && <span className="corner-badge">Tough one</span>}
      <span className={cx('flex w-full items-center gap-4 p-4', wide ? 'flex-col md:flex-row md:gap-6' : 'flex-col')}>
        <span className="hidden lg:block">
          <VaultDoor size={wide ? 240 : 160} seed={item.lookSeed} dents={item.breaks} label={`${item.name}'s vault`} />
        </span>
        <span className="lg:hidden">
          <VaultDoor size={160} seed={item.lookSeed} dents={item.breaks} label={`${item.name}'s vault`} />
        </span>
        <span className={cx('flex flex-col gap-2', wide ? 'items-center md:items-start' : 'items-center')}>
          <span className="t-h3">{item.name}</span>
          <span className="flex flex-wrap items-center justify-center gap-2">
            <LockChip lockType={item.lockType} />
            {untouched && <span className="chip chip-stat">Untouched</span>}
            {mine && <span className="chip chip-board">Yours</span>}
          </span>
          <span className="t-small text-chalk-dim">Cracked {item.breaks} of {item.attempts} heists</span>
        </span>
      </span>
    </button>
  );
}

function Briefing({ item, limits, enabled, onClose }: { item: BoardItem | null; limits: Limits | undefined; enabled: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<{ message: string; resume?: string } | null>(null);

  const start = async () => {
    if (!item) return;
    setStarting(true);
    setError(null);
    try {
      const started = await api.startAttack(item.id);
      saveHeist({
        sessionId: started.sessionId,
        guardId: item.id,
        guardName: item.name,
        lookSeed: item.lookSeed,
        lockType: item.lockType,
        keyFormatHint: started.keyFormatHint ?? null,
        limits: started.limits,
        startedAt: started.startedAt,
      });
      navigate(`/heist/${started.sessionId}`);
    } catch (failure) {
      const resume = isErrorCode(failure, 'ACTIVE_SESSION_LIMIT') ? findHeistForGuard(item.id)?.sessionId : undefined;
      setError({ message: errorMessage(failure), resume });
    } finally {
      setStarting(false);
    }
  };

  return (
    <Dialog
      open={item !== null}
      onOpenChange={(open) => { if (!open) { setError(null); onClose(); } }}
      title={item ? `${item.name}` : 'Heist briefing'}
      description="Heist briefing"
      footer={(
        <>
          <Button variant="quiet" onClick={onClose}>Cancel</Button>
          {error?.resume ? (
            <Button onClick={() => navigate(`/heist/${error.resume}`)}>Resume heist</Button>
          ) : (
            <Button loading={starting} disabled={!enabled} onClick={() => void start()}>Start heist</Button>
          )}
        </>
      )}
    >
      {item && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <WardenAvatar seed={item.lookSeed} size={96} label={`${item.name}, the Warden`} />
            <div className="flex flex-col items-start gap-2">
              <LockChip lockType={item.lockType} />
              {item.keyFormatHint && <p className="t-body font-bold">{hintSentence(item.keyFormatHint)}</p>}
            </div>
          </div>
          {limits && <p className="t-body">{limitsSentence(limits)}</p>}
          {!enabled && <p className="t-small font-bold" role="status">Heists are paused for now. You can still build and post Wardens.</p>}
          {error && <p className="t-small font-bold" role="alert">{error.message}</p>}
        </div>
      )}
    </Dialog>
  );
}

/** Screen 2: choose a Warden to attack. */
export function Board() {
  const navigate = useNavigate();
  const [lockType, setLockType] = useState<BoardLockFilter>('all');
  const [sort, setSort] = useState<BoardSort>('freshest');
  const [selected, setSelected] = useState<BoardItem | null>(null);

  const board = useInfiniteQuery({
    queryKey: ['browse', lockType, sort],
    initialPageParam: 1,
    queryFn: ({ pageParam }) => api.browse({ lockType, sort, page: pageParam }),
    getNextPageParam: (last, pages) => (pages.reduce((count, page) => count + page.items.length, 0) < last.total ? last.page + 1 : undefined),
  });
  const mine = useQuery({ queryKey: ['mine'], queryFn: () => api.listMine() });

  const items = useMemo(() => board.data?.pages.flatMap((page) => page.items) ?? [], [board.data]);
  const first = board.data?.pages[0];
  const mineIds = useMemo(() => new Set((mine.data ?? []).map((guard) => guard.familyId)), [mine.data]);
  const newestId = useMemo(() => {
    if (sort !== 'freshest' || lockType !== 'all') return null;
    return items.reduce<BoardItem | null>((best, item) => (!best || Date.parse(item.postedAt) > Date.parse(best.postedAt) ? item : best), null)?.id ?? null;
  }, [items, sort, lockType]);
  const filtered = lockType !== 'all';

  const open = (item: BoardItem) => {
    if (mineIds.has(item.familyId)) navigate(`/cases?guard=${item.id}`);
    else setSelected(item);
  };

  return (
    <>
      <PageHeader title="The Board" helper="Pick a vault. Crack it before the patrol arrives." />

      {first && !first.attacksEnabled && (
        <p role="status" className="mb-4 rounded-[14px] border-[3px] border-ink bg-sky px-4 py-2 font-bold text-ink">
          Heists are paused for now. You can still build and post Wardens.
        </p>
      )}

      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div role="group" aria-label="Lock type" className="flex flex-wrap gap-2">
          {LOCK_FILTERS.map((filter) => (
            <button key={filter.value} type="button" className="chip chip-button" aria-pressed={lockType === filter.value} onClick={() => setLockType(filter.value)}>
              {filter.label}
            </button>
          ))}
        </div>
        <Tabs
          label="Sort the Board"
          value={sort}
          onValueChange={(value) => setSort(value as BoardSort)}
          items={[{ value: 'freshest', label: 'Freshest' }, { value: 'toughest', label: 'Toughest' }, { value: 'most-cracked', label: 'Most cracked' }]}
        />
      </div>

      {board.isPending && (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3" aria-busy="true">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="flex justify-center py-8"><Skeleton size={160} label="Loading vaults" /></div>
          ))}
        </div>
      )}

      {board.isError && (
        <EmptyState title="The Board didn't load. Try again." actionLabel="Try again" onAction={() => void board.refetch()} />
      )}

      {board.isSuccess && items.length === 0 && (
        filtered || sort === 'toughest'
          ? <EmptyState title="No vaults match. Clear the filters." actionLabel="Clear filters" onAction={() => { setLockType('all'); setSort('freshest'); }} />
          : <EmptyState title="No vaults posted yet. Build the first one in the Forge." actionLabel="Open the Forge" onAction={() => navigate('/forge')} />
      )}

      {items.length > 0 && (
        <ul className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => {
            const wide = item.id === newestId;
            return (
              <li key={item.id} className={cx('flex', wide && 'lg:col-span-2')}>
                <BoardTile item={item} wide={wide} mine={mineIds.has(item.familyId)} onOpen={() => open(item)} />
              </li>
            );
          })}
        </ul>
      )}

      {board.hasNextPage && (
        <div className="mt-8 flex justify-center">
          <Button variant="secondary" loading={board.isFetchingNextPage} onClick={() => void board.fetchNextPage()}>Load more</Button>
        </div>
      )}

      <Briefing item={selected} limits={first?.limits} enabled={first?.attacksEnabled ?? true} onClose={() => setSelected(null)} />
    </>
  );
}
