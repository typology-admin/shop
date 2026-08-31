import type { Session, User } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { isAdmin } from '../lib/auth.ts';
import { hasSupabaseConfig } from '../lib/env.ts';
import { localSessionEmail, localSignIn, localSignOut } from '../lib/localStore.ts';
import { getSupabase } from '../lib/supabase.ts';

export type AuthState = {
  ready: boolean;
  user: User | null;
  session: Session | null;
  email: string | null;
  isLocal: boolean;
  admin: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const isLocal = !hasSupabaseConfig();
  const admin = isLocal ? Boolean(email) : isAdmin(user);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) {
      setEmail(localSessionEmail());
      setReady(true);
      return;
    }

    let cancelled = false;

    void supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      const next = data.session;
      setSession(next);
      setUser(next?.user ?? null);
      setEmail(next?.user?.email ?? null);
      setReady(true);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setUser(next?.user ?? null);
      setEmail(next?.user?.email ?? null);
      setReady(true);
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
      setReady(true);
      return;
    }
    const { error } = await supabase.auth.signInWithPassword({
      email: nextEmail,
      password,
    });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase) {
      localSignOut();
      setEmail(null);
      return;
    }
    await supabase.auth.signOut();
  }, []);

  const value = useMemo<AuthState>(
    () => ({ ready, user, session, email, isLocal, admin, signIn, signOut }),
    [ready, user, session, email, isLocal, admin, signIn, signOut],
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
