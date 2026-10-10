import { connection } from 'next/server';
import { getAllCompanies } from '@/lib/db/store';
import { jsonWithStorage, storeErrorResponse } from '@/lib/db/http';

export async function GET() {
  await connection(); // read the store per request, never at build time
  try {
    const companies = await getAllCompanies();
    return jsonWithStorage({ companies });
  } catch (error) {
    return storeErrorResponse(error, 'Failed to load companies');
  }
}
