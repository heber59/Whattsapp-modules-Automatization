import type { NextRequest } from 'next/server';
import { flows } from '@/server/api-session';

type Context = { params: Promise<{ id: string }> };
export async function GET(request: NextRequest, context: Context) {
  const { id } = await context.params;
  return flows(request, `/businesses/${id}/flows`, 'GET');
}
export async function POST(request: NextRequest, context: Context) {
  const { id } = await context.params;
  return flows(request, `/businesses/${id}/flows`, 'POST');
}
