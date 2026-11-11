import type { NextRequest } from 'next/server';
import { businesses } from '@/server/api-session';

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return businesses(request, `/businesses/${id}`, 'GET');
}
