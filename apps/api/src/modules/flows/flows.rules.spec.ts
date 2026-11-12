import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { FlowStep } from '@wa/contracts';
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
