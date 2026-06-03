import { EventBus } from './EventBus';
import { ATLASEvent } from './events';
import { ATLASConfig } from '../config/ATLASConfig';
import { v4 as uuid } from 'uuid';

export class StructuredLogger {
  constructor(private bus: EventBus, private config: ATLASConfig['logging']) {
    bus.onAll(event => this.handleEvent(event));
  }
  
  private handleEvent(event: ATLASEvent): void {
    const { sessionId, executionId, stepId, actionId, type, ...rest } = event as any;

    const entry = {
      timestamp: new Date().toISOString(),
      event_type: type,
      level: this.levelFor(event),
      sessionId,
      executionId,
      stepId,
      actionId,
      ...rest,
    };
    
    // Redact sensitive fields
    const sanitized = this.redact(entry, this.config.redactFields);
    
    // Output
    if (this.config.format === 'json') {
      process.stdout.write(JSON.stringify(sanitized) + '\n');
    } else {
      console.log(this.prettyFormat(sanitized));
    }
  }
  
  private levelFor(event: ATLASEvent): string {
    if (event.type === 'FailureDetected') return 'ERROR';
    if (event.type === 'CoordinateFallbackTriggered') return 'WARN';
    if (event.type === 'RecoveryAttempted') return 'WARN';
    return 'INFO';
  }

  private redact(entry: any, fields: string[]): any {
    if (typeof entry !== 'object' || entry === null) return entry;
    
    const redacted = { ...entry };
    for (const key of Object.keys(redacted)) {
      if (fields.includes(key.toLowerCase())) {
        redacted[key] = '[REDACTED]';
      } else if (typeof redacted[key] === 'object') {
        redacted[key] = this.redact(redacted[key], fields);
      }
    }
    return redacted;
  }

  private prettyFormat(entry: any): string {
    return `[${entry.level}] ${entry.event_type} - ${JSON.stringify(entry)}`;
  }
}
