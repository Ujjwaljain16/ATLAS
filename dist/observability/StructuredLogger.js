"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StructuredLogger = void 0;
class StructuredLogger {
    bus;
    config;
    constructor(bus, config) {
        this.bus = bus;
        this.config = config;
        bus.onAll(event => this.handleEvent(event));
    }
    handleEvent(event) {
        const { sessionId, executionId, stepId, actionId, type, ...rest } = event;
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
        }
        else {
            console.log(this.prettyFormat(sanitized));
        }
    }
    levelFor(event) {
        if (event.type === 'FailureDetected')
            return 'ERROR';
        if (event.type === 'CoordinateFallbackTriggered')
            return 'WARN';
        if (event.type === 'RecoveryAttempted')
            return 'WARN';
        return 'INFO';
    }
    redact(entry, fields) {
        if (typeof entry !== 'object' || entry === null)
            return entry;
        const redacted = { ...entry };
        for (const key of Object.keys(redacted)) {
            if (fields.includes(key.toLowerCase())) {
                redacted[key] = '[REDACTED]';
            }
            else if (typeof redacted[key] === 'object') {
                redacted[key] = this.redact(redacted[key], fields);
            }
        }
        return redacted;
    }
    prettyFormat(entry) {
        return `[${entry.level}] ${entry.event_type} - ${JSON.stringify(entry)}`;
    }
}
exports.StructuredLogger = StructuredLogger;
