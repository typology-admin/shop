import type { User } from '@supabase/supabase-js';
import { payloadIsAdmin } from '../../shared/admin.ts';

export function isAdmin(user: User | null | undefined): boolean {
  if (!user) return false;
  return payloadIsAdmin({
    app_metadata: user.app_metadata as { role?: unknown; roles?: unknown },
  });
}
