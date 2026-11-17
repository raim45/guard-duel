import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Button, Panel, Tabs } from '../components/ui';
import type { LockType } from '../components/ui';
import {
  AttemptsPips,
  LockTypeGroup,
  PatrolTimer,
  PicksMeter,
  VaultDoor,
  WARDS,
  WardCharm,
  WardenAvatar,
} from '../components/game';
import type { AvatarMood, VaultState, WardId } from '../components/game';

const moods: AvatarMood[] = ['idle', 'thinking', 'talking', 'cracked', 'held'];
const vaultStates: VaultState[] = ['sealed', 'ajar', 'opening', 'open', 'bolted'];

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section className="mt-12" aria-labelledby={id}>
      <h2 id={id} className="t-h2 mb-4">{title}</h2>
      {children}
    </section>
  );
}

function Label({ children }: { children: ReactNode }) {
  return <p className="t-small mb-2 text-chalk-dim">{children}</p>;
}

function PatrolDemo() {
  const [seconds, setSeconds] = useState(65);
  const [running, setRunning] = useState(false);
  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setSeconds((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [running]);
  return (
    <div className="flex flex-wrap items-center gap-4">
      <PatrolTimer seconds={seconds} />
      <Button size="sm" variant="secondary" onClick={() => setRunning((value) => !value)}>{running ? 'Pause' : 'Run live'}</Button>
      <Button size="sm" variant="quiet" onClick={() => { setSeconds(65); setRunning(false); }}>Reset to 01:05</Button>
    </div>
  );
}

export function GameSections() {
  const [used, setUsed] = useState(4);
  const [usedAttempts, setUsedAttempts] = useState(1);
  const [wards, setWards] = useState<Record<WardId, boolean>>({ stonewall: true, pokerFace: false, shortAnswers: false, languageLock: false });
  const [lock, setLock] = useState<LockType>('combo');
  const [vault, setVault] = useState<VaultState>('sealed');
  const [vaultMood, setVaultMood] = useState<AvatarMood | 'auto'>('auto');
  const [dents, setDents] = useState(7);

  return (
    <>
      <Section id="sg-picks" title="Picks meter">
        <Panel>
          <div className="flex flex-col gap-6">
            <div>
              <Label>12 picks, {12 - used} left</Label>
              <PicksMeter total={12} used={used} />
            </div>
            <div className="flex flex-wrap gap-3">
              <Button size="sm" onClick={() => setUsed((value) => Math.min(12, value + 1))}>Spend a pick</Button>
              <Button size="sm" variant="secondary" onClick={() => setUsed((value) => Math.max(0, value - 1))}>Hand one back</Button>
              <Button size="sm" variant="quiet" onClick={() => setUsed(0)}>Reset</Button>
            </div>
            <div>
              <Label>Above 12 picks it becomes a bar (20 picks, 8 left)</Label>
              <PicksMeter total={20} used={12} />
            </div>
          </div>
        </Panel>
      </Section>

      <Section id="sg-patrol" title="Patrol timer">
        <Panel>
          <div className="flex flex-wrap items-start gap-x-8 gap-y-5">
            <div><Label>Calm, 08:42</Label><PatrolTimer seconds={522} /></div>
            <div><Label>Under 60 s, 00:59</Label><PatrolTimer seconds={59} /></div>
            <div><Label>Under 30 s, 00:29</Label><PatrolTimer seconds={29} /></div>
            <div><Label>Time up, 00:00</Label><PatrolTimer seconds={0} /></div>
          </div>
          <div className="mt-6"><Label>Live countdown</Label><PatrolDemo /></div>
        </Panel>
      </Section>

      <Section id="sg-attempts" title="Attempts pips">
        <Panel>
          <div className="flex flex-wrap items-center gap-6">
            <AttemptsPips total={3} used={usedAttempts} />
            <div className="flex gap-3">
              <Button size="sm" onClick={() => setUsedAttempts((value) => Math.min(3, value + 1))}>Wrong guess</Button>
              <Button size="sm" variant="quiet" onClick={() => setUsedAttempts(0)}>Reset</Button>
            </div>
          </div>
        </Panel>
      </Section>

      <Section id="sg-wards" title="Ward charms">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {WARDS.map((ward) => (
            <WardCharm
              key={ward.id}
              name={ward.name}
              effect={ward.effect}
              icon={ward.icon}
              on={wards[ward.id]}
              onChange={(on) => setWards((current) => ({ ...current, [ward.id]: on }))}
            />
          ))}
        </div>
        <div className="mt-6 max-w-[240px]">
          <Label>Disabled</Label>
          <WardCharm name="Stonewall" effect="Refuses any question about the key" icon={WARDS[0]?.icon} on={false} onChange={() => undefined} disabled />
        </div>
      </Section>

      <Section id="sg-lock" title="Lock type cards">
        <LockTypeGroup value={lock} onChange={setLock} />
      </Section>

      <Section id="sg-avatar" title="Warden avatar">
        <Panel>
          <Label>Moods, 96 px. Talking alternates its mouth every 140 ms.</Label>
          <div className="flex flex-wrap items-end gap-6">
            {moods.map((value) => (
              <div key={value} className="text-center">
                <WardenAvatar seed="bolt-the-guard" mood={value} size={96} label={`Bolt, ${value}`} />
                <p className="t-small mt-2 text-chalk-dim">{value[0]?.toUpperCase()}{value.slice(1)}</p>
              </div>
            ))}
          </div>
          <div className="mt-8">
            <Label>Sizes 32, 48, 96, 192 and a Crew ring</Label>
            <div className="flex flex-wrap items-end gap-6">
              <WardenAvatar seed="bolt-the-guard" size={32} label="Bolt, small" />
              <WardenAvatar seed="bolt-the-guard" size={48} label="Bolt" />
              <WardenAvatar seed="bolt-the-guard" size={96} label="Bolt" />
              <WardenAvatar seed="bolt-the-guard" size={192} label="Bolt" />
              <WardenAvatar seed="the-charmer" size={96} crew label="The Charmer" />
            </div>
          </div>
          <div className="mt-8">
            <Label>Different seeds</Label>
            <div className="flex flex-wrap gap-4">
              {['mira', 'cinder', 'quill', 'moss', 'ember', 'flint'].map((seed) => (
                <WardenAvatar key={seed} seed={seed} size={48} label={seed} />
              ))}
            </div>
          </div>
        </Panel>
      </Section>

      <Section id="sg-vault" title="Vault door">
        <Panel>
          <div className="flex flex-col gap-5">
            <div>
              <Label>State</Label>
              <Tabs label="Vault state" value={vault} onValueChange={(value) => setVault(value as VaultState)} items={vaultStates.map((value) => ({ value, label: value }))} />
            </div>
            <div>
              <Label>Mood (auto follows the state)</Label>
              <Tabs label="Warden mood" value={vaultMood} onValueChange={(value) => setVaultMood(value as AvatarMood | 'auto')} items={[{ value: 'auto', label: 'auto' }, ...moods.map((value) => ({ value, label: value }))]} />
            </div>
            <div>
              <Label>Times cracked: {dents}</Label>
              <div className="flex flex-wrap gap-2">
                {[0, 3, 5, 12, 31].map((value) => (
                  <Button key={value} size="sm" variant={dents === value ? 'primary' : 'secondary'} onClick={() => setDents(value)}>{value}</Button>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap items-end gap-8">
              <div><Label>280 px, Heist</Label><VaultDoor size={280} state={vault} seed="bolt-the-guard" mood={vaultMood === 'auto' ? undefined : vaultMood} dents={dents} /></div>
              <div><Label>200 px, Forge</Label><VaultDoor size={200} state={vault} seed="bolt-the-guard" mood={vaultMood === 'auto' ? undefined : vaultMood} dents={dents} /></div>
              <div><Label>160 px, Board</Label><VaultDoor size={160} state={vault} seed="bolt-the-guard" mood={vaultMood === 'auto' ? undefined : vaultMood} dents={dents} /></div>
              <div><Label>140 px, Heist on mobile</Label><VaultDoor size={140} state={vault} seed="bolt-the-guard" mood={vaultMood === 'auto' ? undefined : vaultMood} dents={dents} /></div>
            </div>
            <div>
              <Label>All five states side by side</Label>
              <div className="flex flex-wrap gap-6">
                {vaultStates.map((value) => (
                  <div key={value} className="text-center">
                    <VaultDoor size={140} state={value} seed="mira" />
                    <p className="t-small mt-1 text-chalk-dim">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Panel>
      </Section>
    </>
  );
}
