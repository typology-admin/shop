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

async function resolveAdmin(user: User | null): Promise<boolean> {
  if (!user) return false;
  if (isAdmin(user)) return true;
  const supabase = getSupabase();
  if (!supabase) return false;
  const { data } = await supabase
    .from('admin_users')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle();
  return Boolean(data);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [admin, setAdmin] = useState(false);
  const isLocal = !hasSupabaseConfig();

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) {
      const localEmail = localSessionEmail();
      setEmail(localEmail);
      setAdmin(Boolean(localEmail));
      setReady(true);
      return;
    }

    let cancelled = false;

    void supabase.auth.getSession().then(async ({ data }) => {
      if (cancelled) return;
      const next = data.session;
      const nextUser = next?.user ?? null;
      setSession(next);
      setUser(nextUser);
      setEmail(nextUser?.email ?? null);
      setAdmin(await resolveAdmin(nextUser));
      setReady(true);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      const nextUser = next?.user ?? null;
      setSession(next);
      setUser(nextUser);
      setEmail(nextUser?.email ?? null);
      void resolveAdmin(nextUser).then((allowed) => {
        if (!cancelled) setAdmin(allowed);
      });
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

  const signOut = useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase) {
      localSignOut();
      setEmail(null);
      setAdmin(false);
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
