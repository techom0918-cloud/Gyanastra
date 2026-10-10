import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { CareerStoreError, createSupabaseCareerRepository, MAX_ASSESSMENTS_PER_KIND, profileFromRow, profileToRow } from '@/lib/career/repository';
import type { CareerProfile } from '@/lib/career/types';
import { createFakeSupabase, op, type RecordedQuery } from '../support/fake-supabase';

const USER = '11111111-1111-4111-8111-111111111111';
const allOps = (q: RecordedQuery, name: string) => q.ops.filter((o) => o.name === name).map((o) => o.args);

const profile: CareerProfile = {
  status: 'employed',
  targetRole: 'Backend Engineer',
  skills: ['Go'],
  growthSkills: [],
  priorities: ['growth'],
  preferredLocations: [],
  concerns: ['compensation'],
  exitReasons: [],
  tenureMonths: 6,
  financialRunwayMonths: 4.5,
};

describe('profile mapping', () => {
  it('writes the session user id and maps empty optionals to null', () => {
    const row = profileToRow({ ...profile, targetRole: undefined }, USER);
    expect(row.user_id).toBe(USER);
    expect(row.target_role).toBeNull();
    expect(row.financial_runway_months).toBe(4.5);
    expect(row).not.toHaveProperty('id');
  });

  it('round-trips through the row shape, converting numerics and nulls', () => {
    const row = { ...profileToRow(profile, USER), salary_min_lpa: '12.50', industry: null, updated_at: '2026-10-10T00:00:00Z' };
    const back = profileFromRow(row as unknown as Parameters<typeof profileFromRow>[0]);
    expect(back).toMatchObject({ status: 'employed', targetRole: 'Backend Engineer', salaryMinLpa: 12.5, tenureMonths: 6 });
    expect(back.industry).toBeUndefined();
  });
});

describe('createSupabaseCareerRepository', () => {
  it('scopes every read to the session user', async () => {
    const { client, queries } = createFakeSupabase(() => ({ data: null, error: null }));
    const repo = createSupabaseCareerRepository(client, USER);
    await repo.getProfile();
    await repo.latestAssessments();
    for (const q of queries) expect(allOps(q, 'eq')).toContainEqual(['user_id', USER]);
  });

  it('upserts the profile with the session user id as the key', async () => {
    const { client, queries } = createFakeSupabase(() => ({ data: { ...profileToRow(profile, USER), updated_at: 'now' }, error: null }));
    await createSupabaseCareerRepository(client, USER).saveProfile(profile);
    expect(op(queries[0], 'upsert')!.args[0]).toMatchObject({ user_id: USER });
    expect(op(queries[0], 'upsert')!.args[1]).toEqual({ onConflict: 'user_id' });
  });

  it('stamps inserted assessments with the session user and prunes older ones', async () => {
    const row = { id: 'a1', kind: 'offer_risk', source: 'rules', result: { kind: 'offer_risk' }, created_at: '2026-10-10T00:00:00Z' };
    const { client, queries } = createFakeSupabase((q) => {
      if (op(q, 'insert')) return { data: row, error: null };
      if (op(q, 'range')) return { data: [{ id: 'old1' }, { id: 'old2' }], error: null };
      return { data: null, error: null };
    });
    const saved = await createSupabaseCareerRepository(client, USER).saveAssessment('offer_risk', 'rules', { a: 1 }, { kind: 'offer_risk' } as never);
    expect(saved.id).toBe('a1');
    expect(op(queries[0], 'insert')!.args[0]).toMatchObject({ user_id: USER, kind: 'offer_risk', source: 'rules' });
    expect(op(queries[1], 'range')!.args).toEqual([MAX_ASSESSMENTS_PER_KIND, MAX_ASSESSMENTS_PER_KIND + 99]);
    const prune = queries[2];
    expect(prune.ops.map((o) => o.name)).toContain('delete');
    expect(allOps(prune, 'eq')).toContainEqual(['user_id', USER]);
    expect(op(prune, 'in')!.args).toEqual(['id', ['old1', 'old2']]);
  });

  it("refuses progress updates for an assessment the user does not own, without writing", async () => {
    const { client, queries } = createFakeSupabase(() => ({ data: null, error: null })); // ownership lookup finds nothing
    const ok = await createSupabaseCareerRepository(client, USER).setTaskDone('22222222-2222-4222-8222-222222222222', 'd30-1', true);
    expect(ok).toBe(false);
    expect(queries).toHaveLength(1);
    expect(allOps(queries[0], 'eq')).toContainEqual(['user_id', USER]);
  });

  it('deletes only rows owned by the session user', async () => {
    const { client, queries } = createFakeSupabase(() => ({ data: null, error: null }));
    await createSupabaseCareerRepository(client, USER).deleteAll();
    expect(queries.map((q) => q.table)).toEqual(['career_assessments', 'career_profiles']);
    for (const q of queries) expect(allOps(q, 'eq')).toContainEqual(['user_id', USER]);
  });

  it('reports a missing table as not_enabled, and other failures as query_failed', async () => {
    const missing = createFakeSupabase(() => ({ data: null, error: { code: '42P01', message: 'relation "public.career_profiles" does not exist' } }));
    await expect(createSupabaseCareerRepository(missing.client, USER).getProfile()).rejects.toMatchObject({ kind: 'not_enabled' });
    const schemaCache = createFakeSupabase(() => ({ data: null, error: { code: 'PGRST205', message: "Could not find the table 'public.career_profiles' in the schema cache" } }));
    await expect(createSupabaseCareerRepository(schemaCache.client, USER).getProfile()).rejects.toBeInstanceOf(CareerStoreError);
    const denied = createFakeSupabase(() => ({ data: null, error: { code: '42501', message: 'permission denied' } }));
    await expect(createSupabaseCareerRepository(denied.client, USER).getProfile()).rejects.toMatchObject({ kind: 'query_failed' });
  });
});

