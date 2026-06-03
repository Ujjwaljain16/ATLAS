"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetricsRegistry = void 0;
class MetricsRegistry {
    bus;
    startTime = Date.now();
    goalsCompleted = 0;
    actionsExecuted = 0;
    actionsFailed = 0;
    recoveriesAttempted = 0;
    recoveriesSuccessful = 0;
    totalConfidence = 0;
    decisionCount = 0;
    totalStepDuration = 0;
    toolExecutionCount = 0;
    phaseMetrics = null;
    lastStepStartTime = Date.now();
    constructor(bus) {
        this.bus = bus;
        this.bus.onAll(event => this.handleEvent(event));
    }
    handleEvent(event) {
        switch (event.type) {
            case 'SessionComplete':
                if (event.result === 'SUCCESS')
                    this.goalsCompleted++;
                this.phaseMetrics = event.metrics || null;
                break;
            case 'ActionExecuted':
                this.toolExecutionCount++;
                if (event.success) {
                    this.actionsExecuted++;
                }
                else {
                    this.actionsFailed++;
                }
                if (event.durationMs) {
                    this.totalStepDuration += event.durationMs;
                }
                break;
            case 'RecoveryAttempted':
                this.recoveriesAttempted++;
                break;
            case 'DecisionMade':
                this.decisionCount++;
                if (typeof event.confidence === 'number') {
                    this.totalConfidence += event.confidence;
                }
                break;
            case 'ObservationReady':
                this.lastStepStartTime = Date.now();
                break;
        }
    }
    generateReport() {
        const runtimeMs = Date.now() - this.startTime;
        const avgConfidence = this.decisionCount > 0 ? (this.totalConfidence / this.decisionCount) : 0;
        const avgStepDuration = this.decisionCount > 0 ? (this.totalStepDuration / this.decisionCount) : 0;
        const baseReport = {
            goalCompleted: this.goalsCompleted > 0,
            steps: this.decisionCount,
            avgConfidence: parseFloat(avgConfidence.toFixed(2)),
            avgStepDurationMs: Math.round(avgStepDuration),
            runtimeMs,
            recoveryAttempts: this.recoveriesAttempted,
            actionsExecuted: this.actionsExecuted,
            toolExecutionCount: this.toolExecutionCount
        };
        if (this.phaseMetrics) {
            const roundedPhaseTimings = {};
            for (const key in this.phaseMetrics) {
                roundedPhaseTimings[key] = Math.round(this.phaseMetrics[key] * 100) / 100;
            }
            Object.assign(baseReport, { phaseTimings: roundedPhaseTimings });
        }
        return baseReport;
    }
}
exports.MetricsRegistry = MetricsRegistry;
