import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';

export type SendResult = { state: 'sent'; id: string } | { state: 'retry' | 'failed' | 'manual_review' };

@Injectable()
export class MetaGateway {
  constructor(private readonly config: ConfigService) {}

  async send(phone: string, recipient: string, text: string): Promise<SendResult> {
    // A response lost after acceptance cannot safely be retried without provider idempotency.
    try {
      const response = await fetch(this.config.getOrThrow<string>('META_GRAPH_ORIGIN') + '/'
        + this.config.getOrThrow<string>('META_GRAPH_VERSION') + '/' + phone + '/messages', {
        method: 'POST', redirect: 'error', signal: AbortSignal.timeout(10000),
        headers: { Authorization: 'Bearer ' + this.config.getOrThrow<string>('META_ACCESS_TOKEN'), 'Content-Type': 'application/json' },
        body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', to: recipient, type: 'text', text: { preview_url: false, body: text } }),
      });
      if (response.status === 429) return { state: 'retry' };
      if (response.status >= 500) return { state: 'manual_review' };
      if (!response.ok) return { state: 'failed' };
      const parsed = z.object({ messages: z.array(z.object({ id: z.string().min(1).max(255) })).min(1) }).safeParse(await response.json());
      if (!parsed.success) return { state: 'manual_review' };
      return { state: 'sent', id: parsed.data.messages[0]!.id };
    } catch { return { state: 'manual_review' }; }
  }
}
