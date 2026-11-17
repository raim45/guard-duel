import { useState } from 'react';
import type { ReactNode } from 'react';
import { Key } from 'lucide-react';
import {
  Button,
  Chip,
  Dialog,
  EmptyState,
  LockChip,
  Panel,
  Skeleton,
  Stamp,
  StatTile,
  StatusChip,
  TabPanel,
  Tabs,
  ToastCard,
  notify,
} from '../components/ui';
import type { ButtonSize, ButtonVariant } from '../components/ui';

const palette = [
  { token: 'ink', hex: '#0C2430', role: 'Outlines and text on bright fills', className: 'bg-ink' },
  { token: 'world', hex: '#17495B', role: 'Page background', className: 'bg-world' },
  { token: 'world-deep', hex: '#10384A', role: 'Recessed areas', className: 'bg-world-deep' },
  { token: 'plate', hex: '#235E73', role: 'Raised panels', className: 'bg-plate' },
  { token: 'plate-hi', hex: '#2E7690', role: 'Panel highlight, hover', className: 'bg-plate-hi' },
  { token: 'chalk', hex: '#EAF4F6', role: 'Main text, paper', className: 'bg-chalk' },
  { token: 'chalk-dim', hex: '#A9C6CE', role: 'Secondary text', className: 'bg-chalk-dim' },
  { token: 'brass', hex: '#FFC53D', role: 'Primary action, active', className: 'bg-brass' },
  { token: 'brass-deep', hex: '#D99A00', role: 'Pressed brass', className: 'bg-brass-deep' },
  { token: 'coral', hex: '#FF6B5B', role: 'Breach, danger', className: 'bg-coral' },
  { token: 'mint', hex: '#4FE3B0', role: 'Held, success', className: 'bg-mint' },
  { token: 'sky', hex: '#6CCBFF', role: 'The Cracker voice, info', className: 'bg-sky' },
  { token: 'grape', hex: '#A58BFF', role: 'Part 2 Post-Mortem only', className: 'bg-grape' },
] as const;

const typeScale = [
  { name: 'Stamp', className: 't-stamp', sample: 'CRACKED' },
  { name: 'H1', className: 't-h1', sample: 'The Board' },
  { name: 'H2', className: 't-h2', sample: 'Bolt, the night guard' },
  { name: 'H3', className: 't-h3', sample: 'Orders and wards' },
  { name: 'Body', className: 't-body', sample: 'Pick a vault. Crack it before the patrol arrives.' },
  { name: 'Chat', className: 't-chat', sample: 'Halt. Who goes there?' },
  { name: 'Small', className: 't-small', sample: 'Attacks only ever target guards inside this game.' },
  { name: 'Smallest allowed', className: 't-smallest', sample: 'Smallest text the design allows' },
] as const;

const variants: ButtonVariant[] = ['primary', 'secondary', 'danger', 'quiet'];
const sizes: ButtonSize[] = ['sm', 'md', 'lg'];

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

function ButtonStates({ variant }: { variant: ButtonVariant }) {
  return (
    <div className="flex flex-wrap items-start gap-x-6 gap-y-5">
      <div><Label>Default</Label><Button variant={variant}>Start heist</Button></div>
      <div><Label>Hover</Label><Button variant={variant} previewState="hover">Start heist</Button></div>
      <div><Label>Pressed</Label><Button variant={variant} previewState="pressed">Start heist</Button></div>
      <div><Label>Focus</Label><Button variant={variant} previewState="focus">Start heist</Button></div>
      <div><Label>Disabled</Label><Button variant={variant} disabled>Start heist</Button></div>
      <div><Label>Loading</Label><Button variant={variant} loading>Start heist</Button></div>
      <div><Label>Loading with icon</Label><Button variant={variant} loading leadingIcon={<Key size={20} />}>Crack the key</Button></div>
      <div><Label>With icon</Label><Button variant={variant} leadingIcon={<Key size={20} />}>Crack the key</Button></div>
    </div>
  );
}

