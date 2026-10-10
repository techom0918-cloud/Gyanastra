import { NextRequest, NextResponse } from 'next/server';
import { classifyReport } from '@/lib/ai/classifier';
import { readJsonBody } from '@/lib/http/body';

const MIN_LENGTH = 5;
const MAX_LENGTH = 1000; // same limit as a report description

export async function POST(req: NextRequest) {
  const body = await readJsonBody(req);
  if (!body.ok) return body.response;

  const description = (body.value as { description?: unknown } | null)?.description;
  if (typeof description !== 'string' || description.trim().length < MIN_LENGTH || description.length > MAX_LENGTH) {
    return NextResponse.json(
      { error: `Description must be between ${MIN_LENGTH} and ${MAX_LENGTH} characters` },
      { status: 400 }
    );
  }

  try {
    return NextResponse.json({ classification: classifyReport(description) });
  } catch {
    return NextResponse.json({ error: 'Classification failed' }, { status: 500 });
  }
}
