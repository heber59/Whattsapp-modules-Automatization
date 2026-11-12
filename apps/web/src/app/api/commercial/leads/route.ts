import type { NextRequest } from 'next/server';
import { publicRequest } from '@/server/api-session';

export const POST = (request: NextRequest) => publicRequest(request, 'leads');
