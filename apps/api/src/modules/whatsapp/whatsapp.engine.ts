import type { FlowStep } from '@wa/contracts';

export interface MenuResult { text: string; menu: string | null; state: 'waiting' | 'completed' }
function menuText(step: FlowStep): string {
  return step.text + '\n' + step.choices.map((choice, index) => `${index + 1}. ${choice.label}`).join('\n');
}
export function runMenu(steps: FlowStep[], currentMenu: string | null, reply: string): MenuResult {
  const nodes = new Map(steps.map((step) => [step.id, step]));
  let current = currentMenu ? nodes.get(currentMenu) : steps.find((step) => step.kind === 'Start');
  if (!current) throw new Error('Published flow state is unavailable');
  const messages: string[] = [];
  if (currentMenu) {
    if (current.kind !== 'Menu') throw new Error('Published menu state is invalid');
    const answer = reply.trim().toLowerCase();
    const choice = /^[1-9][0-9]*$/.test(answer)
      ? current.choices[Number(answer) - 1]
      : current.choices.find((item) => item.label.trim().toLowerCase() === answer);
    if (!choice) return { text: 'Please reply with an option number or its label.\n' + menuText(current), menu: current.id, state: 'waiting' };
    current = nodes.get(choice.to);
  }
  for (let count = 0; count <= steps.length; count++) {
    if (!current) throw new Error('Published destination is unavailable');
    if (current.kind === 'Menu') {
      messages.push(menuText(current));
      return { text: messages.join('\n\n'), menu: current.id, state: 'waiting' };
    }
    messages.push(current.text);
    if (current.kind === 'End') return { text: messages.join('\n\n'), menu: null, state: 'completed' };
    current = nodes.get(current.choices[0]!.to);
  }
  throw new Error('Automatic flow step limit reached');
}

export function responseChunks(text: string): string[] {
  const chars = Array.from(text);
  const chunks: string[] = [];
  // Stay below Meta's 4096-character cap even for UTF-16 surrogate pairs.
  let chunk = '';
  for (const char of chars) {
    if (chunk.length + char.length > 4000) { chunks.push(chunk); chunk = ''; }
    chunk += char;
  }
  if (chunk) chunks.push(chunk);
  return chunks;
}
