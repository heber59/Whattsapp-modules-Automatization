import type { NextRequest } from 'next/server';
import { businesses } from '@/server/api-session';

export const GET = (request: NextRequest) => businesses(request, '/businesses', 'GET');
export const POST = (request: NextRequest) => businesses(request, '/businesses', 'POST');
