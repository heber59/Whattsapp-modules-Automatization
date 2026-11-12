import type { NextRequest } from 'next/server';
import { operations } from '@/server/api-session';
export async function POST(request: NextRequest, context: {params: Promise<{id:string}>}) {
  const {id}=await context.params; return operations(request,'/businesses/'+id+'/operations/actions','POST');
}
