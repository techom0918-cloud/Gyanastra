import { NextRequest } from 'next/server';
import { careerErrorResponse, getCareerContext, json } from '@/lib/career/context';
import { careerProfileSchema } from '@/lib/career/schemas';
import type { CareerProfile } from '@/lib/career/types';
import { readJsonBody } from '@/lib/http/body';
import { crossOriginResponse, isSameOrigin } from '@/lib/http/origin';
import { personalDataErrors } from '@/lib/privacy';

export async function PUT(req: NextRequest) {
  if (!isSameOrigin(req)) return crossOriginResponse();
  const auth = await getCareerContext();
  if (!auth.ok) return auth.response;
  const body = await readJsonBody(req);
  if (!body.ok) return body.response;

  const parsed = careerProfileSchema.safeParse(body.value);
  if (!parsed.success) return json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors }, { status: 400 });
  const p = parsed.data;

  // Free text is checked for personal identifiers before it is stored or ever sent to a model.
  const pii = personalDataErrors({
    currentJobTitle: p.currentJobTitle,
    targetRole: p.targetRole,
    industry: p.industry,
    skills: p.skills.join(', '),
    growthSkills: p.growthSkills.join(', '),
    goals: p.goals,
    preferredLocations: p.preferredLocations.join(', '),
  });
  if (Object.keys(pii).length > 0) {
    return json({ error: 'Please remove personal information (emails, phone numbers, ID numbers) before saving.', details: pii }, { status: 400 });
  }

  try {
    const saved = await auth.ctx.repo.saveProfile(p as CareerProfile);
    return json({ profile: saved });
  } catch (error) {
    return careerErrorResponse(error, 'Failed to save your profile');
  }
}
