import { NextRequest, NextResponse } from 'next/server';
import { classifyReport } from '@/lib/ai/classifier';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { description } = body;

    if (!description || typeof description !== 'string' || description.length < 5) {
      return NextResponse.json(
        { error: 'Description must be at least 5 characters' },
        { status: 400 }
      );
    }

    const result = classifyReport(description);
    return NextResponse.json({ classification: result });
  } catch {
    return NextResponse.json({ error: 'Classification failed' }, { status: 500 });
  }
}
