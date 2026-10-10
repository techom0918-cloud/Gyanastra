import { connection, type NextRequest } from 'next/server';
import { careerErrorResponse, getCareerContext, json } from '@/lib/career/context';
import { loadOverview } from '@/lib/career/overview';
import { crossOriginResponse, isSameOrigin } from '@/lib/http/origin';

// The signed-in user's whole Career Intelligence state. The user comes from the validated session only.
export async function GET() {
  await connection();
  const auth = await getCareerContext();
  if (!auth.ok) return auth.response;
  try {
    return json(await loadOverview(auth.ctx.repo));
  } catch (error) {
    return careerErrorResponse(error, 'Failed to load your career data');
  }
}

/** Permanently deletes the caller's career profile, assessments and progress. */
export async function DELETE(req: NextRequest) {
  if (!isSameOrigin(req)) return crossOriginResponse();
  const auth = await getCareerContext();
  if (!auth.ok) return auth.response;
  try {
    await auth.ctx.repo.deleteAll();
    return json({ deleted: true });
  } catch (error) {
    return careerErrorResponse(error, 'Failed to delete your career data');
  }
}
