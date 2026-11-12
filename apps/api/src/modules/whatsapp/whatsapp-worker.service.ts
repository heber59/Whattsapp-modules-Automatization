import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WhatsAppRuntimeService } from './whatsapp-runtime.service';
import { WhatsAppSenderService } from './whatsapp-sender.service';
import { missingMeta } from './whatsapp.settings';

@Injectable()
export class WhatsAppWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WhatsAppWorkerService.name);
  private timer?: ReturnType<typeof setInterval>;
  private active?: Promise<void>;
  constructor(private readonly config: ConfigService, private readonly runtime: WhatsAppRuntimeService, private readonly sender: WhatsAppSenderService) {}

  async runOnce(): Promise<void> {
    if (missingMeta(this.config).length) return;
    await this.runtime.processOne();
    await this.sender.sendOne();
  }

  onModuleInit(): void {
    if (missingMeta(this.config).length) { this.logger.log('WhatsApp worker disabled until server configuration is complete'); return; }
    this.timer = setInterval(() => {
      if (this.active) return;
      this.active = this.runOnce().catch(() => this.logger.warn('WhatsApp processing interrupted; durable work will be recovered'))
        .finally(() => { this.active = undefined; });
    },1000);
    this.logger.log('WhatsApp durable inbox and outbox worker ready');
  }

  async onModuleDestroy(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    await this.active;
  }
}
