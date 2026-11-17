import { useState } from 'react';
import { api, errorMessage } from '../api';
import { Button, Dialog, Field, Slider, Switch, notify } from '../components/ui';
import { useMotionStore, useSoundStore } from '../fx/stores';
import { useAuth } from './auth';

const CALLSIGN = /^[A-Za-z0-9_]{3,16}$/;

const CREDITS = [
  'Icons: Game Icons (game-icons.net), licensed CC BY 3.0. Utility icons from Lucide.',
  "Warden avatars: DiceBear's Bottts Neutral, a remix of Bottts by Pablo Stanley, free for personal and commercial use.",
  'Sounds: generated with ZzFX, plus CC0 audio from Kenney. Thank you, Kenney.',
  'Fonts: Lilita One and Nunito, both under the SIL Open Font License.',
];

/** Sound, motion, callsign and sign out, in one sheet. Credits are one link at the bottom. */
export function Settings({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { profile, setProfile, signOut } = useAuth();
  const { muted, volume, setMuted, setVolume } = useSoundStore();
  const { reduceMotion, setReduceMotion } = useMotionStore();
  const [callsign, setCallsign] = useState(profile?.callsign ?? '');
  const [error, setError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  const [credits, setCredits] = useState(false);

  const save = async () => {
    if (!CALLSIGN.test(callsign)) {
      setError('Use 3 to 16 letters, digits or underscores.');
      return;
    }
    setError(undefined);
    setSaving(true);
    try {
      setProfile(await api.updateCallsign(callsign));
      notify('success', 'Saved.');
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange} title="Settings" footer={<Button variant="quiet" onClick={() => onOpenChange(false)}>Close</Button>}>
        <div className="flex flex-col gap-5">
          <Switch id="settings-sound" label="Sound" description="Off until your first tap." checked={!muted} onCheckedChange={(on) => setMuted(!on)} />
          <div>
            <p className="t-body mb-1 font-bold">Volume</p>
            <Slider label="Volume" min={0} max={1} step={0.05} value={volume} valueText={`${Math.round(volume * 100)} percent`} onValueChange={setVolume} disabled={muted} />
          </div>
          <Switch id="settings-motion" label="Reduce motion" description="No flashes, shakes or confetti." checked={reduceMotion} onCheckedChange={setReduceMotion} />
          <form
            className="flex items-start gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              void save();
            }}
          >
            <Field label="Callsign" value={callsign} onChange={(event) => setCallsign(event.target.value)} error={error} autoComplete="off" className="min-w-0 flex-1" />
            <Button type="submit" variant="secondary" loading={saving} className="mt-7">Save</Button>
          </form>
          <div className="flex items-center justify-between gap-3">
            <Button variant="danger" onClick={() => { onOpenChange(false); void signOut(); }}>Sign out</Button>
            <Button variant="quiet" size="sm" onClick={() => setCredits(true)}>Credits</Button>
          </div>
        </div>
      </Dialog>
      <Dialog open={credits} onOpenChange={setCredits} title="Credits" footer={<Button onClick={() => setCredits(false)}>Close</Button>}>
        <ul className="flex flex-col gap-3">
          {CREDITS.map((line) => <li key={line} className="t-small">{line}</li>)}
        </ul>
      </Dialog>
    </>
  );
}
