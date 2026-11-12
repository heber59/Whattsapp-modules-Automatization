import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { FlowStep } from '@wa/contracts';
import { responseChunks, runMenu, runFlow } from './whatsapp.engine';
import { evaluateExpression } from '@wa/contracts';

test('Numeric menu selections take priority over labels and invalid replies preserve the menu', () => {
  const steps: FlowStep[] = [
    { id: 's', kind: 'Start', text: 'Hello', x: 0, y: 0, choices: [{ label: 'Next', to: 'm' }] },
    { id: 'm', kind: 'Menu', text: 'Choose', x: 0, y: 0, choices: [{ label: '2', to: 'a' }, { label: 'Finish', to: 'b' }] },
    { id: 'a', kind: 'End', text: 'First', x: 0, y: 0, choices: [] },
    { id: 'b', kind: 'End', text: 'Second', x: 0, y: 0, choices: [] },
  ];
  assert.equal(runMenu(steps, 'm', '2').text, 'Second');
  assert.equal(runMenu(steps, 'm', ' FINISH ').state, 'completed');
  assert.equal(runMenu(steps, 'm', 'unknown').menu, 'm');
  assert.match(runMenu(steps, null, 'Hello').text, /1\. 2\n2\. Finish/);
});

test('Long replies split below the provider limit without losing Unicode text', () => {
  const input = '🙂'.repeat(5000) + 'done';
  const chunks = responseChunks(input);
  assert.equal(chunks.join(''), input);
  assert(chunks.every(chunk => chunk.length > 0 && chunk.length <= 4000));
  assert(chunks.every(chunk => !/^[\uDC00-\uDFFF]|[\uD800-\uDBFF]$/.test(chunk)));
});

test('Custom fields and bounded shipping calculations produce an immutable order action', () => {
  const make = (id: string, kind: FlowStep['kind'], config?: FlowStep['config'], to?: string): FlowStep => ({ id, kind, text: id, x: 0, y: 0, config, choices: to ? [{ label: 'Next', to }] : [] });
  const steps = [make('s', 'Start', undefined, 'name'), make('name', 'Input', { variable: 'customer', required: true }, 'zone'), make('zone', 'Input', { variable: 'shipping', inputType: 'number', min: 0, max: 10000 }, 'total'), make('total', 'Calculate', { variable: 'total', expression: { op: 'add', args: [25000, { var: 'shipping' }] } }, 'order'), make('order', 'Order', { confirmation: 'automatic', fields: { customer: { var: 'customer' }, total: { var: 'total' } } }, 'end'), make('end', 'End')];
  const first = runFlow(steps, null, 'hello');
  assert.equal(first.currentStep, 'name');
  const second = runFlow(steps, first.currentStep, 'Ana', first.variables);
  const invalid = runFlow(steps, second.currentStep, '-1', second.variables);
  assert.equal(invalid.currentStep, 'zone');
  assert.equal(invalid.actions.some(action => action.type === 'order'), false);
  const result = runFlow(steps, second.currentStep, '5000', second.variables);
  assert.equal(result.state, 'completed');
  assert.equal(result.variables.total, 30000);
  const order = result.actions.find(action => action.type === 'order');
  assert.equal(order?.type === 'order' && order.data.customer, 'Ana');
  assert.equal(order?.type === 'order' && order.total, 30000);
  assert.equal(second.variables.total, undefined);
});

test('Media preserves action order and human approval resumes without recreating an order', () => {
  const steps: FlowStep[] = [
    { id: 's', kind: 'Start', text: 'Welcome', x: 0, y: 0, choices: [{ label: 'Next', to: 'pdf' }] },
    { id: 'pdf', kind: 'Document', text: 'Shirts', config: { url: 'https://example.com/shirts.pdf', filename: 'shirts.pdf' }, x: 0, y: 0, choices: [{ label: 'Next', to: 'order' }] },
    { id: 'order', kind: 'Order', text: 'Awaiting approval', config: { confirmation: 'human', fields: { product: 'shirt' } }, x: 0, y: 0, choices: [{ label: 'Approved', to: 'end' }] },
    { id: 'end', kind: 'End', text: 'Confirmed', x: 0, y: 0, choices: [] },
  ];
  const result = runFlow(steps, null, 'hello');
  assert.equal(result.state, 'paused');
  assert.equal(result.currentStep, 'order');
  assert.deepEqual(result.actions.map(action => action.type), ['text', 'document', 'order', 'text']);
  const resumed = runFlow(steps, result.currentStep, '', result.variables);
  assert.equal(resumed.state, 'completed');
  assert.equal(resumed.actions.some(action => action.type === 'order'), false);
});