describe('migration 20261010000005 (schema and security assumptions)', () => {
  const sql = readFileSync(path.resolve(__dirname, '../../supabase/migrations/20261010000005_create_career_intelligence.sql'), 'utf8');
  const code = sql.replace(/--.*$/gm, '');
  const tables = ['career_profiles', 'career_assessments', 'career_task_progress'];

  it('is additive: it creates only the three new tables and touches nothing else', () => {
    expect([...code.matchAll(/create table if not exists public\.(\w+)/g)].map((m) => m[1])).toEqual(tables);
    expect(code).not.toMatch(/\balter table public\.(offer_reports|tracked_offers)/i);
    expect(code).not.toMatch(/\b(truncate|drop table|drop column|delete from|update public)\b/i);
  });

  it('enables Row Level Security on every table', () => {
    for (const t of tables) expect(code).toMatch(new RegExp(`alter table public\\.${t} enable row level security`));
  });

  it('gives anon nothing and grants only to authenticated', () => {
    expect(code).toMatch(/revoke all on table[^;]*from anon/i);
    expect(code).not.toMatch(/grant[^;]*\bto\s+(anon|public)\b/i);
    expect(code).not.toMatch(/grant[^;]*service_role/i);
    for (const t of tables) expect(code).toMatch(new RegExp(`grant [a-z, ]+ on table public\\.${t} to authenticated`));
  });

  it('restricts every policy to the owner via auth.uid() and never uses "using (true)"', () => {
    const policies = [...code.matchAll(/create policy [\s\S]*?;/g)].map((m) => m[0]);
    expect(policies).toHaveLength(11);
    for (const p of policies) {
      expect(p).toMatch(/to authenticated/);
      expect(p).toMatch(/user_id = \(select auth\.uid\(\)\)/);
      expect(p).not.toMatch(/using\s*\(\s*true\s*\)|with check\s*\(\s*true\s*\)/i);
    }
    // Assessments are immutable: no update policy.
    expect(policies.filter((p) => /on public\.career_assessments/.test(p) && /for update/.test(p))).toHaveLength(0);
  });

  it('deletes personal data with the account and ties progress to the same user', () => {
    expect([...code.matchAll(/references auth\.users \(id\) on delete cascade/g)]).toHaveLength(3);
    expect(code).toMatch(/foreign key \(assessment_id, user_id\) references public\.career_assessments \(id, user_id\) on delete cascade/);
    expect(code).toMatch(/unique \(id, user_id\)/);
  });

  it('bounds sensitive and free-text columns', () => {
    for (const col of ['goals', 'notice_period_days', 'financial_runway_months', 'skills']) expect(code).toMatch(new RegExp(`${col}[^\\n]*check`));
    expect(code).toMatch(/pg_column_size\(input\)/);
  });
});
