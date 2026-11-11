export type HealthStatus = 'ok' | 'unavailable';

export interface HealthResponse {
  status: 'ok' | 'degraded';
  services: {
    database: HealthStatus;
    queue: HealthStatus;
  };
}
