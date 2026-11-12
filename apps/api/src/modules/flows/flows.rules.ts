import { flowStepKinds, isFlowExpression, type FlowExpression } from '@wa/contracts';
import { z } from 'zod';
export { publicationError } from '@wa/contracts';

const expression = z.custom<FlowExpression>(isFlowExpression, 'Invalid or excessively nested expression');
const config = z.object({
  variable: z.string().regex(/^[A-Za-z][A-Za-z0-9_]{0,63}$/).optional(),
  inputType: z.enum(['text', 'number', 'email', 'phone']).optional(), required: z.boolean().optional(),
  min: z.number().finite().optional(), max: z.number().finite().optional(),
  value: expression.optional(), expression: expression.optional(),
  condition: z.object({ left: expression, operator: z.enum(['eq', 'neq', 'gt', 'gte', 'lt', 'lte']), right: expression }).strict().optional(),
  url: z.string().max(2000).optional(), filename: z.string().max(200).optional(),
  products: z.array(z.object({ id: z.string().min(1).max(100), name: z.string().min(1).max(200), price: z.number().finite().min(0).max(1e12), description: z.string().max(4000).optional() }).strict()).max(20).optional(),
  cartOperation: z.enum(['add', 'remove', 'clear']).optional(), productId: expression.optional(), quantity: expression.optional(),
  confirmation: z.enum(['automatic', 'human']).optional(), fields: z.record(z.string().max(64), expression).optional(),
  notificationChannel: z.enum(['inbox', 'whatsapp']).optional(),
  templateName: z.string().regex(/^[a-z0-9_]{1,512}$/).optional(), templateLanguage: z.string().regex(/^[a-z]{2,3}(_[A-Z]{2})?$/).optional(),
  recipient: z.string().max(1000).optional(), message: z.string().max(4000).optional(),
}).strict();
const step = z.object({
  id: z.string().trim().min(1).max(100), kind: z.enum(flowStepKinds), text: z.string().max(4000),
  x: z.number().finite().min(-100000).max(100000), y: z.number().finite().min(-100000).max(100000),
  choices: z.array(z.object({ label: z.string().max(200), to: z.string().max(100) }).strict()).max(20),
  config: config.optional(),
}).strict();
export const createFlow = z.object({ name: z.string().trim().min(1).max(100), steps: z.array(step).max(200) }).strict()
  .refine(value => new Set(value.steps.map(item => item.id)).size === value.steps.length);
export const saveFlow = createFlow.safeExtend({ expectedRevision: z.number().int().min(1).max(2147483646) });
export const publishFlow = z.object({ expectedRevision: z.number().int().min(1).max(2147483646) }).strict();
