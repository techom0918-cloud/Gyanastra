import { NextRequest, NextResponse, connection } from 'next/server';
import { trackedOfferSchema, trackedOfferUpdateSchema } from '@/lib/validation/schemas';
import { getTrackedOffers, addTrackedOffer, updateTrackedOffer } from '@/lib/db/store';
import { jsonWithStorage, storeErrorResponse } from '@/lib/db/http';

export async function GET() {
  await connection(); // read the store per request, never at build time
  try {
    const offers = await getTrackedOffers();
    return jsonWithStorage({ offers });
  } catch (error) {
    return storeErrorResponse(error, 'Failed to load tracked offers');
  }
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const parsed = trackedOfferSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  try {
    const offer = await addTrackedOffer(parsed.data);
    return jsonWithStorage({ offer }, { status: 201 });
  } catch (error) {
    return storeErrorResponse(error, 'Failed to save tracked offer');
  }
}

export async function PATCH(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (typeof body !== 'object' || body === null) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  const { id, ...updates } = body as Record<string, unknown>;
  if (!id || typeof id !== 'string') {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }

  const parsed = trackedOfferUpdateSchema.safeParse(updates);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  try {
    const updated = await updateTrackedOffer(id, parsed.data);
    if (!updated) {
      return NextResponse.json({ error: 'Offer not found' }, { status: 404 });
    }
    return jsonWithStorage({ offer: updated });
  } catch (error) {
    return storeErrorResponse(error, 'Failed to update tracked offer');
  }
}
