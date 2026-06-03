import { EventBus } from './EventBus';
import { ATLASEvent } from './events';

export class MetricsRegistry {
  private startTime = Date.now();
  private goalsCompleted = 0;
  private actionsExecuted = 0;
  private actionsFailed = 0;
  private recoveriesAttempted = 0;
  private recoveriesSuccessful = 0;
  private totalConfidence = 0;
  private decisionCount = 0;
  private totalStepDuration = 0;
  private toolExecutionCount = 0;
  
  private phaseMetrics: any = null;
  
  private lastStepStartTime = Date.now();

  constructor(private bus: EventBus) {
    this.bus.onAll(event => this.handleEvent(event));
  }

  private handleEvent(event: ATLASEvent) {
    switch (event.type) {
      case 'SessionComplete':
        if ((event as any).result === 'SUCCESS') this.goalsCompleted++;
        this.phaseMetrics = (event as any).metrics || null;
        break;
      case 'ActionExecuted':
        this.toolExecutionCount++;
        if ((event as any).success) {
          this.actionsExecuted++;
        } else {
          this.actionsFailed++;
        }
        if ((event as any).durationMs) {
          this.totalStepDuration += (event as any).durationMs;
        }
        break;
      case 'RecoveryAttempted':
        this.recoveriesAttempted++;
        break;
      case 'DecisionMade':
        this.decisionCount++;
        if (typeof (event as any).confidence === 'number') {
          this.totalConfidence += (event as any).confidence;
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
      const roundedPhaseTimings: Record<string, number> = {};
      for (const key in this.phaseMetrics) {
        roundedPhaseTimings[key] = Math.round(this.phaseMetrics[key] * 100) / 100;
      }
      Object.assign(baseReport, { phaseTimings: roundedPhaseTimings });
    }

    return baseReport;
  }
}
