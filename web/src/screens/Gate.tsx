import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { api, errorMessage, isErrorCode } from '../api';
import { useAuth } from '../app/auth';
import { VaultDoor } from '../components/vault/VaultDoor';
import { Button, Field, Panel, Tabs, notify } from '../components/ui';

type Mode = 'signin' | 'signup';

interface GateForm {
  email: string;
  password: string;
  callsign: string;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CALLSIGN = /^[A-Za-z0-9_]{3,16}$/;

/** Screen 1: sign in or create an account. */
export function Gate() {
  const [mode, setMode] = useState<Mode>('signin');
  const [formError, setFormError] = useState<{ field?: keyof GateForm; message: string } | null>(null);
  const status = useAuth((state) => state.status);
  const setProfile = useAuth((state) => state.setProfile);
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/board';
  const { register, handleSubmit, formState: { errors, isSubmitting }, clearErrors } = useForm<GateForm>({
    defaultValues: { email: '', password: '', callsign: '' },
  });

  if (status === 'signedIn') return <Navigate to={from} replace />;

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      if (mode === 'signin') {
        setProfile(await api.signIn(values.email, values.password));
        navigate(from, { replace: true });
      } else {
        const profile = await api.signUp(values.email, values.password, values.callsign);
        if (profile) {
          setProfile(profile);
          navigate('/board', { replace: true });
        } else {
          notify('info', 'Confirm your email, then sign in.');
          setMode('signin');
        }
      }
    } catch (failure) {
      if (isErrorCode(failure, 'BAD_CREDENTIALS')) setFormError({ field: 'password', message: errorMessage(failure) });
      else if (isErrorCode(failure, 'CALLSIGN_TAKEN')) setFormError({ field: 'callsign', message: errorMessage(failure) });
      else setFormError({ message: errorMessage(failure) });
    }
  });

  const messageFor = (field: keyof GateForm) => errors[field]?.message ?? (formError?.field === field ? formError.message : undefined);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[440px] flex-col items-center justify-center gap-6 px-4 py-10">
      <VaultDoor size={200} state="sealed" label="Vault door" />
      <h1 className="t-h1 text-center">Write a guard that keeps a secret. Then crack everyone else's.</h1>
      <Panel className="w-full">
        <Tabs
          label="Sign in or create an account"
          value={mode}
          onValueChange={(value) => { setMode(value as Mode); setFormError(null); clearErrors(); }}
          items={[{ value: 'signin', label: 'Sign in' }, { value: 'signup', label: 'Create account' }]}
        />
        <form onSubmit={onSubmit} noValidate className="mt-4 flex flex-col gap-4">
          <Field
            label="Email"
            type="email"
            autoComplete="email"
            error={messageFor('email')}
            {...register('email', { required: 'Enter your email.', pattern: { value: EMAIL, message: 'Enter a valid email.' } })}
          />
          <Field
            label="Password"
            type="password"
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            error={messageFor('password')}
            {...register('password', { required: 'Enter your password.', minLength: mode === 'signup' ? { value: 6, message: 'Use at least 6 characters.' } : undefined })}
          />
          {mode === 'signup' && (
            <Field
              label="Callsign"
              autoComplete="username"
              help="3 to 16 letters, digits or underscores."
              error={messageFor('callsign')}
              {...register('callsign', { required: 'Pick a callsign.', pattern: { value: CALLSIGN, message: 'Use 3 to 16 letters, digits or underscores.' } })}
            />
          )}
          {formError && !formError.field && (
            <p role="alert" className="t-small font-bold">{formError.message}</p>
          )}
          <Button type="submit" size="lg" loading={isSubmitting} className="w-full">
            {mode === 'signin' ? 'Sign in' : 'Create account'}
          </Button>
        </form>
      </Panel>
      <p className="t-small text-center text-chalk-dim">Attacks only ever target guards inside this game.</p>
    </main>
  );
}
