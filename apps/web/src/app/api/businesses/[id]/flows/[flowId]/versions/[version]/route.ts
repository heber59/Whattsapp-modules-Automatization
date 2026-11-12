import type { NextRequest } from 'next/server';
import { flows } from '@/server/api-session';

export async function GET(request: NextRequest, context: { params: Promise<{ id: string; flowId: string; version: string }> }) {
  const { id, flowId, version } = await context.params;
  return flows(request, `/businesses/${id}/flows/${flowId}/versions/${version}`, 'GET');
}
