import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { Key } from 'lucide-react';
import { ApiError, api, errorMessage, isErrorCode } from '../api';
import type { Limits, LockTypeValue, Outcome } from '../api';
import { ChatLog, Composer, KeyDial } from '../components/chat';
import type { ChatItem } from '../components/chat';
import { AttemptsPips, PatrolTimer, PicksMeter } from '../components/game';
import { VaultDoor } from '../components/vault/VaultDoor';
import { Button, Dialog, EmptyState, LockChip, Skeleton, Stamp } from '../components/ui';
import { forgetHeist, loadHeist, saveHeist } from '../lib/heistStore';
import { keyLengthFromHint } from '../lib/keyHint';
import { useMediaQuery } from '../lib/useMediaQuery';

/** The Warden's opening line. The interface shows it; it is never saved or sent to the model. */
const GREETING: ChatItem = { id: 'greeting', kind: 'warden', text: 'Halt. Who goes there?' };

interface HeistInfo {
  guardName: string;
  lookSeed: string;
  lockType: LockTypeValue;
  keyFormatHint: string | null;
  limits: Limits;
}

const NOTE_FAILED = "The line went dead. That message didn't count. Try again.";
const NOTE_COOLDOWN = 'Easy there. Wait a few seconds between messages.';
const NOTE_TIME = "Time's up. The patrol is here. The Warden held.";

