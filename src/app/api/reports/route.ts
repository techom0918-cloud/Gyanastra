import { NextRequest, NextResponse, connection } from 'next/server';
import { reportSubmissionSchema } from '@/lib/validation/schemas';
import { getAllReports, addReport, getRecentSubmissions, slugify } from '@/lib/db/store';
import { jsonWithStorage, storeErrorResponse } from '@/lib/db/http';
import { readJsonBody } from '@/lib/http/body';
import { personalDataErrors } from '@/lib/privacy';
import {
  clientAddress,
  createLocalSubmissionLog,
  decideSubmission,
  startOfUtcDay,
  submitterHash,
  submitterSecret,
} from '@/lib/abuse/submissions';

// Used only when the database cannot record submitter hashes (migration not applied): per instance, best effort.
const localLog = createLocalSubmissionLog();

export async function GET() {
  await connection(); // read the store per request, never at build time
  try {
    const reports = await getAllReports();
    return jsonWithStorage({ reports });
  } catch (error) {
    return storeErrorResponse(error, 'Failed to load reports');
  }
}

export async function POST(req: NextRequest) {
  const body = await readJsonBody(req);
  if (!body.ok) return body.response;

  const parsed = reportSubmissionSchema.safeParse(body.value);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const pii = personalDataErrors({
    companyName: parsed.data.companyName,
    role: parsed.data.role,
    description: parsed.data.description,
  });
  if (Object.keys(pii).length > 0) {
    return NextResponse.json(
      { error: 'Please remove personal information (emails, phone numbers, ID numbers) before submitting.', details: pii },
      { status: 400 }
    );
  }

  const now = new Date();
  const hash = submitterHash(clientAddress(req.headers), now, submitterSecret());
  const candidate = { companySlug: slugify(parsed.data.companyName), status: parsed.data.status };

  try {
    const since = startOfUtcDay(now);
    const recent = (await getRecentSubmissions(hash, since)) ?? localLog.list(hash, since);
    const decision = decideSubmission(recent, candidate, now);
    if (!decision.allowed) {
      const headers = decision.retryAfterSeconds ? { 'Retry-After': String(decision.retryAfterSeconds) } : undefined;
      return NextResponse.json({ error: decision.error }, { status: decision.status, headers });
    }

    const report = await addReport(parsed.data, { submitterHash: hash });
    localLog.record(hash, { ...candidate, createdAt: now.toISOString() });
    return jsonWithStorage({ report }, { status: 201 });
  } catch (error) {
    return storeErrorResponse(error, 'Failed to save report');
  }
}
