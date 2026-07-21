export interface HealthCheckResult {
  status: 'ok' | 'degraded' | 'error';
  timestamp: string;
  uptimeSeconds: number;
  checks: {
    database: HealthComponentStatus;
    redis: HealthComponentStatus;
  };
}

export interface HealthComponentStatus {
  status: 'up' | 'down';
  latencyMs?: number;
  message?: string;
}
