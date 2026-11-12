import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseFlowDefinition, isFlowExpression, type FlowStep } from '@wa/contracts';
import { createFlow, publicationError } from './flows.rules';

const graph = (): FlowStep[] => [
  { id: 's', kind: 'Start', text: 'Hello', x: 0, y: 0, choices: [{ label: 'Next', to: 'm' }] },
  { id: 'm', kind: 'Message', text: 'Message', x: 100, y: 0, choices: [{ label: 'Next', to: 'e' }] },
  { id: 'e', kind: 'End', text: 'Bye', x: 200, y: 0, choices: [] },
];

test('Drafts accept incomplete steps while bounding structure and rejecting duplicate identifiers', () => {
  assert.equal(createFlow.safeParse({ name: 'Draft', steps: [] }).success, true);
  assert.equal(createFlow.safeParse({ name: 'Draft', steps: [graph()[0], graph()[0]] }).success, false);
  assert.equal(createFlow.safeParse({ name: 'Draft', steps: [{ ...graph()[0], x: Infinity }] }).success, false);
  assert.equal(createFlow.safeParse({ name: 'Draft', steps: [{ ...graph()[0], choices: Array(21).fill({ label: 'x', to: 'e' }) }] }).success, false);
});

test('Publication validates destinations, endings, reachability, step semantics, and automatic cycles', () => {
  assert.equal(publicationError(graph()), null);
  const menuLoop = graph();
  menuLoop[1]!.kind = 'Menu';
  menuLoop[1]!.choices.push({ label: 'Try again', to: 'm' });
  assert.equal(publicationError(menuLoop), null);
  const invalid: FlowStep[][] = [];
  invalid.push([]);
  invalid.push([...graph(), { id: 'orphan', kind: 'End', text: 'Bye', x: 0, y: 0, choices: [] }]);
  const dangling = graph(); dangling[0]!.choices[0]!.to = 'missing'; invalid.push(dangling);
  const cycle = graph(); cycle[1]!.choices[0]!.to = 'm'; invalid.push(cycle);
  const ending = graph(); ending[2]!.choices = [{ label: 'Next', to: 'm' }]; invalid.push(ending);
  const branch = graph(); branch[1]!.choices.push({ label: 'Other', to: 'e' }); invalid.push(branch);
  const duplicate = graph(); duplicate.push(duplicate[0]!); invalid.push(duplicate);
  for (const steps of invalid) assert.equal(typeof publicationError(steps), 'string');
});

test('Publication checks configurable node semantics and permits input-wait loops', () => {
  const steps = graph();
  steps[1] = { ...steps[1]!, kind: 'Input', config: { variable: 'customer', required: true } };
  assert.equal(publicationError(steps), null);
  steps[1]!.config = { variable: 'constructor' };
  assert.match(publicationError(steps)!, /variable/);
  steps[1] = { ...steps[1]!, kind: 'Document', config: { url: 'http://example.com/file.pdf' } };
  assert.match(publicationError(steps)!, /HTTPS/);
  steps[1] = { ...steps[1]!, kind: 'Condition', config: { condition: { left: 1, operator: 'eq', right: 1 } } };
  assert.match(publicationError(steps)!, /true and false/);
  assert.equal(createFlow.safeParse({ name: 'Expanded', steps: [{ ...graph()[1], kind: 'Input', config: { variable: 'name', required: true } }] }).success, true);
  assert.equal(createFlow.safeParse({ name: 'Expanded', steps: [{ ...graph()[1], kind: 'Input', config: { unexpected: 'value' } }] }).success, false);
});

test('Declarative parsing rejects malformed configuration, unsafe expressions, and unsupported versions', () => {
  const definition = { schemaVersion: 1, name: 'Portable', steps: graph() };
  assert.deepEqual(parseFlowDefinition(definition), definition);
  assert.throws(() => parseFlowDefinition({ ...definition, schemaVersion: 2 }), /definition/);
  assert.throws(() => parseFlowDefinition({ ...definition, steps: [{ ...graph()[1], config: { products: 'invalid' } }] }), /structure/);
  assert.equal(isFlowExpression({ var: 'constructor' }), false);
  let expression: unknown = 1;
  for (let i = 0; i < 20; i++) expression = { op: 'add', args: [expression, 1] };
  assert.equal(isFlowExpression(expression), false);
  const steps = graph();
  steps[1] = { ...steps[1]!, kind: 'Catalog', config: { products: [{ id: 'x', name: 'X', price: Infinity }] } };
  assert.match(publicationError(steps)!, /configuration|prices/);
});


test('External notifications require bounded approved-template configuration', () => {
  const steps = graph();
  steps[1] = { ...steps[1]!, kind: 'Notify', text: 'New order', config: { notificationChannel: 'whatsapp', recipient: '+573001234567' } };
  assert.match(publicationError(steps)!, /template/);
  steps[1]!.config!.templateName = 'owner_alert';
  steps[1]!.config!.templateLanguage = 'es_CO';
  assert.equal(publicationError(steps), null);
  assert.equal(createFlow.safeParse({ name: 'External alerts', steps }).success, true);
  steps[1]!.config!.recipient = 'owner';
  assert.match(publicationError(steps)!, /E.164/);
  steps[1]!.config!.recipient = '+573001234567';
  steps[1]!.config!.message = 'x'.repeat(1025);
  assert.match(publicationError(steps)!, /1024/);
  steps[1]!.config!.message = 'New order';
  steps[1]!.config!.templateLanguage = 'invalid';
  assert.notEqual(publicationError(steps), null);
});
