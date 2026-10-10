import { connection } from 'next/server';
import { getDashboardStats, getAllReports } from '@/lib/db/store';
import { jsonWithStorage, storeErrorResponse } from '@/lib/db/http';

export async function GET() {
  await connection(); // read the store per request, never at build time
  try {
    const [stats, reports] = await Promise.all([getDashboardStats(), getAllReports()]);
    const recentReports = reports.slice(0, 10);
    return jsonWithStorage({ stats, recentReports });
  } catch (error) {
    return storeErrorResponse(error, 'Failed to load dashboard');
  }
}
