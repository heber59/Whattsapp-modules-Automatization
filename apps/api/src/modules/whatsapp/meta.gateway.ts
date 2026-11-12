import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';

export type SendResult = { state: 'sent'; id: string } | { state: 'retry' | 'failed' | 'manual_review' };

@Injectable()
export class MetaGateway {
  constructor(private readonly config: ConfigService) {}

  send(phone: string, recipient: string, text: string, media?: { type: 'document' | 'image'; url: string; filename?: string; caption: string } | null): Promise<SendResult> {
    return this.request(phone,recipient,media ? { type: media.type, [media.type]: { link: media.url,caption:media.caption || undefined,...(media.type === 'document' && media.filename ? { filename:media.filename } : {}) } } : { type:'text',text:{preview_url:false,body:text} });
  }

  sendTemplate(phone: string, recipient: string, name: string, language: string, text: string): Promise<SendResult> {
    if (!/^\+[1-9][0-9]{6,14}$/.test(recipient) || !/^[a-z0-9_]{1,512}$/.test(name) || !/^[a-z]{2,3}(?:_[A-Z]{2})?$/.test(language) || !text.trim() || text.length > 1024) return Promise.resolve({state:'failed'});
    return this.request(phone,recipient.slice(1),{ type:'template',template:{name,language:{code:language},components:[{type:'body',parameters:[{type:'text',text}]}]} });
  }

  private async request(phone: string, recipient: string, message: Record<string,unknown>): Promise<SendResult> {
    // Unknown provider acceptance must never cause an automatic duplicate.
    try {
      const response = await fetch(this.config.getOrThrow<string>('META_GRAPH_ORIGIN')+'/'+this.config.getOrThrow<string>('META_GRAPH_VERSION')+'/'+phone+'/messages', {
        method:'POST',redirect:'error',signal:AbortSignal.timeout(10000),
        headers:{Authorization:'Bearer '+this.config.getOrThrow<string>('META_ACCESS_TOKEN'),'Content-Type':'application/json'},
        body:JSON.stringify({messaging_product:'whatsapp',recipient_type:'individual',to:recipient,...message}),
      });
      if (response.status === 429) return {state:'retry'};
      if (response.status >= 500) return {state:'manual_review'};
      if (!response.ok) return {state:'failed'};
      const parsed = z.object({messages:z.array(z.object({id:z.string().min(1).max(255)})).min(1)}).safeParse(await response.json());
      return parsed.success ? {state:'sent',id:parsed.data.messages[0]!.id} : {state:'manual_review'};
    } catch { return {state:'manual_review'}; }
  }
}
