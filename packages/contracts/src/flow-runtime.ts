import type { FlowStep } from './index';
import { flowStepKinds, type FlowDefinition, type FlowExpression, type FlowResult, type FlowValue, type FlowVariables } from './flow-types';

const safeKey = (key: string) => /^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(key) && !['__proto__', 'constructor', 'prototype'].includes(key);
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const waitingKind = (kind: string) => ['Menu', 'Input', 'Catalog', 'Handoff'].includes(kind);
export function evaluateExpression(expression: FlowExpression, variables: FlowVariables, depth = 0): FlowValue {
  if (depth > 12 || depth === 0 && !isFlowExpression(expression)) throw new Error('Invalid or excessively nested expression');
  const object: Record<string, unknown> | null = record(expression) ? expression : null;
  if (object && Object.hasOwn(object, 'var')) {
    const key = object.var;
    if (typeof key !== 'string' || !safeKey(key)) throw new Error('Invalid variable reference');
    if (!Object.hasOwn(variables, key)) throw new Error(`Missing variable: ${key}`);
    return variables[key]!;
  }
  if (object && Object.hasOwn(object, 'op')) {
    if (!Array.isArray(object.args) || object.args.length < 2 || object.args.length > 20) throw new Error('Calculation requires 2–20 arguments');
    const values = object.args.map(arg => evaluateExpression(arg as FlowExpression, variables, depth + 1));
    if (!values.every(value => typeof value === 'number' && Number.isFinite(value))) throw new Error('Calculation operands must be finite numbers');
    const numbers = values as number[];
    let result = numbers[0]!;
    for (const value of numbers.slice(1)) {
      if (object.op === 'add') result += value;
      else if (object.op === 'subtract') result -= value;
      else if (object.op === 'multiply') result *= value;
      else if (object.op === 'divide' && value !== 0) result /= value;
      else throw new Error('Unsupported calculation or division by zero');
      if (!Number.isFinite(result) || Math.abs(result) > 1e12) throw new Error('Calculation exceeds allowed range');
    }
    return Math.round((result + Number.EPSILON) * 100) / 100;
  }
  return structuredClone(expression as FlowValue);
}
export function interpolateFlowText(text: string, variables: FlowVariables): string {
  return text.replace(/\{\{([A-Za-z][A-Za-z0-9_]{0,63})\}\}/g, (_match, key: string) => {
    const value = Object.hasOwn(variables, key) ? variables[key] : '';
    return typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value ?? '');
  }).slice(0, 16000);
}
function configError(step: FlowStep): string | null {
  if (step.config !== undefined && configStructureError(step.config)) return 'Invalid node configuration';
  const c = step.config ?? {};
  if (['Input', 'Set', 'Calculate'].includes(step.kind) && (!c.variable || !safeKey(c.variable))) return 'Input, Set, and Calculate require a safe variable name';
  if (c.variable !== undefined && !safeKey(c.variable)) return 'Invalid variable name';
  if (step.kind === 'Set' && c.value === undefined) return 'Set requires a value';
  if (step.kind === 'Calculate' && c.expression === undefined) return 'Calculate requires an expression';
  if (step.kind === 'Condition' && (!c.condition || !['eq', 'neq', 'gt', 'gte', 'lt', 'lte'].includes(c.condition.operator))) return 'Condition requires a comparison';
  if (step.kind === 'Document' || step.kind === 'Image') {
    try { const url = new URL(c.url ?? ''); if (url.protocol !== 'https:' || url.username || url.password) return 'Media requires a public HTTPS URL'; } catch { return 'Media requires a public HTTPS URL'; }
  }
  if (step.kind === 'Catalog' && (!c.products?.length || c.products.length > 20 || new Set(c.products.map(p => p.id)).size !== c.products.length || c.products.some(p => !p.id || !p.name || !Number.isFinite(p.price) || p.price < 0))) return 'Catalog requires 1–20 unique products with nonnegative prices';
  if (step.kind === 'Cart' && !['add', 'remove', 'clear'].includes(c.cartOperation ?? 'add')) return 'Invalid cart operation';
  if (step.kind === 'Order' && c.confirmation !== undefined && !['automatic', 'human'].includes(c.confirmation)) return 'Invalid confirmation mode';
  if (['Notify', 'Handoff'].includes(step.kind) && !c.recipient?.trim()) return 'Notifications and handoff require a recipient';
  if (['Notify', 'Handoff'].includes(step.kind) && c.notificationChannel === 'whatsapp') {
    if (!/^\+[1-9][0-9]{7,14}$/.test(c.recipient ?? '')) return 'WhatsApp notifications require an E.164 recipient';
    if (!/^[a-z0-9_]{1,512}$/.test(c.templateName ?? '') || !/^[a-z]{2,3}(_[A-Z]{2})?$/.test(c.templateLanguage ?? '')) return 'WhatsApp notifications require an approved template name and language';
    if ((c.message ?? step.text).length > 1024) return 'WhatsApp notification body exceeds 1024 characters';
  }
  if (c.min !== undefined && !Number.isFinite(c.min) || c.max !== undefined && !Number.isFinite(c.max) || c.min !== undefined && c.max !== undefined && c.min > c.max) return 'Invalid input bounds';
  return null;
}
export function publicationError(steps: FlowStep[]): string | null {
  if (steps.length > 200) return 'A flow supports at most 200 steps';
  const starts = steps.filter(step => step.kind === 'Start');
  if (starts.length !== 1) return 'A published flow requires exactly one Start';
  const nodes = new Map(steps.map(step => [step.id, step]));
  if (nodes.size !== steps.length) return 'Step identifiers must be unique';
  for (const step of steps) {
    if (!flowStepKinds.includes(step.kind)) return 'Unsupported step kind';
    if (['Start', 'Message', 'Menu', 'Input', 'End', 'Catalog'].includes(step.kind) && !step.text.trim()) return 'Customer-facing steps require text';
    const error = configError(step); if (error) return error;
    if (step.kind === 'End' && step.choices.length) return 'End steps cannot have outgoing replies';
    if (step.kind === 'Condition' && step.choices.length !== 2) return 'Condition requires true and false destinations';
    if (step.kind === 'Menu' && !step.choices.length) return 'Menus require at least one reply';
    if (!['End', 'Menu', 'Condition'].includes(step.kind) && step.choices.length !== 1) return 'This step requires exactly one outgoing reply';
    const labels = new Set<string>();
    for (const choice of step.choices) {
      if (!choice.label.trim() || !nodes.has(choice.to)) return 'Every reply needs a label and an existing destination';
      const label = choice.label.trim().toLowerCase();
      if (labels.has(label)) return 'Reply labels must be unique within each step';
      labels.add(label);
      if (nodes.get(choice.to)?.kind === 'Start') return 'Replies cannot target Start';
    }
  }
  const visited = new Set<string>(), active = new Set<string>();
  const walk = (id: string): boolean => {
    if (active.has(id)) return false;
    if (visited.has(id)) return true;
    active.add(id);
    const step = nodes.get(id)!;
    if (!waitingKind(step.kind) && !(step.kind === 'Order' && step.config?.confirmation === 'human')) for (const choice of step.choices) if (!walk(choice.to)) return false;
    active.delete(id); visited.add(id); return true;
  };
  for (const step of steps) if (!walk(step.id)) return 'Published flows cannot contain automatic cycles';
  const visit = (initial: string[], neighbors: (id: string) => string[]) => {
    const pending = [...initial], seen = new Set<string>();
    while (pending.length) { const id = pending.pop()!; if (!seen.has(id)) { seen.add(id); pending.push(...neighbors(id)); } }
    return seen;
  };
  if (visit([starts[0]!.id], id => nodes.get(id)!.choices.map(choice => choice.to)).size !== steps.length) return 'Every step must be reachable from Start';
  const ends = steps.filter(step => step.kind === 'End').map(step => step.id);
  if (!ends.length) return 'A published flow requires an End';
  const parents = new Map<string, string[]>();
  for (const step of steps) for (const choice of step.choices) parents.set(choice.to, [...parents.get(choice.to) ?? [], step.id]);
  if (visit(ends, id => parents.get(id) ?? []).size !== steps.length) return 'Every step needs a path to End';
  return null;
}
export function parseFlowDefinition(value: unknown): FlowDefinition {
  if (!record(value) || value.schemaVersion !== 1 || typeof value.name !== 'string' || !value.name.trim() || value.name.length > 100 || !Array.isArray(value.steps) || value.steps.length > 200) throw new Error('Invalid versioned flow definition');
  if (JSON.stringify(value).length > 65536) throw new Error('Flow definition exceeds size limit');
  for (const item of value.steps) {
    if (!record(item) || typeof item.id !== 'string' || !item.id.trim() || item.id.length > 100 || typeof item.kind !== 'string' || !(flowStepKinds as readonly string[]).includes(item.kind) || typeof item.text !== 'string' || item.text.length > 4000 || typeof item.x !== 'number' || !Number.isFinite(item.x) || Math.abs(item.x) > 100000 || typeof item.y !== 'number' || !Number.isFinite(item.y) || Math.abs(item.y) > 100000 || !Array.isArray(item.choices) || item.choices.length > 20 || item.choices.some(c => !record(c) || typeof c.label !== 'string' || c.label.length > 200 || typeof c.to !== 'string' || c.to.length > 100) || item.config !== undefined && configStructureError(item.config)) throw new Error('Invalid step structure');
  }
  const definition = structuredClone(value) as unknown as FlowDefinition;
  if (new Set(definition.steps.map(step => step.id)).size !== definition.steps.length) throw new Error('Step identifiers must be unique');
  return definition;
}

