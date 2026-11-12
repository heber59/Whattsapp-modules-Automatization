import type { NextRequest } from 'next/server';
import { businesses } from '@/server/api-session';

export const POST = (request: NextRequest) => businesses(request, '/commercial/purchase-requests', 'POST');
