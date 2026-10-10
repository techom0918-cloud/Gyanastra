// Guards against supabase/seed.sql drifting from src/lib/db/seed.ts.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { SEED_REPORTS, SEED_TRACKED_OFFERS } from '@/lib/db/seed';

const sql = readFileSync(path.resolve(__dirname, '../../supabase/seed.sql'), 'utf8');
const rows = sql.split('\n').filter((line) => /^\s+\('demo-/.test(line));

describe('supabase/seed.sql', () => {
  it('contains exactly the demo records from seed.ts, each flagged is_demo', () => {
    const ids = rows.map((line) => line.match(/^\s+\('([^']+)'/)![1]);
    expect(ids).toEqual([...SEED_REPORTS, ...SEED_TRACKED_OFFERS].map((r) => r.id));
    for (const line of rows) expect(line).toMatch(/, true(, '[^']+')?\),?$/);
  });

  it('never deletes or overwrites existing rows', () => {
    expect(sql).not.toMatch(/\b(delete|truncate|drop|update)\b/i);
    expect(sql.match(/on conflict \(id\) do nothing/g)).toHaveLength(2);
  });

  it('marks every seed record as demo in seed.ts', () => {
    expect([...SEED_REPORTS, ...SEED_TRACKED_OFFERS].every((r) => r.isDemo === true)).toBe(true);
  });
});