/** Screen 5: the heist. Chat with the Warden and try to make it spill the key. */
export function Heist() {
  const { sessionId = '' } = useParams();
  const navigate = useNavigate();
  const { online } = useOutletContext<{ online: boolean }>();
  const desktop = useMediaQuery('(min-width: 1024px)');

  const [info, setInfo] = useState<HeistInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [items, setItems] = useState<ChatItem[]>([GREETING]);
  const [picksLeft, setPicksLeft] = useState(0);
  const [attemptsLeft, setAttemptsLeft] = useState(0);
  const [deadline, setDeadline] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [thinking, setThinking] = useState(false);
  const [pendingPick, setPendingPick] = useState(false);
  const [text, setText] = useState('');
  const [cooldownStartedAt, setCooldownStartedAt] = useState<number | null>(null);
  const [ended, setEnded] = useState<Outcome | null>(null);
  const [rateNote, setRateNote] = useState<string | undefined>();
  const [dialOpen, setDialOpen] = useState(false);
  const [guessing, setGuessing] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const counter = useRef(0);

  const nextId = (prefix: string) => `${prefix}-${(counter.current += 1)}`;

  const applyMetrics = useCallback((remaining: number, picks: number, attempts: number) => {
    setPicksLeft(picks);
    setAttemptsLeft(attempts);
    setDeadline(Date.now() + remaining * 1000);
    setSeconds(remaining);
  }, []);

  /** Loads the authoritative state, so a reload or a second tab resumes the same heist. */
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const state = await api.attackState(sessionId);
        if (cancelled) return;
        if (state.ended) {
          navigate(`/report/${sessionId}`, { replace: true });
          return;
        }
        const stored = loadHeist(sessionId);
        setInfo({
          guardName: state.guard.name,
          lookSeed: state.guard.lookSeed,
          lockType: state.guard.lockType,
          keyFormatHint: state.guard.keyFormatHint,
          limits: state.limits,
        });
        if (!stored) {
          saveHeist({
            sessionId,
            guardId: state.guard.id,
            guardName: state.guard.name,
            lookSeed: state.guard.lookSeed,
            lockType: state.guard.lockType,
            keyFormatHint: state.guard.keyFormatHint,
            limits: state.limits,
            startedAt: state.startedAt,
          });
        }
        setItems([
          GREETING,
          ...state.transcript.map((turn): ChatItem => ({ id: `t${turn.turn}-${turn.role}`, kind: turn.role === 'attacker' ? 'cracker' : 'warden', text: turn.content })),
        ]);
        applyMetrics(state.serverTimeRemaining, state.picksLeft, state.attemptsLeft);
      } catch (failure) {
        if (!cancelled) setLoadError(isErrorCode(failure, 'NOT_FOUND') ? "That vault doesn't exist. It may have been taken down." : errorMessage(failure));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId, navigate, applyMetrics]);

  const finish = useCallback((outcome: Outcome) => {
    setEnded(outcome);
    setThinking(false);
    setDialOpen(false);
    forgetHeist(sessionId);
    if (outcome === 'expired') setItems((current) => [...current, { id: 'time-up', kind: 'note', text: NOTE_TIME }]);
  }, [sessionId]);

  /** The countdown on screen is cosmetic: the server decides, and the next reply corrects it. */
  useEffect(() => {
    if (!info || ended) return;
    const timer = window.setInterval(() => {
      const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setSeconds(left);
      if (left === 0) {
        window.clearInterval(timer);
        void api.attackState(sessionId).then((state) => finish(state.ended ? (state.outcome ?? 'expired') : 'expired'), () => finish('expired'));
      }
    }, 500);
    return () => window.clearInterval(timer);
  }, [info, ended, deadline, sessionId, finish]);

  const send = async (message: string) => {
    setRateNote(undefined);
    const id = nextId('c');
    setItems((current) => [...current, { id, kind: 'cracker', text: message }]);
    setText('');
    setThinking(true);
    setPendingPick(true);
    const undo = (note: string) => {
      setItems((current) => [...current.filter((item) => item.id !== id), { id: nextId('n'), kind: 'note', text: note }]);
      setText(message);
    };
    try {
      const result = await api.sendMessage(sessionId, message);
      applyMetrics(result.serverTimeRemaining, result.picksLeft, result.attemptsLeft);
      if (result.events.some((event) => event.type === 'turn_errored')) {
        undo(NOTE_FAILED);
      } else {
        if (result.reply !== null) {
          const reply = result.reply;
          setItems((current) => [...current, { id: nextId('w'), kind: 'warden', text: reply }]);
        }
        setCooldownStartedAt(Date.now());
      }
      if (result.ended) finish(result.outcome ?? 'held');
    } catch (failure) {
      if (isErrorCode(failure, 'SESSION_ENDED')) {
        finish('expired');
      } else if (failure instanceof ApiError && failure.code === 'COOLDOWN') {
        const retry = (failure.details as { retryAfterSeconds?: number } | undefined)?.retryAfterSeconds ?? 0;
        undo(NOTE_COOLDOWN);
        setRateNote(NOTE_COOLDOWN);
        if (retry > 0) setCooldownStartedAt(Date.now() - ((info?.limits.cooldownSeconds ?? 6) - retry) * 1000);
      } else if (isErrorCode(failure, 'MESSAGE_RATE_LIMIT')) {
        undo(NOTE_COOLDOWN);
        setRateNote(NOTE_COOLDOWN);
      } else {
        undo(NOTE_FAILED);
      }
    } finally {
      setThinking(false);
      setPendingPick(false);
    }
  };

  const guess = async (value: string) => {
    setGuessing(true);
    try {
      const result = await api.submitGuess(sessionId, value);
      setAttemptsLeft(result.attemptsLeft);
      setPicksLeft(result.picksLeft);
      if (result.ended) finish(result.outcome ?? (result.correct ? 'cracked' : 'held'));
    } catch (failure) {
      if (isErrorCode(failure, 'SESSION_ENDED')) finish('expired');
      else setItems((current) => [...current, { id: nextId('n'), kind: 'note', text: errorMessage(failure) }]);
    } finally {
      setGuessing(false);
    }
  };

  const picksUsed = info ? info.limits.picks - picksLeft + (pendingPick ? 1 : 0) : 0;
  const attemptsUsed = info ? info.limits.wrongAttempts - attemptsLeft : 0;
  const keyLength = useMemo(() => keyLengthFromHint(info?.keyFormatHint), [info?.keyFormatHint]);
  const doorState = ended === 'cracked' ? 'open' : ended ? 'bolted' : 'sealed';
  const mood = thinking ? 'thinking' : undefined;

  if (loadError) {
    return <EmptyState title={loadError} actionLabel="Back to the Board" onAction={() => navigate('/board')} />;
  }
  if (!info) {
    return <div className="flex min-h-[60dvh] items-center justify-center"><Skeleton size={160} label="Opening the vault" /></div>;
  }

  const meters = (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
      <div><p className="t-small mb-1 font-bold">Picks</p><PicksMeter total={info.limits.picks} used={picksUsed} /></div>
      <div><p className="t-small mb-1 font-bold">Patrol</p><PatrolTimer seconds={seconds} /></div>
      <div><p className="t-small mb-1 font-bold">Attempts</p><AttemptsPips total={info.limits.wrongAttempts} used={attemptsUsed} /></div>
    </div>
  );

  const hint = info.keyFormatHint && (
    <p className="lock-ticket !mt-0 !text-base">The key: {info.keyFormatHint.charAt(0).toLowerCase()}{info.keyFormatHint.slice(1)}</p>
  );

  const crackButton = (
    <Button size="lg" variant={desktop ? 'primary' : 'secondary'} leadingIcon={<Key size={20} />} disabled={Boolean(ended) || !online} onClick={() => setDialOpen(true)} aria-label="Crack the key">
      {desktop ? 'Crack the key' : 'Crack'}
    </Button>
  );

  const composer = ended ? (
    <div className="flex flex-col items-start gap-3">
      <Stamp kind={ended === 'cracked' ? 'cracked' : 'held'} size="sm" />
      <Button size="lg" onClick={() => navigate(`/report/${sessionId}`)}>See the report</Button>
    </div>
  ) : (
    <Composer
      value={text}
      onChange={setText}
      onSend={(message) => void send(message)}
      maxLength={info.limits.maxMessageLength}
      disabled={thinking || !online}
      cooldownSeconds={info.limits.cooldownSeconds}
      cooldownStartedAt={cooldownStartedAt}
      note={rateNote}
      secondaryAction={desktop ? undefined : crackButton}
      className="sticky bottom-0 bg-transparent pb-[env(safe-area-inset-bottom)]"
    />
  );

  const chat = (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <ChatLog items={items} wardenSeed={info.lookSeed} wardenName={info.guardName} thinking={thinking} className="min-h-[320px] flex-1" />
      {composer}
    </div>
  );

  return (
    <>
      {desktop ? (
        <div className="grid h-[calc(100dvh-64px)] grid-cols-[320px_1fr] gap-8">
          <aside className="flex flex-col items-start gap-4">
            <VaultDoor size={280} state={doorState} seed={info.lookSeed} mood={mood} label={`${info.guardName}'s vault`} />
            <h1 className="t-h2">{info.guardName}</h1>
            <div className="flex flex-wrap items-center gap-2"><LockChip lockType={info.lockType} /></div>
            {hint}
            <div className="flex flex-col gap-4">{meters}</div>
            {crackButton}
            <Button variant="quiet" onClick={() => setLeaveOpen(true)}>Leave heist</Button>
          </aside>
          {chat}
        </div>
      ) : (
        <div className="flex min-h-[calc(100dvh-32px)] flex-col gap-3">
          <div className="flex items-center gap-4">
            <VaultDoor size={112} state={doorState} seed={info.lookSeed} mood={mood} label={`${info.guardName}'s vault`} />
            <div className="flex min-w-0 flex-col items-start gap-2">
              <h1 className="t-h2">{info.guardName}</h1>
              <LockChip lockType={info.lockType} />
              {hint}
            </div>
          </div>
          {meters}
          {chat}
          <Button variant="quiet" size="sm" className="self-start" onClick={() => setLeaveOpen(true)}>Leave heist</Button>
        </div>
      )}

      <KeyDial
        open={dialOpen}
        onOpenChange={setDialOpen}
        lockType={info.lockType}
        keyLength={keyLength}
        attemptsTotal={info.limits.wrongAttempts}
        attemptsLeft={attemptsLeft}
        submitting={guessing}
        onSubmit={(value) => void guess(value)}
      />

      <Dialog
        open={leaveOpen}
        onOpenChange={setLeaveOpen}
        title="Leave the heist?"
        description="The patrol keeps ticking and used picks stay used."
        footer={(
          <>
            <Button variant="quiet" onClick={() => setLeaveOpen(false)}>Stay</Button>
            <Button variant="danger" onClick={() => navigate('/board')}>Leave</Button>
          </>
        )}
      />
    </>
  );
}
