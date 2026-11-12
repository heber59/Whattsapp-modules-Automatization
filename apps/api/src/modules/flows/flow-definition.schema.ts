import { flowStepKinds } from '@wa/contracts';
import type { JSONSchema } from 'zod/v4/core';

const variable: JSONSchema.JSONSchema = { type: 'string', pattern: '^[A-Za-z][A-Za-z0-9_]{0,63}$' };
const expression = { description: 'A JSON literal, {var:"variableName"}, or {op:"add|subtract|multiply|divide",args:[expressions]}. Nesting is bounded to 12. No executable code.' };
export const flowDefinitionSchema: JSONSchema.JSONSchema = {
  type: 'object', additionalProperties: false, required: ['schemaVersion', 'name', 'steps'],
  properties: {
    schemaVersion: { const: 1 }, name: { type: 'string', minLength: 1, maxLength: 100 },
    steps: { type: 'array', maxItems: 200, items: {
      type: 'object', additionalProperties: false, required: ['id', 'kind', 'text', 'x', 'y', 'choices'],
      properties: {
        id: { type: 'string', minLength: 1, maxLength: 100 }, kind: { enum: [...flowStepKinds] },
        text: { type: 'string', maxLength: 4000, description: 'Customer text; interpolate variables using {{name}}.' },
        x: { type: 'number', minimum: -100000, maximum: 100000 }, y: { type: 'number', minimum: -100000, maximum: 100000 },
        choices: { type: 'array', maxItems: 20, description: 'Menu: customer options. Condition: first true, second false. End: none. Other nodes: one next destination.', items: {
          type: 'object', additionalProperties: false, required: ['label', 'to'], properties: { label: { type: 'string', maxLength: 200 }, to: { type: 'string', maxLength: 100 } },
        } },
        config: { type: 'object', additionalProperties: false, properties: {
          variable, inputType: { enum: ['text', 'number', 'email', 'phone'] }, required: { type: 'boolean' }, min: { type: 'number' }, max: { type: 'number' },
          value: expression, expression, condition: { type: 'object', additionalProperties: false, required: ['left', 'operator', 'right'], properties: {
            left: expression, operator: { enum: ['eq', 'neq', 'gt', 'gte', 'lt', 'lte'] }, right: expression,
          } },
          url: { type: 'string', maxLength: 2000, description: 'Public HTTPS media URL fetched by the provider.' }, filename: { type: 'string', maxLength: 200 },
          products: { type: 'array', minItems: 1, maxItems: 20, items: { type: 'object', additionalProperties: false, required: ['id', 'name', 'price'], properties: {
            id: { type: 'string', minLength: 1, maxLength: 100 }, name: { type: 'string', minLength: 1, maxLength: 200 }, price: { type: 'number', minimum: 0, maximum: 1e12 }, description: { type: 'string', maxLength: 4000 },
          } } },
          cartOperation: { enum: ['add', 'remove', 'clear'] }, productId: expression, quantity: expression,
          confirmation: { enum: ['automatic', 'human'] }, fields: { type: 'object', additionalProperties: expression },
          recipient: { type: 'string', maxLength: 1000, description: 'Inbox routing label, or E.164 phone number for WhatsApp alerts.' },
          notificationChannel: { enum: ['inbox', 'whatsapp'], description: 'Default inbox. WhatsApp requires a pre-approved template and recipient configuration.' },
          templateName: { type: 'string', maxLength: 100, description: 'Approved template with exactly one body text parameter filled with the rendered message.' },
          templateLanguage: { type: 'string', maxLength: 20 },
          message: { type: 'string', maxLength: 4000 },
        } },
      },
    } },
  },
};
