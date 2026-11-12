import type { NextRequest } from 'next/server';
import { whatsapp } from '@/server/api-session';

type Context = { params: Promise<{ id: string }> };
export async function GET(request: NextRequest, context: Context) {
  const { id } = await context.params;
  return whatsapp(request, id, 'GET');
}
export async function POST(request: NextRequest, context: Context) {
  const { id } = await context.params;
  return whatsapp(request, id, 'POST');
}
