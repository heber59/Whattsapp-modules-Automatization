import type { NextRequest } from 'next/server';
import { flows } from '@/server/api-session';

type Context = { params: Promise<{ id: string; flowId: string }> };
export async function GET(request: NextRequest, context: Context) {
  const { id, flowId } = await context.params;
  return flows(request, `/businesses/${id}/flows/${flowId}`, 'GET');
}
export async function PATCH(request: NextRequest, context: Context) {
  const { id, flowId } = await context.params;
  return flows(request, `/businesses/${id}/flows/${flowId}`, 'PATCH');
}
