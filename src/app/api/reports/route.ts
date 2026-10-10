import { NextRequest, NextResponse, connection } from 'next/server';
import { reportSubmissionSchema } from '@/lib/validation/schemas';
import { getAllReports, addReport } from '@/lib/db/store';
import { jsonWithStorage, storeErrorResponse } from '@/lib/db/http';

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
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const parsed = reportSubmissionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  try {
    const report = await addReport(parsed.data);
    return jsonWithStorage({ report }, { status: 201 });
  } catch (error) {
    return storeErrorResponse(error, 'Failed to save report');
  }
}
