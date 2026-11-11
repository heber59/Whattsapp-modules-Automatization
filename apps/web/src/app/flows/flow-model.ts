export type Kind = 'Start' | 'Message' | 'Menu' | 'End';
type Choice = { label: string; to: string };
export type Step = {
  id: string;
  kind: Kind;
  text: string;
  x: number;
  y: number;
  choices: Choice[];
};
export const kinds: Kind[] = ['Start', 'Message', 'Menu', 'End'];
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
  return (
    Array.isArray(value) &&
    value.every(
      (step) =>
        step &&
        kinds.includes(step.kind) &&
        typeof step.id === 'string' &&
        typeof step.text === 'string' &&
        Number.isFinite(step.x) &&
        Number.isFinite(step.y) &&
        Array.isArray(step.choices) &&
        step.choices.every(
          (choice: Choice) =>
            choice &&
            typeof choice.label === 'string' &&
            typeof choice.to === 'string',
        ),
    )
  );
}

export function validateFlow(steps: Step[]): string {
  const starts = steps.filter((step) => step.kind === 'Start');
  if (starts.length !== 1) return 'Add exactly one Start step.';

  const byId = new Map(steps.map((step) => [step.id, step]));
  const incoming = new Map<string, string[]>();
  for (const step of steps) {
    if (!step.text.trim()) return 'Give each step some text.';
    if (step.kind === 'Menu' && !step.choices.length)
      return 'Add a reply to each menu.';
    for (const choice of step.choices) {
      if (!choice.label.trim() || !byId.has(choice.to)) {
        return 'Connect each outgoing reply and give it a label.';
      }
      const parents = incoming.get(choice.to) ?? [];
      parents.push(step.id);
      incoming.set(choice.to, parents);
    }
  }

  // Follow replies forward to find steps that a customer can actually visit.
  const reachable = visit([starts[0]!.id], (id) =>
    byId.get(id)!.choices.map((choice) => choice.to),
  );
  if (reachable.size !== steps.length)
    return 'Connect every step to the path from Start.';

  // Follow links backward from each ending to find paths that can finish.
  const endings = steps
    .filter((step) => step.kind === 'End')
    .map((step) => step.id);
  const canFinish = visit(endings, (id) => incoming.get(id) ?? []);
  if (canFinish.size !== steps.length)
    return 'Each step needs a path to an End.';
  return '';
}

function visit(
  initial: string[],
  neighbors: (id: string) => string[],
): Set<string> {
  const pending = [...initial];
  const visited = new Set<string>();
  while (pending.length) {
    const id = pending.pop()!;
    if (visited.has(id)) continue;
    visited.add(id);
    for (const next of neighbors(id)) pending.push(next);
  }
  return visited;
}
