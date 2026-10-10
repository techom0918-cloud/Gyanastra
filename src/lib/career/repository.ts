// Storage for Career Intelligence. A repository is always created FOR ONE USER (the id comes from the validated session),
// so there is no method that takes a user id and no way to ask for someone else's data. The Supabase implementation
// also runs on that user's own session, so Row Level Security enforces the same rule in the database.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AssessmentKind, CareerAssessmentResult, CareerProfile, StoredAssessment } from './types';

/** Assessments kept per kind; older ones are deleted so personal data does not accumulate indefinitely. */
export const MAX_ASSESSMENTS_PER_KIND = 10;

export class CareerStoreError extends Error {
  constructor(
    readonly kind: 'not_enabled' | 'query_failed',
    message: string,
    options?: { cause?: unknown }
  ) {
    super(message, options);
    this.name = 'CareerStoreError';
  }
}

export interface CareerRepository {
  getProfile(): Promise<CareerProfile | null>;
  saveProfile(profile: CareerProfile): Promise<CareerProfile>;
  /** The most recent assessment of each kind, with completed task ids on action plans. */
  latestAssessments(): Promise<StoredAssessment[]>;
  saveAssessment(kind: AssessmentKind, source: 'rules' | 'ai', input: unknown, result: CareerAssessmentResult): Promise<StoredAssessment>;
  /** Marks a task done/undone. Returns false when the assessment does not exist or is not this user's. */
  setTaskDone(assessmentId: string, taskId: string, done: boolean): Promise<boolean>;
  /** Deletes the profile, all assessments and all progress. */
  deleteAll(): Promise<void>;
}

// --- Supabase -----------------------------------------------------------------------------------------------------------

const PROFILES = 'career_profiles';
const ASSESSMENTS = 'career_assessments';
const PROGRESS = 'career_task_progress';

interface ProfileRow {
  status: CareerProfile['status'];
  current_job_title: string | null;
  target_role: string | null;
  industry: string | null;
  experience_months: number | null;
  tenure_months: number | null;
  skills: string[];
  growth_skills: string[];
  goals: string | null;
  priorities: CareerProfile['priorities'];
  salary_min_lpa: number | string | null;
  salary_max_lpa: number | string | null;
  preferred_locations: string[];
  concerns: CareerProfile['concerns'];
  exit_reasons: CareerProfile['exitReasons'];
  notice_period_days: number | null;
  financial_runway_months: number | string | null;
  updated_at: string;
}

const num = (v: number | string | null): number | undefined => (v === null || v === undefined ? undefined : Number(v));
const opt = <T,>(v: T | null): T | undefined => (v === null ? undefined : v);

export function profileFromRow(r: ProfileRow): CareerProfile {
  return {
    status: r.status,
    currentJobTitle: opt(r.current_job_title),
    targetRole: opt(r.target_role),
    industry: opt(r.industry),
    experienceMonths: opt(r.experience_months),
    tenureMonths: opt(r.tenure_months),
    skills: r.skills ?? [],
    growthSkills: r.growth_skills ?? [],
    goals: opt(r.goals),
    priorities: r.priorities ?? [],
    salaryMinLpa: num(r.salary_min_lpa),
    salaryMaxLpa: num(r.salary_max_lpa),
    preferredLocations: r.preferred_locations ?? [],
    concerns: r.concerns ?? [],
    exitReasons: r.exit_reasons ?? [],
    noticePeriodDays: opt(r.notice_period_days),
    financialRunwayMonths: num(r.financial_runway_months),
    updatedAt: r.updated_at,
  };
}

export function profileToRow(p: CareerProfile, userId: string) {
  return {
    user_id: userId,
    status: p.status,
    current_job_title: p.currentJobTitle ?? null,
    target_role: p.targetRole ?? null,
    industry: p.industry ?? null,
    experience_months: p.experienceMonths ?? null,
    tenure_months: p.tenureMonths ?? null,
    skills: p.skills,
    growth_skills: p.growthSkills,
    goals: p.goals ?? null,
    priorities: p.priorities,
    salary_min_lpa: p.salaryMinLpa ?? null,
    salary_max_lpa: p.salaryMaxLpa ?? null,
    preferred_locations: p.preferredLocations,
    concerns: p.concerns,
    exit_reasons: p.exitReasons,
    notice_period_days: p.noticePeriodDays ?? null,
    financial_runway_months: p.financialRunwayMonths ?? null,
    updated_at: new Date().toISOString(),
  };
}

interface AssessmentRow {
  id: string;
  kind: AssessmentKind;
  source: 'rules' | 'ai';
  result: CareerAssessmentResult;
  created_at: string;
}

