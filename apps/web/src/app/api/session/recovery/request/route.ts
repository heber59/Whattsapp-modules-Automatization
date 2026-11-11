import type { NextRequest } from 'next/server';
import { recover } from '@/server/api-session';

export const POST = (request: NextRequest) => recover(request, 'request');
