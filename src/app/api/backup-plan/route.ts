import { NextRequest, NextResponse } from 'next/server';
import { backupPlanInputSchema } from '@/lib/validation/schemas';
import { generateBackupPlan, PlanDependencies } from '@/lib/ai/backup-planner';
import { createPlanClient, generateClaudePlan, PLAN_MODEL, PlanClient } from '@/lib/ai/claude-planner';
import { readJsonBody } from '@/lib/http/body';
import { personalDataErrors } from '@/lib/privacy';
import { clientAddress, createSlidingWindowLimiter, submitterHash, submitterSecret } from '@/lib/abuse/submissions';

// One AI call takes up to ~40 s (20 s timeout, one retry); allow for that on serverless platforms.
export const maxDuration = 60;

// Caps paid AI calls per client. Per server instance only (best effort): over the cap, the free rule-based
// template is returned instead of an error. A global spend cap belongs in the provider console.
const aiLimiter = createSlidingWindowLimiter(5, 10 * 60_000);

let cachedClient: { key: string; client: PlanClient } | null = null;
function planClient(apiKey: string): PlanClient {
  if (cachedClient?.key !== apiKey) cachedClient = { key: apiKey, client: createPlanClient(apiKey) };
  return cachedClient.client;
}

export async function POST(req: NextRequest) {
  const body = await readJsonBody(req);
  if (!body.ok) return body.response;

  const parsed = backupPlanInputSchema.safeParse(body.value);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }
  const input = parsed.data;
  const pii = personalDataErrors({
    skills: input.skills.join(', '),
    degree: input.degree,
    preferredRole: input.preferredRole,
    locationPreferences: input.locationPreferences.join(', '),
    companyName: input.companyName,
    additionalContext: input.additionalContext,
  });
  if (Object.keys(pii).length > 0) {
    return NextResponse.json(
      { error: 'Please remove personal information (emails, phone numbers, ID numbers) before generating a plan.', details: pii },
      { status: 400 }
    );
  }

  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  const deps: PlanDependencies = {};
  if (apiKey) {
    const now = new Date();
    deps.generateWithAi = (planInput, disclaimer) => generateClaudePlan(planClient(apiKey), planInput, disclaimer);
    deps.model = PLAN_MODEL;
    deps.rateLimited = !aiLimiter.tryConsume(submitterHash(clientAddress(req.headers), now, submitterSecret()), now.getTime());
    // Log the error type and message only; SDK errors never include the API key.
    deps.onAiError = (error) => console.error('[aagey] AI plan generation failed; using the template:', error instanceof Error ? `${error.name}: ${error.message}` : 'unknown error');
  }

  try {
    const result = await generateBackupPlan(input, deps);
    return NextResponse.json({
      plan: result.plan,
      source: result.source,
      isAIGenerated: result.source === 'ai',
      ...(result.model && result.source === 'ai' ? { model: result.model } : {}),
      ...(result.fallbackReason ? { fallbackReason: result.fallbackReason } : {}),
      generatedAt: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json({ error: 'Failed to generate backup plan' }, { status: 500 });
  }
}
