import type { FlowStep } from '@wa/contracts';
import { z } from 'zod';

const step = z.object({
  id: z.string().trim().min(1).max(100),
  kind: z.enum(['Start', 'Message', 'Menu', 'End']),
  text: z.string().max(4000),
  x: z.number().finite().min(-100000).max(100000),
  y: z.number().finite().min(-100000).max(100000),
  choices: z.array(z.object({ label: z.string().max(200), to: z.string().max(100) }).strict()).max(20),
}).strict();
export const createFlow = z.object({ name: z.string().trim().min(1).max(100), steps: z.array(step).max(200) }).strict()
  .refine((value) => new Set(value.steps.map((item) => item.id)).size === value.steps.length);
export const saveFlow = createFlow.safeExtend({ expectedRevision: z.number().int().min(1).max(2147483646) });
export const publishFlow = z.object({ expectedRevision: z.number().int().min(1).max(2147483646) }).strict();

export function publicationError(steps: FlowStep[]): string | null {
  const starts = steps.filter((item) => item.kind === 'Start');
  if (starts.length !== 1) return 'A published flow requires exactly one Start';
  const nodes = new Map(steps.map((item) => [item.id, item]));
  if (nodes.size !== steps.length) return 'Step identifiers must be unique';
  for (const item of steps) {
    if (!item.text.trim()) return 'Every step requires text';
    if (item.kind === 'End' && item.choices.length) return 'End steps cannot have outgoing replies';
    if ((item.kind === 'Start' || item.kind === 'Message') && item.choices.length !== 1) return 'Start and Message steps require exactly one outgoing reply';
    if (item.kind === 'Menu' && !item.choices.length) return 'Menus require at least one reply';
    const labels = new Set<string>();
    for (const choice of item.choices) {
      if (!choice.label.trim() || !nodes.has(choice.to)) return 'Every reply needs a label and an existing destination';
      if (labels.has(choice.label.trim().toLowerCase())) return 'Reply labels must be unique within each step';
      labels.add(choice.label.trim().toLowerCase());
      if (nodes.get(choice.to)?.kind === 'Start') return 'Replies cannot target Start';
    }
  }
  const visited = new Set<string>();
  const active = new Set<string>();
  function walk(id: string): boolean {
    if (active.has(id)) return false;
    if (visited.has(id)) return true;
    active.add(id);
    const item = nodes.get(id)!;
    if (item.kind !== 'Menu') for (const choice of item.choices) if (!walk(choice.to)) return false;
    active.delete(id);
    visited.add(id);
    return true;
  }
  for (const item of steps) if (!walk(item.id)) return 'Published flows cannot contain automatic cycles';
  function visit(initial: string[], neighbors: (id: string) => string[]): Set<string> {
    const pending = [...initial];
    const seen = new Set<string>();
    while (pending.length) {
      const id = pending.pop()!;
      if (seen.has(id)) continue;
      seen.add(id);
      pending.push(...neighbors(id));
    }
    return seen;
  }
  if (visit([starts[0]!.id], (id) => nodes.get(id)!.choices.map((choice) => choice.to)).size !== steps.length) return 'Every step must be reachable from Start';
  const endings = steps.filter((item) => item.kind === 'End').map((item) => item.id);
  if (!endings.length) return 'A published flow requires an End';
  const parents = new Map<string, string[]>();
  for (const item of steps) for (const choice of item.choices) parents.set(choice.to, [...(parents.get(choice.to) ?? []), item.id]);
  if (visit(endings, (id) => parents.get(id) ?? []).size !== steps.length) return 'Every step needs a path to End';
  return null;
}
