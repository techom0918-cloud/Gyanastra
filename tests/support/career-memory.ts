import { MAX_ASSESSMENTS_PER_KIND, type CareerRepository } from '@/lib/career/repository';
import type { CareerProfile, StoredAssessment } from '@/lib/career/types';

/** Emulates the database's per-user isolation so ownership rules can be tested without a database. */
export function createMemoryCareerStore() {
  const profiles = new Map<string, CareerProfile>();
  const assessments: (StoredAssessment & { userId: string })[] = [];
  const progress = new Set<string>(); // `${userId}|${assessmentId}|${taskId}`
  let seq = 0;

  return {
    forUser(userId: string): CareerRepository {
      return {
        async getProfile() {
          return profiles.get(userId) ?? null;
        },
        async saveProfile(profile) {
          const saved = { ...profile, updatedAt: new Date().toISOString() };
          profiles.set(userId, saved);
          return saved;
        },
        async latestAssessments() {
          const mine = assessments.filter((a) => a.userId === userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt) || 0);
          const out: StoredAssessment[] = [];
          for (const a of mine) {
            if (out.some((o) => o.kind === a.kind)) continue;
            const { userId: _owner, ...rest } = a;
            void _owner;
            out.push(a.kind === 'action_plan' ? { ...rest, completedTaskIds: [...progress].filter((k) => k.startsWith(`${userId}|${a.id}|`)).map((k) => k.split('|')[2]) } : rest);
          }
          return out;
        },
        async saveAssessment(kind, source, _input, result) {
          void _input;
          seq += 1;
          const stored = { id: `00000000-0000-4000-8000-${String(seq).padStart(12, '0')}`, kind, source, createdAt: new Date(Date.now() + seq).toISOString(), result, userId } as StoredAssessment & { userId: string };
          assessments.push(stored);
          const mine = assessments.filter((a) => a.userId === userId && a.kind === kind).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
          for (const old of mine.slice(MAX_ASSESSMENTS_PER_KIND)) assessments.splice(assessments.indexOf(old), 1);
          const { userId: _owner, ...rest } = stored;
          void _owner;
          return rest;
        },
        async setTaskDone(assessmentId, taskId, done) {
          if (!assessments.some((a) => a.id === assessmentId && a.userId === userId && a.kind === 'action_plan')) return false;
          const key = `${userId}|${assessmentId}|${taskId}`;
          if (done) progress.add(key);
          else progress.delete(key);
          return true;
        },
        async deleteAll() {
          profiles.delete(userId);
          for (let i = assessments.length - 1; i >= 0; i--) if (assessments[i].userId === userId) assessments.splice(i, 1);
          for (const k of [...progress]) if (k.startsWith(`${userId}|`)) progress.delete(k);
        },
      };
    },
  };
}
