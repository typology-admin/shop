import type { Session, User } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { isAdmin } from '../lib/auth.ts';
import { hasSupabaseConfig } from '../lib/env.ts';
import { localSessionEmail, localSignIn, localSignOut } from '../lib/localStore.ts';
import {
  authRedirectUrl,
  claimUsername as saveUsername,
  fetchOwnProfile,
  type Profile,
} from '../lib/profile.ts';
import { getSupabase } from '../lib/supabase.ts';

export type AuthState = {
  ready: boolean;
  user: User | null;
  session: Session | null;
  email: string | null;
  isLocal: boolean;
  admin: boolean;
  profile: Profile | null;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithMagicLink: (email: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithFacebook: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  claimUsername: (username: string) => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

async function resolveAdmin(user: User | null): Promise<boolean> {
  if (!user) return false;
  if (isAdmin(user)) return true;
  const supabase = getSupabase();
  if (!supabase) return false;
  const [{ data: shopAdmin }, { data: networkAdmin }] = await Promise.all([
    supabase.from('admin_users').select('user_id').eq('user_id', user.id).maybeSingle(),
    supabase.from('network_admins').select('user_id').eq('user_id', user.id).maybeSingle(),
  ]);
  return Boolean(shopAdmin || networkAdmin);
}

/** Deduplicate concurrent role/profile lookups for the same user (StrictMode /
 *  INITIAL_SESSION re-entry). Cleared on sign-out. */
const adminByUserId = new Map<string, Promise<boolean>>();
const profileByUserId = new Map<string, Promise<Profile | null>>();

function resolveAdminCached(user: User | null): Promise<boolean> {
  if (!user) return Promise.resolve(false);
  if (isAdmin(user)) return Promise.resolve(true);
  let pending = adminByUserId.get(user.id);
  if (!pending) {
    pending = resolveAdmin(user);
    adminByUserId.set(user.id, pending);
  }
  return pending;
}

function fetchOwnProfileCached(userId: string): Promise<Profile | null> {
  let pending = profileByUserId.get(userId);
  if (!pending) {
    pending = fetchOwnProfile(userId).catch(() => null);
    profileByUserId.set(userId, pending);
  }
  return pending;
}

function clearAuthLookups() {
  adminByUserId.clear();
  profileByUserId.clear();
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [admin, setAdmin] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const isLocal = !hasSupabaseConfig();

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) {
      const localEmail = localSessionEmail();
      setEmail(localEmail);
      setAdmin(Boolean(localEmail));
      setProfile(null);
      setReady(true);
      return;
    }

    let cancelled = false;
    /** Skip re-applying the same access token (getSession + INITIAL_SESSION, or StrictMode). */
    let completedToken: string | null | undefined;
    let inflight: { token: string | null; promise: Promise<void> } | null = null;

    async function applySession(next: Session | null) {
      const token = next?.access_token ?? null;
      if (completedToken === token) {
        if (!cancelled) setReady(true);
        return;
      }
      if (inflight && inflight.token === token) {
        await inflight.promise;
        return;
      }

      const promise = (async () => {
        const nextUser = next?.user ?? null;
        if (!nextUser) clearAuthLookups();
        setSession(next);
        setUser(nextUser);
        setEmail(nextUser?.email ?? null);
        const [allowed, nextProfile] = await Promise.all([
          resolveAdminCached(nextUser),
          nextUser ? fetchOwnProfileCached(nextUser.id) : Promise.resolve(null),
        ]);
        if (cancelled) return;
        setAdmin(allowed);
        setProfile(nextProfile);
        setReady(true);
        completedToken = token;
      })();

      inflight = { token, promise };
      try {
        await promise;
      } finally {
        if (inflight?.promise === promise) inflight = null;
      }
    }

    // Prefer onAuthStateChange alone — it emits INITIAL_SESSION. Also calling
    // getSession() duplicated admin_users / network_admins / profiles fetches.
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      void applySession(next);
    });

    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (nextEmail: string, password: string) => {
    const supabase = getSupabase();
    if (!supabase) {
      localSignIn(nextEmail);
      setEmail(nextEmail);
      setAdmin(true);
      setReady(true);
      return;
    }
    const { error } = await supabase.auth.signInWithPassword({
      email: nextEmail,
      password,
    });
    if (error) throw error;
  }, []);

  const signInWithMagicLink = useCallback(async (nextEmail: string) => {
    const supabase = getSupabase();
    if (!supabase) {
      throw new Error('Accounts need Supabase credentials.');
    }
    const { error } = await supabase.auth.signInWithOtp({
      email: nextEmail,
      options: { emailRedirectTo: authRedirectUrl() },
    });
    if (error) throw error;
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase) {
      throw new Error('Accounts need Supabase credentials.');
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: authRedirectUrl() },
    });
    if (error) throw error;
  }, []);

  const signInWithFacebook = useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase) {
      throw new Error('Accounts need Supabase credentials.');
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'facebook',
      options: { redirectTo: authRedirectUrl() },
    });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    clearAuthLookups();
    const supabase = getSupabase();
    if (!supabase) {
      localSignOut();
      setEmail(null);
      setAdmin(false);
      setProfile(null);
      return;
    }
    await supabase.auth.signOut();
    setProfile(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!user) {
      setProfile(null);
      return;
    }
    profileByUserId.delete(user.id);
    const next = await fetchOwnProfile(user.id);
    profileByUserId.set(user.id, Promise.resolve(next));
    setProfile(next);
  }, [user]);

  const claimUsername = useCallback(
    async (username: string) => {
      if (!user) throw new Error('Sign in first.');
      profileByUserId.delete(user.id);
      setProfile(await saveUsername(user.id, username));
    },
    [user],
  );

  const value = useMemo<AuthState>(
    () => ({
      ready,
      user,
      session,
      email,
      isLocal,
      admin,
      profile,
      signIn,
      signInWithMagicLink,
      signInWithGoogle,
      signInWithFacebook,
      signOut,
      refreshProfile,
      claimUsername,
    }),
    [
      ready,
      user,
      session,
      email,
      isLocal,
      admin,
      profile,
      signIn,
      signInWithMagicLink,
      signInWithGoogle,
      signInWithFacebook,
      signOut,
      refreshProfile,
      claimUsername,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}
