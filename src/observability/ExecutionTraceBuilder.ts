import { ExecutionResult } from '../core/types';
import { ExecutionReplayLog } from '../memory/ExecutionReplayLog';
import * as fs from 'fs';

export class ExecutionTraceBuilder {
  private startedAt = new Date().toISOString();

  constructor(private sessionId: string, private goal: string, private memory: ExecutionReplayLog) {}
  
  generateReport(result: ExecutionResult): string {
    const endedAt = new Date().toISOString();
    const lines: string[] = [];
    const entries = this.memory.getEntries();
    
    lines.push('═'.repeat(64));
    lines.push(' ATLAS EXECUTION TRACE');
    lines.push(` Session:   ${this.sessionId}`);
    lines.push(` Goal:      ${this.goal}`);
    lines.push(` Started:   ${this.startedAt}`);
    lines.push(` Ended:     ${endedAt}`);
    lines.push(` Result:    ${result.status === 'SUCCESS' ? 'SUCCESS  ✓' : 'FAILURE  ✗'}`);
    lines.push(` Duration:  ${result.durationMs} ms  |  Steps: ${entries.length}`);
    lines.push('═'.repeat(64));
    lines.push('');
    
    for (const step of entries) {
      lines.push(`Step ${step.step}  [${step.activeSubObjective || step.fsmState || 'N/A'}]`);
      lines.push(`  Target:     ${step.targetLabel || 'Unknown Element'}`);
      lines.push(`  Internal:   ${step.targetSelector || 'N/A'}`);
      lines.push(`  Confidence: ${step.confidence?.toFixed(2) || '0.00'}`);
      
      if (step.alternatives && step.alternatives.length > 0) {
        lines.push(``);
        lines.push(`  Alternatives Considered:`);
        step.alternatives.forEach((alt: any, idx: number) => {
          lines.push(`  ${idx + 1}. ${alt.label.substring(0, 25).padEnd(25)} ${(alt.confidence || 0).toFixed(2)}`);
        });
        lines.push(``);
        lines.push(`  Decision:   Selected Candidate #1 (${step.matchedSignal})`);
      } else if (step.confidence) {
        lines.push(`  Decision:   Direct Match (${step.matchedSignal})`);
      }
      
      lines.push(`  Action:     ${step.action?.name}`);
      lines.push(`  Result:     ${step.toolResult?.success ? 'SUCCESS' : 'FAILURE'}`);
      
      if (step.screenshotPath) {
        lines.push(`  Screenshot: ${step.screenshotPath}`);
      }
      lines.push('  ' + '─'.repeat(55));
    }
    
    lines.push('');
    if (result.status === 'SUCCESS') {
      lines.push(' ALL SUB-OBJECTIVES COMPLETE');
    }
    lines.push('═'.repeat(64));
    
    const report = lines.join('\n');
    fs.writeFileSync('./execution_trace.txt', report);
    return report;
  }
}
