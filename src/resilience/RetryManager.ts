import { ATLASConfig } from '../config/ATLASConfig';

export class RetryManager {
  calculateBackoff(attempt: number, config: ATLASConfig['resilience']): number {
    const backoff = config.backoffBaseMs * Math.pow(config.backoffMultiplier, attempt);
    return Math.min(backoff, config.maxBackoffMs);
  }
}
