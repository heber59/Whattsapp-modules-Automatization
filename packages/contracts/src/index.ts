export type HealthStatus = 'ok' | 'unavailable';

export interface HealthResponse {
  status: 'ok' | 'degraded';
  services: {
    database: HealthStatus;
    queue: HealthStatus;
  };
}

export type FlowStepKind = 'Start' | 'Message' | 'Menu' | 'End';
export interface FlowStep {
  id: string;
  kind: FlowStepKind;
  text: string;
  x: number;
  y: number;
  choices: { label: string; to: string }[];
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