test('Catalog prices drive cart totals and arithmetic rejects unsafe operands', () => {
  const steps: FlowStep[] = [
    { id: 's', kind: 'Start', text: 'Hello', x: 0, y: 0, choices: [{ label: 'Next', to: 'catalog' }] },
    { id: 'catalog', kind: 'Catalog', text: 'Choose', config: { products: [{ id: 'shirt', name: 'Shirt', price: 25000 }] }, x: 0, y: 0, choices: [{ label: 'Next', to: 'cart' }] },
    { id: 'cart', kind: 'Cart', text: '', config: { quantity: 2 }, x: 0, y: 0, choices: [{ label: 'Next', to: 'end' }] },
    { id: 'end', kind: 'End', text: 'Total {{subtotal}}', x: 0, y: 0, choices: [] },
  ];
  const result = runFlow(steps, 'catalog', '1');
  assert.equal(result.variables.subtotal, 50000);
  assert.match(result.text, /50000/);
  assert.throws(() => evaluateExpression({ op: 'divide', args: [1, 0] }, {}), /zero/);
  assert.throws(() => evaluateExpression({ var: 'constructor' }, {}), /Invalid/);
  assert.throws(() => evaluateExpression({ op: 'multiply', args: [1e12, 10] }, {}), /range/);
});



test('Optional blank inputs store null while required blanks keep waiting', () => {
  for (const inputType of ['text', 'number', 'email', 'phone'] as const) {
    const steps: FlowStep[] = [
      { id: 's', kind: 'Start', text: 'Hello', x: 0, y: 0, choices: [{ label: 'Next', to: 'input' }] },
      { id: 'input', kind: 'Input', text: 'Optional detail', config: { variable: 'detail', inputType, required: false, min: 2 }, x: 0, y: 0, choices: [{ label: 'Next', to: 'end' }] },
      { id: 'end', kind: 'End', text: 'Done', x: 0, y: 0, choices: [] },
    ];
    const optional = runFlow(steps, 'input', '   ');
    assert.equal(optional.state, 'completed');
    assert.equal(optional.variables.detail, null);
    steps[1]!.config!.required = true;
    const required = runFlow(steps, 'input', '   ');
    assert.equal(required.state, 'waiting');
    assert.equal(required.currentStep, 'input');
    assert.equal(Object.hasOwn(required.variables, 'detail'), false);
  }
});

test('WhatsApp handoff emits approved-template metadata and bounds rendered parameters', () => {
  const steps: FlowStep[] = [
    { id: 's', kind: 'Start', text: 'Welcome', x: 0, y: 0, choices: [{ label: 'Next', to: 'h' }] },
    { id: 'h', kind: 'Handoff', text: 'An advisor will help.', config: { notificationChannel: 'whatsapp', recipient: '+573001234567', templateName: 'owner_alert', templateLanguage: 'es_CO', message: 'Help {{customer}}' }, x: 0, y: 0, choices: [{ label: 'Resume', to: 'e' }] },
    { id: 'e', kind: 'End', text: 'Done', x: 0, y: 0, choices: [] },
  ];
  const result = runFlow(steps, null, 'hi', { customer: 'Ana' });
  assert.equal(result.state, 'paused');
  const alert = result.actions.find(action => action.type === 'handoff');
  assert.equal(alert?.type === 'handoff' && alert.notificationChannel, 'whatsapp');
  assert.equal(alert?.type === 'handoff' && alert.templateName, 'owner_alert');
  assert.equal(alert?.type === 'handoff' && alert.templateLanguage, 'es_CO');
  assert.equal(alert?.type === 'handoff' && alert.text, 'Help Ana');
  assert.throws(() => runFlow(steps, null, 'hi', { customer: 'x'.repeat(1024) }), /1024/);
});
