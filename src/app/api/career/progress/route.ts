import { NextRequest } from 'next/server';
import { careerErrorResponse, getCareerContext, json } from '@/lib/career/context';
import { progressUpdateSchema } from '@/lib/career/schemas';
import { readJsonBody } from '@/lib/http/body';
import { crossOriginResponse, isSameOrigin } from '@/lib/http/origin';

export async function PUT(req: NextRequest) {
  if (!isSameOrigin(req)) return crossOriginResponse();
  const auth = await getCareerContext();
  if (!auth.ok) return auth.response;
  const body = await readJsonBody(req);
  if (!body.ok) return body.response;

  const parsed = progressUpdateSchema.safeParse(body.value);
  if (!parsed.success) return json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors }, { status: 400 });

  try {
    const ok = await auth.ctx.repo.setTaskDone(parsed.data.assessmentId, parsed.data.taskId, parsed.data.done);
    // Unknown ids and other people's plans look identical, so ids cannot be probed.
    return ok ? json({ ok: true }) : json({ error: 'Plan not found' }, { status: 404 });
  } catch (error) {
    return careerErrorResponse(error, 'Failed to update progress');
  }
}
