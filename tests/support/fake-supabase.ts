// Minimal stand-in for the supabase-js query builder: records each chained call
// and resolves the awaited query with whatever the responder returns.
import type { SupabaseClient } from '@supabase/supabase-js';

export interface RecordedQuery {
  table: string;
  ops: { name: string; args: unknown[] }[];
}

export type Responder = (query: RecordedQuery) => { data: unknown; error: { message: string } | null };

export function createFakeSupabase(responder: Responder) {
  const queries: RecordedQuery[] = [];

  const client = {
    from(table: string) {
      const query: RecordedQuery = { table, ops: [] };
      queries.push(query);
      const builder: object = new Proxy(
        {},
        {
          get(_target, prop) {
            if (prop === 'then') {
              return (resolve: (v: unknown) => void, reject: (e: unknown) => void) =>
                Promise.resolve()
                  .then(() => responder(query))
                  .then(resolve, reject);
            }
            return (...args: unknown[]) => {
              query.ops.push({ name: String(prop), args });
              return builder;
            };
          },
        }
      );
      return builder;
    },
  };

  return { client: client as unknown as SupabaseClient, queries };
}

export function op(query: RecordedQuery, name: string) {
  return query.ops.find((o) => o.name === name);
}