export function runFlow(steps: FlowStep[], currentStep: string | null, reply: string, initialVariables: FlowVariables = {}): FlowResult {
  const nodes = new Map(steps.map(step => [step.id, step]));
  const variables: FlowVariables = structuredClone(initialVariables);
  const actions: FlowResult['actions'] = [];
  const messages: string[] = [];
  const text = (step: FlowStep, content = step.text) => { const rendered = interpolateFlowText(content, variables); if (rendered) { messages.push(rendered); actions.push({ type: 'text', stepId: step.id, text: rendered }); } };
  const finish = (step: FlowStep | null, state: FlowResult['state']): FlowResult => ({ text: messages.join('\n\n'), menu: step?.id ?? null, currentStep: step?.id ?? null, state, variables, actions });
  const prompt = (step: FlowStep) => {
    const c = step.config ?? {};
    if (step.kind === 'Menu') text(step, step.text + '\n' + step.choices.map((choice, i) => `${i + 1}. ${choice.label}`).join('\n'));
    else if (step.kind === 'Catalog') text(step, step.text + '\n' + c.products!.map((product, i) => `${i + 1}. ${product.name} — ${product.price}`).join('\n'));
    else text(step);
  };
  let current = currentStep ? nodes.get(currentStep) : steps.find(step => step.kind === 'Start');
  if (!current) throw new Error('Published flow state is unavailable');
  if (currentStep) {
    const invalidConfig = configError(current); if (invalidConfig) throw new Error(invalidConfig);
    const c = current.config ?? {};
    if (current.kind === 'Handoff' || current.kind === 'Order' && c.confirmation === 'human') current = nodes.get(current.choices[0]!.to);
    else if (current.kind === 'Menu') {
      const answer = reply.trim().toLowerCase();
      const choice = /^[1-9][0-9]*$/.test(answer) ? current.choices[Number(answer) - 1] : current.choices.find(item => item.label.trim().toLowerCase() === answer);
      if (!choice) { text(current, 'Please reply with an option number or its label.'); prompt(current); return finish(current, 'waiting'); }
      current = nodes.get(choice.to);
    } else if (current.kind === 'Input') {
      let value: FlowValue = reply.trim();
      let valid = !c.required || value.length > 0;
      if (value === '' && !c.required) value = null;
      else if (c.inputType === 'number') { value = value === '' ? NaN : Number(value); valid = valid && Number.isFinite(value) && (c.min === undefined || value >= c.min) && (c.max === undefined || value <= c.max); }
      else { valid = valid && (c.min === undefined || value.length >= c.min) && (c.max === undefined || value.length <= c.max); if (c.inputType === 'email') valid = valid && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value); if (c.inputType === 'phone') valid = valid && /^\+[1-9][0-9]{7,14}$/.test(value); }
      if (!valid) { text(current, 'Please enter a valid value.'); prompt(current); return finish(current, 'waiting'); }
      variables[c.variable!] = value; current = nodes.get(current.choices[0]!.to);
    } else if (current.kind === 'Catalog') {
      const answer = reply.trim().toLowerCase();
      const product = /^[1-9][0-9]*$/.test(answer) ? c.products![Number(answer) - 1] : c.products!.find(p => p.id.toLowerCase() === answer || p.name.toLowerCase() === answer);
      if (!product) { text(current, 'Please choose a product.'); prompt(current); return finish(current, 'waiting'); }
      variables[c.variable ?? 'product'] = { id: product.id, name: product.name, price: product.price }; current = nodes.get(current.choices[0]!.to);
    } else throw new Error('Published waiting state is invalid');
  }
  for (let count = 0; count <= 200; count++) {
    if (!current) throw new Error('Published destination is unavailable');
    const c = current.config ?? {};
    const error = configError(current); if (error) throw new Error(error);
    if (['Menu', 'Input', 'Catalog'].includes(current.kind)) { prompt(current); return finish(current, 'waiting'); }
    if (['Start', 'Message', 'End'].includes(current.kind)) text(current);
    if (current.kind === 'End') return finish(null, 'completed');
    if (current.kind === 'Set') variables[c.variable!] = evaluateExpression(c.value!, variables);
    if (current.kind === 'Calculate') variables[c.variable!] = evaluateExpression(c.expression!, variables);
    if (current.kind === 'Condition') {
      const condition = c.condition!, left = evaluateExpression(condition.left, variables), right = evaluateExpression(condition.right, variables);
      let yes: boolean;
      if (condition.operator === 'eq' || condition.operator === 'neq') { yes = JSON.stringify(left) === JSON.stringify(right); if (condition.operator === 'neq') yes = !yes; }
      else { if (typeof left !== 'number' || typeof right !== 'number') throw new Error('Ordered comparisons require numbers'); yes = condition.operator === 'gt' ? left > right : condition.operator === 'gte' ? left >= right : condition.operator === 'lt' ? left < right : left <= right; }
      current = nodes.get(current.choices[yes ? 0 : 1]!.to); continue;
    }
    if (current.kind === 'Document' || current.kind === 'Image') actions.push({ type: current.kind === 'Document' ? 'document' : 'image', stepId: current.id, url: c.url!, filename: c.filename, caption: interpolateFlowText(current.text, variables) });
    if (current.kind === 'Cart') {
      const cart: FlowValue[] = Array.isArray(variables.cart) ? structuredClone(variables.cart) : [];
      if (c.cartOperation === 'clear') cart.splice(0);
      else {
        const product = variables[c.variable ?? 'product'];
        const id = c.productId !== undefined ? evaluateExpression(c.productId, variables) : record(product) ? product.id : null;
        const index = cart.findIndex(item => record(item) && item.id === id);
        if (c.cartOperation === 'remove') { if (index >= 0) cart.splice(index, 1); }
        else {
          if (!record(product) || product.id !== id || typeof product.price !== 'number' || product.price < 0 || typeof product.name !== 'string') throw new Error('Cart requires a selected catalog product');
          const quantity = evaluateExpression(c.quantity ?? 1, variables);
          if (typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity < 1 || quantity > 10000) throw new Error('Cart quantity must be an integer from 1 to 10000');
          const existing = cart[index];
          const combined = index >= 0 && record(existing) && typeof existing.quantity === 'number' ? existing.quantity + quantity : quantity;
          if (combined > 10000 || cart.length >= 100 && index < 0) throw new Error('Cart limit exceeded');
          const item = { id: String(id), name: product.name, price: product.price, quantity: combined };
          if (index >= 0) cart[index] = item; else cart.push(item);
        }
      }
      variables.cart = cart;
      variables.subtotal = Math.round(cart.reduce<number>((sum, item) => sum + (record(item) && typeof item.price === 'number' && typeof item.quantity === 'number' ? item.price * item.quantity : 0), 0) * 100) / 100;
    }
    if (current.kind === 'Order') {
      const data: Record<string, FlowValue> = Object.create(null);
      for (const [key, expression] of Object.entries(c.fields ?? {})) { if (!safeKey(key)) throw new Error('Invalid order field'); data[key] = evaluateExpression(expression, variables); }
      if (Array.isArray(variables.cart)) data.cart = structuredClone(variables.cart);
      const total = typeof variables.total === 'number' ? variables.total : typeof variables.subtotal === 'number' ? variables.subtotal : undefined;
      if (total !== undefined && (!Number.isFinite(total) || total < 0 || total > 1e12)) throw new Error('Invalid order total');
      variables.orderStatus = c.confirmation === 'human' ? 'pending_approval' : 'confirmed';
      actions.push({ type: 'order', stepId: current.id, data, total, confirmation: c.confirmation ?? 'automatic' });
      text(current);
      if (c.confirmation === 'human') return finish(current, 'paused');
    }
    if (current.kind === 'Notify' || current.kind === 'Handoff') {
      const notificationText = interpolateFlowText(c.message ?? current.text, variables);
      if (c.notificationChannel === 'whatsapp' && notificationText.length > 1024) throw new Error('WhatsApp notification body exceeds 1024 characters');
      actions.push({ type: current.kind === 'Notify' ? 'notify' : 'handoff', stepId: current.id, recipient: interpolateFlowText(c.recipient!, variables), text: notificationText, ...(c.notificationChannel === 'whatsapp' ? { notificationChannel: c.notificationChannel, templateName: c.templateName, templateLanguage: c.templateLanguage } : {}) });
      if (current.kind === 'Handoff') { text(current); return finish(current, 'paused'); }
    }
    current = nodes.get(current.choices[0]!.to);
  }
  throw new Error('Automatic flow step limit reached');
}


