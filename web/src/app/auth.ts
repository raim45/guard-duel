import { create } from 'zustand';
import { api } from '../api';
import type { Profile } from '../api';

interface AuthState {
  status: 'loading' | 'signedOut' | 'signedIn';
  profile: Profile | null;
  /** True when a signed-in session was lost, so the app asks the player to sign in again. */
  sessionEnded: boolean;
  init: () => Promise<void>;
  setProfile: (profile: Profile) => void;
  signOut: () => Promise<void>;
  dismissSessionEnded: () => void;
}

let started = false;

export const useAuth = create<AuthState>((set, get) => ({
  status: 'loading',
  profile: null,
  sessionEnded: false,
  async init() {
    if (started) return;
    started = true;
    api.onSignedOut(() => {
      const wasSignedIn = get().status === 'signedIn';
      set({ status: 'signedOut', profile: null, sessionEnded: wasSignedIn });
    });
    try {
      const profile = await api.getProfile();
      set(profile ? { status: 'signedIn', profile } : { status: 'signedOut' });
    } catch {
      set({ status: 'signedOut' });
    }
  },
  setProfile: (profile) => set({ status: 'signedIn', profile, sessionEnded: false }),
  async signOut() {
    set({ sessionEnded: false });
    await api.signOut();
    set({ status: 'signedOut', profile: null });
  },
  dismissSessionEnded: () => set({ sessionEnded: false }),
}));
