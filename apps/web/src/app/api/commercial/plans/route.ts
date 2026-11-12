import type { NextRequest } from 'next/server';
import { publicRequest } from '@/server/api-session';

export const GET = (request: NextRequest) => publicRequest(request, 'plans');
