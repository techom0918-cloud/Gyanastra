// Chooses the storage backend from server-only environment variables.
//
//   AAGEY_STORAGE=supabase  → Supabase; requests fail with 503 if credentials are missing
//   AAGEY_STORAGE=memory    → in-memory demo store (data lost on restart)
//   unset                   → Supabase when SUPABASE_URL and SUPABASE_SECRET_KEY are set, else memory
import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { Repository, StoreError } from './repository';
import { createMemoryRepository } from './memory-repository';
import { createSupabaseRepository } from './supabase-repository';

type Env = Record<string, string | undefined>;

export type StorageConfig =
  | { mode: 'memory' }
  | { mode: 'supabase'; url: string; secretKey: string };

export function resolveStorageConfig(env: Env = process.env): StorageConfig {
  const requested = env.AAGEY_STORAGE?.trim().toLowerCase();
  const url = env.SUPABASE_URL?.trim();
  const secretKey = env.SUPABASE_SECRET_KEY?.trim();

  if (requested === 'memory') return { mode: 'memory' };

  if (requested === 'supabase' || (!requested && url && secretKey)) {
    if (!url || !secretKey) {
      throw new StoreError(
        'not_configured',
        'AAGEY_STORAGE=supabase but SUPABASE_URL and/or SUPABASE_SECRET_KEY are not set'
      );
    }
    return { mode: 'supabase', url, secretKey };
  }

  if (requested) {
    throw new StoreError('not_configured', `Unknown AAGEY_STORAGE value "${env.AAGEY_STORAGE}" (use "supabase" or "memory")`);
  }

  return { mode: 'memory' };
}

let cached: { key: string; repo: Repository } | null = null;
let override: Repository | null = null;

export function getRepository(): Repository {
  if (override) return override;

  const config = resolveStorageConfig();
  const key = config.mode === 'supabase' ? `supabase:${config.url}` : 'memory';
  if (cached?.key === key) return cached.repo;

  let repo: Repository;
  if (config.mode === 'supabase') {
    const client = createClient(config.url, config.secretKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    repo = createSupabaseRepository(client);
  } else {
    console.warn('[aagey] Using in-memory storage: submitted reports and tracker changes are lost on restart.');
    repo = createMemoryRepository();
  }
  cached = { key, repo };
  return repo;
}

/** Tests only: force a specific backend (pass null to restore env-based selection). */
export function setRepositoryForTesting(repo: Repository | null): void {
  override = repo;
}
