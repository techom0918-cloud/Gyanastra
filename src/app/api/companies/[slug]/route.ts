import { NextRequest, NextResponse } from 'next/server';
import { getCompanySummary, getReportsByCompany } from '@/lib/db/store';
import { jsonWithStorage, storeErrorResponse } from '@/lib/db/http';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  try {
    const [company, reports] = await Promise.all([getCompanySummary(slug), getReportsByCompany(slug)]);

    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    return jsonWithStorage({ company, reports });
  } catch (error) {
    return storeErrorResponse(error, 'Failed to load company');
  }
}
