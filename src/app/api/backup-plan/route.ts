import { NextRequest, NextResponse } from 'next/server';
import { backupPlanInputSchema } from '@/lib/validation/schemas';
import { generateBackupPlan } from '@/lib/ai/backup-planner';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = backupPlanInputSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const plan = await generateBackupPlan(parsed.data);
    return NextResponse.json({
      plan,
      isAIGenerated: true,
      generatedAt: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json({ error: 'Failed to generate backup plan' }, { status: 500 });
  }
}
