export interface ConfidenceSample {
  phase: 'DISCOVERY' | 'PLANNING' | 'ACTION' | 'VERIFICATION';
  value: number; // 0.0 - 1.0
  step: number;
}

export interface ConfidenceReport {
  sessionConfidence: number;
  byPhase: {
    discovery: number | null;
    planning: number | null;
    action: number | null;
    verification: number | null;
  };
  trend: 'IMPROVING' | 'DEGRADING' | 'STABLE';
  samples: number;
}

/**
 * ConfidenceTracker aggregates confidence scores across all phases of execution.
 * Produces a session-wide confidence score and per-phase breakdown for the final report.
 */
export class ConfidenceTracker {
  private samples: ConfidenceSample[] = [];

  record(phase: ConfidenceSample['phase'], value: number, step: number): void {
    this.samples.push({ phase, value: Math.max(0, Math.min(1, value)), step });
  }

  report(): ConfidenceReport {
    if (this.samples.length === 0) {
      return {
        sessionConfidence: 0,
        byPhase: { discovery: null, planning: null, action: null, verification: null },
        trend: 'STABLE',
        samples: 0
      };
    }

    const byPhase = this.groupByPhase();
    const sessionConfidence = this.average(this.samples.map(s => s.value));

    return {
      sessionConfidence: Math.round(sessionConfidence * 1000) / 10, // e.g. 87.4
      byPhase: {
        discovery:    byPhase.DISCOVERY    ? Math.round(this.average(byPhase.DISCOVERY)    * 1000) / 10 : null,
        planning:     byPhase.PLANNING     ? Math.round(this.average(byPhase.PLANNING)     * 1000) / 10 : null,
        action:       byPhase.ACTION       ? Math.round(this.average(byPhase.ACTION)        * 1000) / 10 : null,
        verification: byPhase.VERIFICATION ? Math.round(this.average(byPhase.VERIFICATION) * 1000) / 10 : null
      },
      trend: this.calculateTrend(),
      samples: this.samples.length
    };
  }

  private groupByPhase(): Partial<Record<ConfidenceSample['phase'], number[]>> {
    const out: Partial<Record<ConfidenceSample['phase'], number[]>> = {};
    for (const s of this.samples) {
      if (!out[s.phase]) out[s.phase] = [];
      out[s.phase]!.push(s.value);
    }
    return out;
  }

  private average(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  private calculateTrend(): 'IMPROVING' | 'DEGRADING' | 'STABLE' {
    if (this.samples.length < 4) return 'STABLE';
    const half = Math.floor(this.samples.length / 2);
    const firstHalf  = this.average(this.samples.slice(0, half).map(s => s.value));
    const secondHalf = this.average(this.samples.slice(half).map(s => s.value));
    const delta = secondHalf - firstHalf;
    if (delta > 0.05) return 'IMPROVING';
    if (delta < -0.05) return 'DEGRADING';
    return 'STABLE';
  }

  /** Format a human-readable report string for terminal output. */
  formatReport(): string {
    const r = this.report();
    const trendIcon = r.trend === 'IMPROVING' ? '↑' : r.trend === 'DEGRADING' ? '↓' : '→';
    const phaseStr = [
      r.byPhase.discovery    != null ? `Discovery: ${r.byPhase.discovery}%`    : null,
      r.byPhase.planning     != null ? `Planning: ${r.byPhase.planning}%`      : null,
      r.byPhase.action       != null ? `Action: ${r.byPhase.action}%`          : null,
      r.byPhase.verification != null ? `Verification: ${r.byPhase.verification}%` : null
    ].filter(Boolean).join('  |  ');

    return [
      `\x1b[1m\x1b[33m⬡ Session Confidence: ${r.sessionConfidence}% ${trendIcon}\x1b[0m`,
      `  ${phaseStr}`,
      `  Samples: ${r.samples}`
    ].join('\n');
  }
}
