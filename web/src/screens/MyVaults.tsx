import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, errorMessage } from '../api';
import type { MyGuard } from '../api';
import { PageHeader } from '../app/PageHeader';
import { VaultDoor } from '../components/vault/VaultDoor';
import { Button, Dialog, EmptyState, LockChip, Panel, Skeleton, StatTile, StatusChip, Switch, notify } from '../components/ui';

interface Family {
  familyId: string;
  versions: MyGuard[];
  latest: MyGuard;
  published: MyGuard[];
  heists: number;
  cracked: number;
}

function groupFamilies(guards: MyGuard[]): Family[] {
  const byFamily = new Map<string, MyGuard[]>();
  for (const guard of guards) byFamily.set(guard.familyId, [...(byFamily.get(guard.familyId) ?? []), guard]);
  return [...byFamily.entries()].map(([familyId, versions]) => {
    const sorted = [...versions].sort((a, b) => b.version - a.version);
    return {
      familyId,
      versions: sorted,
      latest: sorted[0] as MyGuard,
      published: sorted.filter((guard) => guard.published),
      heists: sorted.reduce((sum, guard) => sum + (guard.stats?.attempts ?? 0), 0),
      cracked: sorted.reduce((sum, guard) => sum + (guard.stats?.breaks ?? 0), 0),
    };
  }).sort((a, b) => Date.parse(b.latest.createdAt) - Date.parse(a.latest.createdAt));
}

const dateFormat = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

function VersionHistory({ family, onClose }: { family: Family | null; onClose: () => void }) {
  return (
    <Dialog
      open={family !== null}
      onOpenChange={(open) => { if (!open) onClose(); }}
      title={family ? `${family.latest.name}, versions` : 'Versions'}
      footer={<Button onClick={onClose}>Close</Button>}
    >
      <ul className="flex flex-col gap-3">
        {family?.versions.map((guard) => (
          <li key={guard.id} className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-ink/40 pb-3 last:border-b-0">
            <div>
              <p className="t-body font-bold">Version {guard.version}</p>
              <p className="t-small text-chalk-dim">{dateFormat.format(new Date(guard.createdAt))}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusChip published={guard.published} />
              <span className="chip chip-stat">{guard.stats?.attempts ?? 0} heists</span>
              <span className="chip chip-stat">{guard.stats?.breaks ?? 0} cracked</span>
            </div>
          </li>
        ))}
      </ul>
    </Dialog>
  );
}

/** Screen 4: manage the player's own Wardens. */
export function MyVaults() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const mine = useQuery({ queryKey: ['mine'], queryFn: () => api.listMine() });
  const [history, setHistory] = useState<Family | null>(null);
  const [takeDown, setTakeDown] = useState<Family | null>(null);

  const families = useMemo(() => groupFamilies(mine.data ?? []), [mine.data]);

  const setPosted = useMutation({
    mutationFn: async ({ family, posted }: { family: Family; posted: boolean }) => {
      if (posted) {
        await api.publishGuard(family.latest.id, true);
        for (const other of family.published) if (other.id !== family.latest.id) await api.publishGuard(other.id, false);
      } else {
        for (const guard of family.published) await api.publishGuard(guard.id, false);
      }
    },
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({ queryKey: ['mine'] });
      await queryClient.invalidateQueries({ queryKey: ['browse'] });
      notify('success', variables.posted ? 'Posted.' : 'Taken down.');
    },
    onError: (failure) => notify('error', errorMessage(failure)),
  });

  return (
    <>
      <PageHeader title="My Vaults" helper="Your Wardens, their versions and how they are holding up." actions={<Button onClick={() => navigate('/forge')}>Build a Warden</Button>} />

      {mine.isPending && <div className="flex justify-center py-16"><Skeleton size={160} label="Loading your Wardens" /></div>}
      {mine.isError && <EmptyState title="Something broke on our side. Try again in a moment." actionLabel="Try again" onAction={() => void mine.refetch()} />}
      {mine.isSuccess && families.length === 0 && (
        <EmptyState title="No Wardens yet. The Forge is open." actionLabel="Build a Warden" onAction={() => navigate('/forge')} />
      )}

      <ul className="flex flex-col gap-6">
        {families.map((family) => {
          const { latest } = family;
          const posted = family.published.length > 0;
          return (
            <li key={family.familyId}>
              <Panel as="article">
                <div className="flex flex-col gap-5 md:flex-row md:items-center">
                  <div className="flex items-center gap-4">
                    <VaultDoor size={96} seed={latest.lookSeed} dents={family.cracked} label={`${latest.name}'s vault`} />
                    <div className="flex flex-col items-start gap-2">
                      <h2 className="t-h2">{latest.name}</h2>
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusChip published={posted} />
                        <LockChip lockType={latest.lockType} />
                        <button type="button" className="chip chip-button" aria-haspopup="dialog" onClick={() => setHistory(family)}>
                          Version {latest.version}
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="grid flex-1 grid-cols-3 gap-3 md:max-w-[420px] md:ml-auto">
                    <StatTile value={family.heists} label="Heists" />
                    <StatTile value={family.cracked} label="Cracked" />
                    <StatTile value={Math.max(0, family.heists - family.cracked)} label="Held" />
                  </div>
                </div>
                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <Button variant="secondary" onClick={() => navigate(`/forge/${latest.id}`)}>Edit</Button>
                  <Button variant="secondary" onClick={() => navigate(`/cases?guard=${latest.id}`)}>Case files</Button>
                  <Switch
                    id={`post-${family.familyId}`}
                    className="ml-auto min-w-[160px]"
                    label={posted ? 'Take down' : 'Post'}
                    checked={posted}
                    disabled={setPosted.isPending}
                    onCheckedChange={(on) => (on ? setPosted.mutate({ family, posted: true }) : setTakeDown(family))}
                  />
                </div>
              </Panel>
            </li>
          );
        })}
      </ul>

      <VersionHistory family={history} onClose={() => setHistory(null)} />
      <Dialog
        open={takeDown !== null}
        onOpenChange={(open) => { if (!open) setTakeDown(null); }}
        title="Take this Warden off the Board?"
        description="Heists in progress will finish."
        footer={(
          <>
            <Button variant="quiet" onClick={() => setTakeDown(null)}>Stay</Button>
            <Button variant="danger" onClick={() => { if (takeDown) setPosted.mutate({ family: takeDown, posted: false }); setTakeDown(null); }}>Take down</Button>
          </>
        )}
      />
    </>
  );
}
