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

    async function applySession(next: Session | null) {
      const nextUser = next?.user ?? null;
      setSession(next);
      setUser(nextUser);
      setEmail(nextUser?.email ?? null);
      const [allowed, nextProfile] = await Promise.all([
        resolveAdmin(nextUser),
        nextUser ? fetchOwnProfile(nextUser.id).catch(() => null) : Promise.resolve(null),
      ]);
      if (cancelled) return;
      setAdmin(allowed);
      setProfile(nextProfile);
      setReady(true);
    }

    void supabase.auth.getSession().then(async ({ data }) => {
      if (cancelled) return;
      await applySession(data.session);
    });

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
    setProfile(await fetchOwnProfile(user.id));
  }, [user]);

  const claimUsername = useCallback(
    async (username: string) => {
      if (!user) throw new Error('Sign in first.');
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