export interface MenuResult { text: string; menu: string | null; state: 'waiting' | 'completed' }
export function runMenu(steps: FlowStep[], currentMenu: string | null, reply: string): MenuResult {
  const result = runFlow(steps, currentMenu, reply);
  if (result.state === 'paused') throw new Error('This flow requires the extended runtime');
  return { text: result.text, menu: result.menu, state: result.state };
}
export function responseChunks(text: string): string[] {
  const chunks: string[] = [];
  let chunk = '';
  for (const char of Array.from(text)) {
    if (chunk.length + char.length > 4000) { chunks.push(chunk); chunk = ''; }
    chunk += char;
  }
  if (chunk) chunks.push(chunk);
  return chunks;
}



export function isFlowExpression(value: unknown, depth = 0): value is FlowExpression {
  if (depth > 12) return false;
  if (value === null || typeof value === 'boolean') return true;
  if (typeof value === 'string') return value.length <= 4000;
  if (typeof value === 'number') return Number.isFinite(value) && Math.abs(value) <= 1e12;
  if (Array.isArray(value)) return value.length <= 100 && value.every(item => isFlowExpression(item, depth + 1));
  if (!record(value)) return false;
  const keys = Object.keys(value);
  if (keys.some(key => ['__proto__', 'constructor', 'prototype'].includes(key)) || keys.length > 100) return false;
  if (Object.hasOwn(value, 'var')) return keys.length === 1 && typeof value.var === 'string' && safeKey(value.var);
  if (Object.hasOwn(value, 'op')) return keys.length === 2 && ['add', 'subtract', 'multiply', 'divide'].includes(String(value.op)) && Array.isArray(value.args) && value.args.length >= 2 && value.args.length <= 20 && value.args.every(arg => isFlowExpression(arg, depth + 1));
  return keys.every(key => key.length <= 64 && isFlowExpression(value[key], depth + 1));
}
function configStructureError(value: unknown): boolean {
  if (!record(value)) return true;
  const allowed = ['variable', 'inputType', 'required', 'min', 'max', 'value', 'expression', 'condition', 'url', 'filename', 'products', 'cartOperation', 'productId', 'quantity', 'confirmation', 'fields', 'recipient', 'message', 'notificationChannel', 'templateName', 'templateLanguage'];
  if (Object.keys(value).some(key => !allowed.includes(key))) return true;
  for (const key of ['variable', 'inputType', 'url', 'filename', 'cartOperation', 'confirmation', 'recipient', 'message', 'notificationChannel', 'templateName', 'templateLanguage']) if (value[key] !== undefined && (typeof value[key] !== 'string' || value[key].length > 4000)) return true;
  if (value.notificationChannel !== undefined && !['inbox', 'whatsapp'].includes(String(value.notificationChannel))) return true;
  if (value.templateName !== undefined && (typeof value.templateName !== 'string' || !/^[a-z0-9_]{1,512}$/.test(value.templateName))) return true;
  if (value.templateLanguage !== undefined && (typeof value.templateLanguage !== 'string' || !/^[a-z]{2,3}(_[A-Z]{2})?$/.test(value.templateLanguage))) return true;
  if (value.required !== undefined && typeof value.required !== 'boolean') return true;
  for (const key of ['min', 'max']) if (value[key] !== undefined && (typeof value[key] !== 'number' || !Number.isFinite(value[key]))) return true;
  for (const key of ['value', 'expression', 'productId', 'quantity']) if (value[key] !== undefined && !isFlowExpression(value[key])) return true;
  if (value.inputType !== undefined && !['text', 'number', 'email', 'phone'].includes(String(value.inputType))) return true;
  if (value.condition !== undefined && (!record(value.condition) || Object.keys(value.condition).some(k => !['left', 'operator', 'right'].includes(k)) || !['eq', 'neq', 'gt', 'gte', 'lt', 'lte'].includes(String(value.condition.operator)) || !isFlowExpression(value.condition.left) || !isFlowExpression(value.condition.right))) return true;
  if (value.products !== undefined && (!Array.isArray(value.products) || value.products.length > 20 || value.products.some(p => !record(p) || Object.keys(p).some(k => !['id', 'name', 'price', 'description'].includes(k)) || typeof p.id !== 'string' || !p.id || p.id.length > 100 || typeof p.name !== 'string' || !p.name || p.name.length > 200 || typeof p.price !== 'number' || !Number.isFinite(p.price) || p.price < 0 || p.price > 1e12 || p.description !== undefined && (typeof p.description !== 'string' || p.description.length > 4000)))) return true;
  if (value.fields !== undefined && (!record(value.fields) || Object.keys(value.fields).length > 100 || Object.entries(value.fields).some(([key, expression]) => !safeKey(key) || !isFlowExpression(expression)))) return true;
  return false;
}
