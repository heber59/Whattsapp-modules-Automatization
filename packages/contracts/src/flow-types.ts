export type FlowValue = string | number | boolean | null | FlowValue[] | { [key: string]: FlowValue };
export type FlowVariables = Record<string, FlowValue>;
export type FlowExpression = FlowValue | { var: string } | { op: 'add' | 'subtract' | 'multiply' | 'divide'; args: FlowExpression[] };
export interface FlowNodeConfig {
  variable?: string;
  inputType?: 'text' | 'number' | 'email' | 'phone';
  required?: boolean;
  min?: number;
  max?: number;
  value?: FlowExpression;
  expression?: FlowExpression;
  condition?: { left: FlowExpression; operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte'; right: FlowExpression };
  url?: string;
  filename?: string;
  products?: { id: string; name: string; price: number; description?: string }[];
  cartOperation?: 'add' | 'remove' | 'clear';
  productId?: FlowExpression;
  quantity?: FlowExpression;
  confirmation?: 'automatic' | 'human';
  fields?: Record<string, FlowExpression>;
  recipient?: string;
  message?: string;
  notificationChannel?: 'inbox' | 'whatsapp';
  templateName?: string;
  templateLanguage?: string;
}
export type FlowAction =
  | { type: 'text'; stepId: string; text: string }
  | { type: 'document' | 'image'; stepId: string; url: string; filename?: string; caption: string }
  | { type: 'order'; stepId: string; data: Record<string, FlowValue>; total?: number; confirmation: 'automatic' | 'human' }
  | { type: 'notify' | 'handoff'; stepId: string; recipient: string; text: string; notificationChannel?: 'inbox' | 'whatsapp'; templateName?: string; templateLanguage?: string };
export interface FlowResult {
  text: string;
  menu: string | null;
  currentStep: string | null;
  state: 'waiting' | 'completed' | 'paused';
  variables: FlowVariables;
  actions: FlowAction[];
}
export interface FlowDefinition { schemaVersion: 1; name: string; steps: import('./index').FlowStep[] }
export const flowStepKinds = ['Start', 'Message', 'Menu', 'End', 'Input', 'Set', 'Condition', 'Calculate', 'Document', 'Image', 'Catalog', 'Cart', 'Order', 'Notify', 'Handoff'] as const;
