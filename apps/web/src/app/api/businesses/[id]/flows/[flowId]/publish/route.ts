import type { NextRequest } from 'next/server';
import { flows } from '@/server/api-session';

export async function POST(request: NextRequest, context: { params: Promise<{ id: string; flowId: string }> }) {
  const { id, flowId } = await context.params;
  return flows(request, `/businesses/${id}/flows/${flowId}/publish`, 'POST');
}
