import { NextRequest, NextResponse, connection } from 'next/server';
import { trackedOfferSchema, trackedOfferUpdateSchema } from '@/lib/validation/schemas';
import { getTrackedOffers, addTrackedOffer, updateTrackedOffer, supportsAccountTracking } from '@/lib/db/store';
import { jsonWithStorage, storeErrorResponse } from '@/lib/db/http';
import { readJsonBody } from '@/lib/http/body';
import { crossOriginResponse, isSameOrigin } from '@/lib/http/origin';
import { personalDataErrors } from '@/lib/privacy';
import { getCurrentUser } from '@/lib/auth/server';
import { MAX_VIEWER_IDS, OFFER_ID_PATTERN as OFFER_ID, OFFER_IDS_HEADER } from '@/lib/tracker-ids';

// Two ownership models share this route:
//  - Signed in: offers belong to the account (tracked_offers.user_id). The user id comes from the server-validated
//    session, never from the request, and every query filters on it, so one user can never read or change another's.
//  - Signed out: the original browser-held model. The client sends the private ids it holds in a header; offers owned
//    by an account are never reachable this way.

function viewerOfferIds(req: NextRequest): string[] | null {
  const raw = req.headers.get(OFFER_IDS_HEADER);
  if (!raw) return [];
  const ids = [...new Set(raw.split(',').map((s) => s.trim()).filter(Boolean))];
  if (ids.length > MAX_VIEWER_IDS || !ids.every((id) => OFFER_ID.test(id))) return null;
  return ids;
}

const piiResponse = (details: Record<string, string[]>) =>
  NextResponse.json(
    { error: 'Please remove personal information (emails, phone numbers, ID numbers) before saving.', details },
    { status: 400 }
  );

const accountTrackingUnavailable = () =>
  NextResponse.json({ error: 'Saving offers to your account is not enabled yet. Please try again later.' }, { status: 503 });

export async function GET(req: NextRequest) {
  await connection(); // read the store per request, never at build time
  try {
    const user = await getCurrentUser();
    if (user) {
      if (!(await supportsAccountTracking())) {
        return jsonWithStorage({ offers: [], scope: 'account', accountTracking: false });
      }
      const offers = await getTrackedOffers({ userId: user.id });
      return jsonWithStorage({ offers, scope: 'account', accountTracking: true });
    }

    const ids = viewerOfferIds(req);
    if (ids === null) return NextResponse.json({ error: 'Invalid offer ids' }, { status: 400 });
    const offers = await getTrackedOffers(ids);
    return jsonWithStorage({ offers, scope: 'browser' });
  } catch (error) {
    return storeErrorResponse(error, 'Failed to load tracked offers');
  }
}

export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) return crossOriginResponse();
  const body = await readJsonBody(req);
  if (!body.ok) return body.response;

  const parsed = trackedOfferSchema.safeParse(body.value);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }
  const pii = personalDataErrors({ companyName: parsed.data.companyName, role: parsed.data.role, notes: parsed.data.notes });
  if (Object.keys(pii).length > 0) return piiResponse(pii);

  try {
    const user = await getCurrentUser();
    if (user && !(await supportsAccountTracking())) return accountTrackingUnavailable();
    const offer = await addTrackedOffer(parsed.data, user?.id);
    return jsonWithStorage({ offer }, { status: 201 });
  } catch (error) {
    return storeErrorResponse(error, 'Failed to save tracked offer');
  }
}

export async function PATCH(req: NextRequest) {
  if (!isSameOrigin(req)) return crossOriginResponse();
  const body = await readJsonBody(req);
  if (!body.ok) return body.response;

  if (typeof body.value !== 'object' || body.value === null || Array.isArray(body.value)) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  const { id, ...updates } = body.value as Record<string, unknown>;
  if (typeof id !== 'string' || !OFFER_ID.test(id)) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }

  const parsed = trackedOfferUpdateSchema.safeParse(updates);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }
  const pii = personalDataErrors({ companyName: parsed.data.companyName, role: parsed.data.role, notes: parsed.data.notes });
  if (Object.keys(pii).length > 0) return piiResponse(pii);

  try {
    const user = await getCurrentUser();
    const updated = await updateTrackedOffer(id, parsed.data, user?.id);
    if (!updated) {
      // Unknown ids, demo offers (read-only) and other people's offers all look the same, so ids cannot be probed.
      return NextResponse.json({ error: 'Offer not found' }, { status: 404 });
    }
    return jsonWithStorage({ offer: updated });
  } catch (error) {
    return storeErrorResponse(error, 'Failed to update tracked offer');
  }
}
