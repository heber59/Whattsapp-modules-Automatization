import type { NextRequest } from 'next/server';
import { operations } from '@/server/api-session';
export async function GET(request: NextRequest, context: {params: Promise<{id:string;sender:string}>}) {
  const {id,sender}=await context.params; return operations(request,'/businesses/'+id+'/operations/conversations/'+sender,'GET');
}
