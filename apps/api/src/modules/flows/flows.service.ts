import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { z } from 'zod';
import type { Principal } from '../../shared/auth/auth.types';
import { BusinessesService } from '../businesses/businesses.service';
import { FlowsRepository } from './flows.repository';
import { createFlow, publicationError, publishFlow, saveFlow } from './flows.rules';

@Injectable()
export class FlowsService {
  constructor(private readonly businesses: BusinessesService, private readonly repository: FlowsRepository) {}

  async publishedSnapshot(businessId: string, flowId: string, version: number) {
    const snapshot = await this.repository.version(businessId, flowId, version);
    if (!snapshot) throw new NotFoundException('Published flow version not available');
    return snapshot;
  }

  private async access(user: Principal, businessId: string, write = false, flowId?: string) {
    if (!z.uuid().safeParse(businessId).success || (flowId !== undefined && !z.uuid().safeParse(flowId).success)) throw new BadRequestException('Invalid business or flow identifier');
    const business = await this.businesses.find(user, businessId);
    if (write && business.role === 'operator') throw new ForbiddenException('Only business owners and admins can change flows');
  }

  private parse<T>(schema: z.ZodType<T>, input: unknown): T {
    if (Buffer.byteLength(JSON.stringify(input) ?? '', 'utf8') > 65536) throw new BadRequestException('Flow request exceeds 64 KiB');
    const parsed = schema.safeParse(input);
    if (!parsed.success) throw new BadRequestException('Invalid flow request; check its name, steps, limits, and revision');
    return parsed.data;
  }

  async list(user: Principal, businessId: string) {
    await this.access(user, businessId);
    return { flows: await this.repository.list(businessId) };
  }

  async create(user: Principal, businessId: string, input: unknown) {
    await this.access(user, businessId, true);
    const value = this.parse(createFlow, input);
    return { flow: await this.repository.create(businessId, value.name, value.steps) };
  }

  async find(user: Principal, businessId: string, flowId: string) {
    await this.access(user, businessId, false, flowId);
    const flow = await this.repository.find(businessId, flowId);
    if (!flow) throw new NotFoundException('Flow not available');
    return { flow };
  }

  async save(user: Principal, businessId: string, flowId: string, input: unknown) {
    await this.access(user, businessId, true, flowId);
    const value = this.parse(saveFlow, input);
    if (!await this.repository.find(businessId, flowId)) throw new NotFoundException('Flow not available');
    const flow = await this.repository.save(businessId, flowId, value.expectedRevision, value.name, value.steps);
    if (!flow) throw new ConflictException('The flow changed; reload before saving');
    return { flow };
  }

  async publish(user: Principal, businessId: string, flowId: string, input: unknown) {
    await this.access(user, businessId, true, flowId);
    const value = this.parse(publishFlow, input);
    if (!await this.repository.find(businessId, flowId)) throw new NotFoundException('Flow not available');
    const version = await this.repository.publish(businessId, flowId, value.expectedRevision, (steps) => {
      const error = publicationError(steps);
      if (error) throw new BadRequestException(error);
    });
    if (!version) throw new ConflictException('The flow changed; save or reload before publishing');
    return { version };
  }

  async version(user: Principal, businessId: string, flowId: string, value: string) {
    await this.access(user, businessId, false, flowId);
    if (!/^[1-9][0-9]{0,8}$/.test(value)) throw new BadRequestException('Invalid version number');
    const version = await this.repository.version(businessId, flowId, Number(value));
    if (!version) throw new NotFoundException('Flow version not available');
    return { version };
  }
}
