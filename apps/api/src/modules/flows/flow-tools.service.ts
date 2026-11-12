import { BadRequestException, Injectable } from '@nestjs/common';
import { z } from 'zod';
import type { Principal } from '../../shared/auth/auth.types';
import { FlowsService } from './flows.service';
import { createFlow, publicationError } from './flows.rules';
import { runFlow } from '@wa/contracts';
import { flowDefinitionSchema } from './flow-definition.schema';

const identifier = z.string().uuid();
const revision = z.number().int().min(1).max(2147483646);
const definition = z.object({ schemaVersion: z.literal(1), name: z.string(), steps: z.array(z.unknown()) }).strict();
const schemas = {
  flow_list: z.object({}).strict(),
  flow_read: z.object({ flowId: identifier, version: z.number().int().positive().optional() }).strict(),
  flow_validate: z.object({ definition }).strict(),
  flow_simulate: z.object({ definition, replies: z.array(z.string().max(4000)).max(100).default([]) }).strict(),
  flow_diff: z.object({ flowId: identifier, definition }).strict(),
  flow_apply: z.object({ flowId: identifier.optional(), expectedRevision: revision.optional(), definition }).strict(),
  flow_publish: z.object({ flowId: identifier, expectedRevision: revision }).strict(),
};
const descriptions: Record<keyof typeof schemas, string> = {
  flow_list: 'List flows in this business.',
  flow_read: 'Read a draft or export an immutable publication as a versioned definition.',
  flow_validate: 'Validate a portable definition without saving or executing external actions.',
  flow_simulate: 'Simulate a definition with customer replies. Returns intended actions without delivering them.',
  flow_diff: 'Compare a proposed definition with the current draft before applying changes.',
  flow_apply: 'Create a draft or update one with an expected revision. Does not publish or activate it.',
  flow_publish: 'Publish a saved draft revision. Does not activate a channel.',
};

@Injectable()
export class FlowToolsService {
  constructor(private readonly flows: FlowsService) {}

  list() {
    return Object.entries(schemas).map(([name, schema]) => {
      const inputSchema = z.toJSONSchema(schema, { target: 'draft-7' });
      if (inputSchema.properties?.definition) inputSchema.properties.definition = flowDefinitionSchema;
      return ({
      name, description: descriptions[name as keyof typeof schemas],
      inputSchema,
      annotations: { readOnlyHint: !['flow_apply', 'flow_publish'].includes(name), destructiveHint: false, openWorldHint: false },
    }); });
  }

  private portable(input: { schemaVersion: 1; name: string; steps: unknown[] }) {
    const parsed = createFlow.safeParse({ name: input.name, steps: input.steps });
    if (!parsed.success || Buffer.byteLength(JSON.stringify(input), 'utf8') > 65536) throw new BadRequestException('Invalid flow definition or request exceeds 64 KiB');
    return parsed.data;
  }

  async call(user: Principal, businessId: string, name: string, args: unknown) {
    // Every tool, including simulation and validation, requires business membership.
    await this.flows.list(user, businessId);
    if (!(name in schemas) || !Object.hasOwn(schemas, name)) throw new BadRequestException('Unknown flow tool');
    const schema = schemas[name as keyof typeof schemas];
    const parsed = schema.safeParse(args);
    if (!parsed.success) throw new BadRequestException('Invalid tool arguments');
    switch (name) {
      case 'flow_list': return this.flows.list(user, businessId);
      case 'flow_read': {
        const input = schemas.flow_read.parse(args);
        const result = input.version
          ? (await this.flows.version(user, businessId, input.flowId, String(input.version))).version
          : (await this.flows.find(user, businessId, input.flowId)).flow;
        return { ...result, definition: { schemaVersion: 1, name: result.name, steps: result.steps } };
      }
      case 'flow_validate': {
        const input = this.portable(schemas.flow_validate.parse(args).definition);
        const error = publicationError(input.steps);
        return { valid: error === null, errors: error ? [error] : [] };
      }
      case 'flow_simulate': {
        const input = schemas.flow_simulate.parse(args);
        const flow = this.portable(input.definition);
        const error = publicationError(flow.steps);
        if (error) throw new BadRequestException(error);
        let result = runFlow(flow.steps, null, '', {});
        const turns = [result];
        for (const reply of input.replies) {
          if (result.state !== 'waiting') break;
          result = runFlow(flow.steps, result.currentStep, reply, result.variables);
          turns.push(result);
        }
        return { simulation: true, turns, result };
      }
      case 'flow_diff': {
        const input = schemas.flow_diff.parse(args);
        const proposed = this.portable(input.definition);
        const current = (await this.flows.find(user, businessId, input.flowId)).flow;
        const before = new Map(current.steps.map(step => [step.id, step]));
        const after = new Map(proposed.steps.map(step => [step.id, step]));
        return { expectedRevision: current.revision, nameChanged: current.name !== proposed.name,
          added: proposed.steps.filter(step => !before.has(step.id)),
          removed: current.steps.filter(step => !after.has(step.id)),
          changed: proposed.steps.filter(step => before.has(step.id) && JSON.stringify(before.get(step.id)) !== JSON.stringify(step)),
          publicationError: publicationError(proposed.steps) };
      }
      case 'flow_apply': {
        const input = schemas.flow_apply.parse(args);
        const flow = this.portable(input.definition);
        if (input.flowId) {
          if (input.expectedRevision === undefined) throw new BadRequestException('Updating a flow requires expectedRevision');
          return this.flows.save(user, businessId, input.flowId, { ...flow, expectedRevision: input.expectedRevision });
        }
        if (input.expectedRevision !== undefined) throw new BadRequestException('A new flow must not include expectedRevision');
        return this.flows.create(user, businessId, flow);
      }
      case 'flow_publish': {
        const input = schemas.flow_publish.parse(args);
        return this.flows.publish(user, businessId, input.flowId, { expectedRevision: input.expectedRevision });
      }
    }
    throw new BadRequestException('Unknown flow tool');
  }
}