export function Styleguide() {
  const [tab, setTab] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [longDialogOpen, setLongDialogOpen] = useState(false);
  const [clicks, setClicks] = useState(0);

  return (
    <main className="mx-auto w-full max-w-[1200px] px-4 py-8 md:px-6">
      <h1 className="t-h1">Styleguide</h1>
      <p className="t-body text-chalk-dim">Phases D0 and D1: tokens, type, atmosphere and primitives.</p>

      <Section id="sg-palette" title="Palette">
        <ul className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {palette.map((swatch) => (
            <li key={swatch.token} className="panel p-3">
              <div className={`${swatch.className} h-16 rounded-[14px] border-[3px] border-ink`} />
              <p className="t-h3 mt-3">{swatch.token}</p>
              <p className="t-small text-chalk-dim">{swatch.hex}</p>
              <p className="t-small text-chalk-dim">{swatch.role}</p>
            </li>
          ))}
        </ul>
      </Section>

      <Section id="sg-type" title="Type scale">
        <Panel>
          <div className="flex flex-col gap-4">
            {typeScale.map((style) => (
              <div key={style.name} className="flex flex-col gap-1 border-b-2 border-ink/40 pb-4 last:border-b-0 last:pb-0">
                <p className="t-small text-chalk-dim">{style.name}</p>
                <p className={style.className}>{style.sample}</p>
              </div>
            ))}
          </div>
        </Panel>
      </Section>

      <Section id="sg-atmosphere" title="Atmosphere">
        <div className="grid gap-6 md:grid-cols-2">
          <Panel title="Raised panel">
            <p className="t-body text-chalk-dim">Painted metal with an ink outline, a top highlight and four rivets.</p>
          </Panel>
          <div className="inset p-4 md:p-6">
            <h3 className="t-h3">Recessed area</h3>
            <p className="t-body text-chalk-dim">Used for the chat log and inputs.</p>
          </div>
          <div className="relative overflow-hidden rounded-[22px] border-[3px] border-ink bg-world md:col-span-2">
            <div className="heist-vignette absolute inset-0" />
            <div className="relative p-6">
              <h3 className="t-h3">Heist vignette</h3>
              <p className="t-body text-chalk-dim">Sits behind the content on the Heist screen only.</p>
            </div>
          </div>
        </div>
      </Section>

      <Section id="sg-buttons" title="Button">
        <div className="flex flex-col gap-8">
          {variants.map((variant) => (
            <Panel key={variant} title={`${variant[0]?.toUpperCase()}${variant.slice(1)}`}>
              <ButtonStates variant={variant} />
            </Panel>
          ))}
          <Panel title="Sizes">
            <div className="flex flex-wrap items-end gap-6">
              {sizes.map((size) => (
                <div key={size}>
                  <Label>{size === 'sm' ? 'Small, 40' : size === 'md' ? 'Medium, 48' : 'Large, 56'}</Label>
                  <Button size={size} onClick={() => setClicks((count) => count + 1)}>Send</Button>
                </div>
              ))}
              <div>
                <Label>Clicked {clicks} times</Label>
                <Button variant="secondary" onClick={() => setClicks(0)}>Reset</Button>
              </div>
            </div>
          </Panel>
        </div>
      </Section>

      <Section id="sg-panels" title="Panel">
        <div className="grid gap-6 md:grid-cols-3">
          <Panel title="Raised">
            <p className="t-body">Corner rivets appear on raised panels wider than 320 px.</p>
          </Panel>
          <Panel variant="inset" title="Inset">
            <p className="t-body">Recessed area for the chat log and inputs.</p>
          </Panel>
          <Panel variant="paper" title="Paper">
            <p className="t-body">For the Orders editor and the report sheet.</p>
          </Panel>
          <div className="max-w-[300px]">
            <Panel title="Narrow raised, no rivets">
              <p className="t-small">Under 320 px wide.</p>
            </Panel>
          </div>
          <Panel title="Panel with icon" icon={<Key size={22} />}>
            <p className="t-body">The title row takes an optional icon at the left.</p>
          </Panel>
        </div>
      </Section>

      <Section id="sg-chips" title="Chip">
        <Panel>
          <div className="flex flex-wrap items-center gap-3">
            <LockChip lockType="combo" />
            <LockChip lockType="passphrase" />
            <LockChip lockType="pin" />
            <StatusChip published={false} />
            <StatusChip published />
            <Chip variant="stat">Cracked 3 of 41 heists</Chip>
          </div>
        </Panel>
      </Section>

      <Section id="sg-stamps" title="Stamp">
        <Panel>
          <div className="flex flex-wrap items-center gap-8 py-4">
            <Stamp kind="cracked" />
            <Stamp kind="held" />
            <Stamp kind="posted" />
            <Stamp kind="draft" />
          </div>
        </Panel>
      </Section>

      <Section id="sg-stats" title="Stat tile">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatTile value="41" label="Heists" />
          <StatTile value="3" label="Cracked" />
          <StatTile value="38" label="Held" />
          <StatTile value="6.4" label="Average picks to crack" />
        </div>
      </Section>

      <Section id="sg-tabs" title="Tabs">
        <Panel>
          <Tabs
            label="Sort the Board"
            value={tab}
            onValueChange={setTab}
            items={[
              { value: 'all', label: 'Freshest' },
              { value: 'tough', label: 'Toughest' },
              { value: 'cracked', label: 'Most cracked' },
              { value: 'off', label: 'Disabled', disabled: true },
            ]}
          >
            <TabPanel value="all" className="t-body mt-3 text-chalk-dim">Freshest is selected.</TabPanel>
            <TabPanel value="tough" className="t-body mt-3 text-chalk-dim">Toughest is selected.</TabPanel>
            <TabPanel value="cracked" className="t-body mt-3 text-chalk-dim">Most cracked is selected.</TabPanel>
          </Tabs>
        </Panel>
      </Section>

      <Section id="sg-toasts" title="Toast">
        <div className="grid gap-4 md:grid-cols-3">
          <ToastCard kind="success" message="Posted. Your Warden is on the Board." />
          <ToastCard kind="error" message="Something broke on our side. Try again in a moment." />
          <ToastCard kind="info" message="Heists are paused for now." />
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button variant="secondary" onClick={() => notify('success', 'Saved.')}>Show success</Button>
          <Button variant="secondary" onClick={() => notify('error', 'Reported failed. Try again.')}>Show error</Button>
          <Button variant="secondary" onClick={() => notify('info', 'Reported.')}>Show info</Button>
        </div>
      </Section>

      <Section id="sg-dialog" title="Dialog">
        <Panel>
          <p className="t-body mb-4 text-chalk-dim">Centered from 768 px, a bottom sheet with a handle below. Esc closes it and focus is trapped.</p>
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => setDialogOpen(true)}>Open dialog</Button>
            <Button variant="secondary" onClick={() => setLongDialogOpen(true)}>Open long dialog</Button>
          </div>
        </Panel>
        <Dialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          title="Leave the heist?"
          description="The patrol keeps ticking and used picks stay used."
          footer={(
            <>
              <Button variant="quiet" onClick={() => setDialogOpen(false)}>Stay</Button>
              <Button variant="danger" onClick={() => setDialogOpen(false)}>Leave</Button>
            </>
          )}
        />
        <Dialog
          open={longDialogOpen}
          onOpenChange={setLongDialogOpen}
          title="A dialog with long content"
          description="The content scrolls inside the sheet instead of the page."
          footer={<Button onClick={() => setLongDialogOpen(false)}>Close</Button>}
        >
          {Array.from({ length: 14 }, (_, index) => (
            <p key={index} className="t-body mb-3">Line {index + 1}. The sheet never grows past 90% of the screen height.</p>
          ))}
        </Dialog>
      </Section>

      <Section id="sg-skeleton" title="Skeleton">
        <p className="t-body mb-4 text-chalk-dim">Shown on the page background, where plate reads as a quiet outline.</p>
        <div className="flex flex-wrap items-center gap-8">
          <Skeleton size={160} label="Loading a vault" />
          <Skeleton size={96} label="Loading a Warden" />
        </div>
      </Section>

      <Section id="sg-empty" title="Empty state">
        <Panel>
          <EmptyState
            title="No Wardens yet. The Forge is open."
            body="Write a Warden, set its orders and post it to the Board."
            actionLabel="Build a Warden"
            onAction={() => notify('info', 'The Forge arrives in the screens phase.')}
          />
        </Panel>
      </Section>
    </main>
  );
}
