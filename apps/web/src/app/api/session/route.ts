import type { NextRequest } from 'next/server';
import { businesses } from '@/server/api-session';

export const GET = (request: NextRequest) => businesses(request, '/identity/me', 'GET');
