export type HealthStatus = 'ok' | 'unavailable';

export interface HealthResponse {
  status: 'ok' | 'degraded';
  services: {
    database: HealthStatus;
    queue: HealthStatus;
  };
}

export type FlowStepKind = typeof import('./flow-types').flowStepKinds[number];
export interface FlowStep {
  id: string;
  kind: FlowStepKind;
  text: string;
  x: number;
  y: number;
  choices: { label: string; to: string }[];
  config?: import('./flow-types').FlowNodeConfig;
}
export interface FlowSummary {
  id: string;
  businessId: string;
  name: string;
  revision: number;
  publishedVersion: number | null;
  publishedRevision: number | null;
  updatedAt: string;
}
export interface FlowDetail extends FlowSummary { steps: FlowStep[] }
export interface PublishedFlowVersion {
  flowId: string;
  businessId: string;
  version: number;
  sourceRevision: number;
  name: string;
  steps: FlowStep[];
  publishedAt: string;
}

export * from './flow-types';
export * from './flow-runtime';
