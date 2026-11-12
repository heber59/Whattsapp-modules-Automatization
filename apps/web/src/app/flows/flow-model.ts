import { flowStepKinds, parseFlowDefinition, publicationError, type FlowStep, type FlowStepKind } from '@wa/contracts';
export type Kind = FlowStepKind;
export type Step = FlowStep;
export const kinds: readonly Kind[] = flowStepKinds;
export const key = 'wa.playground.v1';
export const example: Step[] = [
  {
    id: 'a',
    kind: 'Start',
    text: 'Welcome',
    x: 25,
    y: 35,
    choices: [{ label: 'Next', to: 'b' }],
  },
  {
    id: 'b',
    kind: 'Menu',
    text: 'How can we help?',
    x: 270,
    y: 35,
    choices: [
      { label: 'Store hours', to: 'c' },
      { label: 'Pickup', to: 'd' },
    ],
  },
  {
    id: 'c',
    kind: 'Message',
    text: 'We open at 9 AM.',
    x: 520,
    y: 35,
    choices: [{ label: 'Next', to: 'e' }],
  },
  {
    id: 'd',
    kind: 'Message',
    text: 'Pickup is available at the counter.',
    x: 520,
    y: 180,
    choices: [{ label: 'Next', to: 'e' }],
  },
  { id: 'e', kind: 'End', text: 'See you soon!', x: 770, y: 90, choices: [] },
];
export function validDraft(value: unknown): value is Step[] {
  try { parseFlowDefinition({schemaVersion:1,name:'Draft',steps:value}); return true; }
  catch { return false; }
}

export function validateFlow(steps: Step[]): string {
  try {
    const definition=parseFlowDefinition({schemaVersion:1,name:'Draft',steps});
    return publicationError(definition.steps) ?? '';
  } catch (cause) { return cause instanceof Error ? cause.message : 'Invalid flow definition'; }
}
