import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { FlowStep } from '@wa/contracts';
import { responseChunks, runMenu } from './whatsapp.engine';

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
