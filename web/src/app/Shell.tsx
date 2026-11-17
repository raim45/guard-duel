import { useEffect, useState } from 'react';
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { FolderOpen, Hammer, LayoutGrid, Lock, Volume2, VolumeX } from 'lucide-react';
import { Button, Chip, Dialog, Skeleton } from '../components/ui';
import { useSoundStore } from '../fx/stores';
import { cx } from '../lib/cx';
import { useAuth } from './auth';
import { Settings } from './Settings';

const NAV = [
  { to: '/board', label: 'Board', icon: LayoutGrid },
  { to: '/forge', label: 'Forge', icon: Hammer },
  { to: '/vaults', label: 'My Vaults', icon: Lock },
  { to: '/cases', label: 'Case files', icon: FolderOpen },
] as const;

function Wordmark() {
  return (
    <Link to="/board" className="flex items-center gap-2 font-display text-[26px] leading-none tracking-[0.01em] text-brass">
      <svg width="22" height="26" viewBox="0 0 22 26" aria-hidden="true">
        <path d="M11 1 C6 1 3 4.5 3 9 c0 3 1.6 5 3.6 6.4 L5 25 h12 l-1.6-9.6 C17.4 14 19 12 19 9 19 4.5 16 1 11 1 Z" fill="var(--color-brass)" stroke="var(--color-ink)" strokeWidth="2" strokeLinejoin="round" />
        <circle cx="11" cy="9" r="2.6" fill="var(--color-ink)" />
      </svg>
      Guard Duel
    </Link>
  );
}

function useOnline(): boolean {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);
  return online;
}

export function SpeakerButton() {
  const { muted, setMuted } = useSoundStore();
  return (
    <Button
      variant="secondary"
      size="sm"
      className="!min-w-0 !px-3"
      aria-label={muted ? 'Turn sound on' : 'Turn sound off'}
      aria-pressed={!muted}
      onClick={() => setMuted(!muted)}
    >
      {muted ? <VolumeX size={20} aria-hidden="true" /> : <Volume2 size={20} aria-hidden="true" />}
    </Button>
  );
}

function TopBar({ onSettings }: { onSettings: () => void }) {
  const profile = useAuth((state) => state.profile);
  return (
    <header className="sticky top-0 z-10 border-b-[3px] border-ink bg-world">
      <div className="mx-auto flex h-14 max-w-[1200px] items-center gap-4 px-4 md:h-16 md:px-6">
        <Wordmark />
        <nav aria-label="Main" className="ml-4 hidden items-center gap-2 md:flex">
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to} className={({ isActive }) => cx('tab', 'inline-flex items-center', isActive && 'tab-active')} data-state={undefined}>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <SpeakerButton />
          <button type="button" onClick={onSettings} className="rounded-full" aria-label={`Settings, signed in as ${profile?.callsign ?? 'player'}`}>
            <Chip variant="stat" className="!h-10 !px-4 !text-base">{profile?.callsign ?? 'player'}</Chip>
          </button>
        </div>
      </div>
    </header>
  );
}

function BottomBar() {
  return (
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-10 border-t-[3px] border-ink bg-world pb-[env(safe-area-inset-bottom)] md:hidden">
      <ul className="mx-auto grid max-w-[1200px] grid-cols-4">
        {NAV.map((item) => (
          <li key={item.to}>
            <NavLink to={item.to} className={({ isActive }) => cx('bottom-tab', isActive && 'bottom-tab-active')}>
              <item.icon size={22} aria-hidden="true" />
              <span className="t-smallest font-extrabold">{item.label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function AppLoading() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4">
      <Skeleton size={140} label="Opening up" />
      <p className="t-body text-chalk-dim">Opening up...</p>
    </div>
  );
}

/** Signed-out guard: sends visitors to the Gate and keeps the signed-out dialog in one place. */
function useRequireAuth() {
  const status = useAuth((state) => state.status);
  const sessionEnded = useAuth((state) => state.sessionEnded);
  return { status, sessionEnded };
}

function SessionEndedDialog() {
  const sessionEnded = useAuth((state) => state.sessionEnded);
  const dismiss = useAuth((state) => state.dismissSessionEnded);
  const navigate = useNavigate();
  return (
    <Dialog
      open={sessionEnded}
      onOpenChange={(open) => { if (!open) dismiss(); }}
      title="Your session ended."
      description="Sign in again."
      footer={<Button onClick={() => { dismiss(); navigate('/gate'); }}>Sign in</Button>}
    />
  );
}

/** The main app frame: top bar, mobile bottom bar, offline banner and settings. */
export function AppShell() {
  const { status } = useRequireAuth();
  const online = useOnline();
  const [settings, setSettings] = useState(false);
  const location = useLocation();

  if (status === 'loading') return <AppLoading />;
  if (status === 'signedOut') return (
    <>
      <Navigate to="/gate" replace state={{ from: location.pathname }} />
      <SessionEndedDialog />
    </>
  );

  return (
    <div className="min-h-dvh pb-24 md:pb-0">
      <TopBar onSettings={() => setSettings(true)} />
      {!online && (
        <p role="status" className="bg-coral px-4 py-2 text-center font-bold text-ink">You're offline. Messages can't be sent.</p>
      )}
      <main id="main" className="mx-auto w-full max-w-[1200px] px-4 py-6 md:px-6 md:py-8">
        <Outlet />
      </main>
      <BottomBar />
      <Settings open={settings} onOpenChange={setSettings} />
      <SessionEndedDialog />
    </div>
  );
}

/** Heist mode: navigation is hidden so nothing distracts from the vault. */
export function HeistFrame() {
  const { status } = useRequireAuth();
  const online = useOnline();
  const location = useLocation();
  if (status === 'loading') return <AppLoading />;
  if (status === 'signedOut') return (
    <>
      <Navigate to="/gate" replace state={{ from: location.pathname }} />
      <SessionEndedDialog />
    </>
  );
  return (
    <div className="relative min-h-dvh">
      <div className="heist-vignette fixed inset-0 -z-0" aria-hidden="true" />
      {!online && (
        <p role="status" className="relative z-10 bg-coral px-4 py-2 text-center font-bold text-ink">You're offline. Messages can't be sent.</p>
      )}
      <main id="main" className="relative z-10 mx-auto w-full max-w-[1200px] px-4 py-4 md:px-6 md:py-8">
        <Outlet context={{ online }} />
      </main>
      <SessionEndedDialog />
    </div>
  );
}