type DbError = { code?: string; message: string };

function fail(action: string, error: DbError): never {
  // 42P01 / PGRST205: the table does not exist, i.e. the migration has not been applied yet.
  if (error.code === '42P01' || error.code === 'PGRST205' || /career_(profiles|assessments|task_progress)/.test(error.message) && /does not exist|schema cache/.test(error.message)) {
    throw new CareerStoreError('not_enabled', `Career Intelligence tables are missing; apply migration 20261010000005 (${action})`, { cause: error });
  }
  throw new CareerStoreError('query_failed', `Career store: could not ${action}`, { cause: error });
}

/**
 * `client` MUST be the signed-in user's own client (publishable key + their session), never a service-role client:
 * that is what makes Row Level Security apply. `userId` is the validated session's id and is written on every insert.
 */
export function createSupabaseCareerRepository(client: SupabaseClient, userId: string): CareerRepository {
  return {
    async getProfile() {
      const { data, error } = await client.from(PROFILES).select('*').eq('user_id', userId).maybeSingle();
      if (error) fail('read profile', error);
      return data ? profileFromRow(data as ProfileRow) : null;
    },

    async saveProfile(profile) {
      const { data, error } = await client.from(PROFILES).upsert(profileToRow(profile, userId), { onConflict: 'user_id' }).select('*').single();
      if (error) fail('save profile', error);
      return profileFromRow(data as ProfileRow);
    },

    async latestAssessments() {
      const { data, error } = await client
        .from(ASSESSMENTS)
        .select('id, kind, source, result, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(MAX_ASSESSMENTS_PER_KIND * 3);
      if (error) fail('read assessments', error);
      const latest = new Map<AssessmentKind, AssessmentRow>();
      for (const row of (data ?? []) as AssessmentRow[]) if (!latest.has(row.kind)) latest.set(row.kind, row);

      const stored: StoredAssessment[] = [...latest.values()].map((r) => ({ id: r.id, kind: r.kind, source: r.source, createdAt: r.created_at, result: r.result }));
      const plan = stored.find((s) => s.kind === 'action_plan');
      if (plan) {
        const progress = await client.from(PROGRESS).select('task_id').eq('assessment_id', plan.id).eq('user_id', userId);
        if (progress.error) fail('read progress', progress.error);
        plan.completedTaskIds = ((progress.data ?? []) as { task_id: string }[]).map((p) => p.task_id);
      }
      return stored;
    },

    async saveAssessment(kind, source, input, result) {
      const { data, error } = await client
        .from(ASSESSMENTS)
        .insert({ user_id: userId, kind, source, input, result })
        .select('id, kind, source, result, created_at')
        .single();
      if (error) fail('save assessment', error);
      const row = data as AssessmentRow;

      // Retention: keep only the newest MAX_ASSESSMENTS_PER_KIND of this kind. Best effort; a failure here is not fatal.
      const older = await client.from(ASSESSMENTS).select('id').eq('user_id', userId).eq('kind', kind).order('created_at', { ascending: false }).range(MAX_ASSESSMENTS_PER_KIND, MAX_ASSESSMENTS_PER_KIND + 99);
      const staleIds = ((older.data ?? []) as { id: string }[]).map((r) => r.id);
      if (!older.error && staleIds.length > 0) await client.from(ASSESSMENTS).delete().eq('user_id', userId).in('id', staleIds);

      return { id: row.id, kind: row.kind, source: row.source, createdAt: row.created_at, result: row.result };
    },

    async setTaskDone(assessmentId, taskId, done) {
      const owned = await client.from(ASSESSMENTS).select('id').eq('id', assessmentId).eq('user_id', userId).eq('kind', 'action_plan').maybeSingle();
      if (owned.error) fail('check assessment', owned.error);
      if (!owned.data) return false;
      if (done) {
        const { error } = await client.from(PROGRESS).upsert({ user_id: userId, assessment_id: assessmentId, task_id: taskId, completed_at: new Date().toISOString() }, { onConflict: 'assessment_id,task_id' });
        if (error) fail('save progress', error);
      } else {
        const { error } = await client.from(PROGRESS).delete().eq('assessment_id', assessmentId).eq('task_id', taskId).eq('user_id', userId);
        if (error) fail('clear progress', error);
      }
      return true;
    },

    async deleteAll() {
      // Assessments cascade to their progress rows.
      const a = await client.from(ASSESSMENTS).delete().eq('user_id', userId);
      if (a.error) fail('delete assessments', a.error);
      const p = await client.from(PROFILES).delete().eq('user_id', userId);
      if (p.error) fail('delete profile', p.error);
    },
  };
}
