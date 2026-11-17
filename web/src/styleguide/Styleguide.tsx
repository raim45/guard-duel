import type { ReactNode } from 'react';

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

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section className="mt-12" aria-labelledby={id}>
      <h2 id={id} className="t-h2 mb-4">{title}</h2>
      {children}
    </section>
  );
}

export function Styleguide() {
  return (
    <main className="mx-auto w-full max-w-[1200px] px-4 py-8 md:px-6">
      <h1 className="t-h1">Styleguide</h1>
      <p className="t-body text-chalk-dim">Phase D0: tokens, type and atmosphere. Components arrive in D1 to D3.</p>

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
        <div className="panel rivets flex flex-col gap-4 p-4 md:p-6">
          {typeScale.map((style) => (
            <div key={style.name} className="flex flex-col gap-1 border-b-2 border-ink/40 pb-4 last:border-b-0 last:pb-0">
              <p className="t-small text-chalk-dim">{style.name}</p>
              <p className={style.className}>{style.sample}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section id="sg-atmosphere" title="Atmosphere">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="panel rivets p-4 md:p-6">
            <h3 className="t-h3">Raised panel</h3>
            <p className="t-body text-chalk-dim">Painted metal with an ink outline, a top highlight and four rivets.</p>
          </div>
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
    </main>
  );
}
