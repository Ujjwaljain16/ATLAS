import { ExecutionResult } from '../core/types';
import { ExecutionReplayLog } from '../memory/ExecutionReplayLog';
import * as fs from 'fs';

export class ExecutionTraceBuilder {
  private startedAt = new Date().toISOString();

  constructor(private sessionId: string, private goal: string, private memory: ExecutionReplayLog) {}
  
  generateReport(result: ExecutionResult, metrics: any, verbose: boolean = false): string {
    const entries = this.memory.getEntries();
    
    let exactMatches = 0;
    let semanticMatches = 0;
    let totalConfidence = 0;
    let confidenceCount = 0;
    let recoveries = 0; // simplistic metric for now
    
    // --- BUILD VERBOSE TRACE ---
    const vLines: string[] = [];
    vLines.push('════════════════════════════════════════════════════════════════');
    vLines.push(' ATLAS VERBOSE EXECUTION TRACE');
    vLines.push(` Session:   ${this.sessionId}`);
    vLines.push(` Goal:      ${this.goal}`);
    vLines.push('════════════════════════════════════════════════════════════════\n');
    
    for (const step of entries) {
      if (step.fsmState === 'RECOVER') recoveries++;
      
      const targetStr = this.cleanLabel(step.targetLabel || 'Unknown Element');
      const stepTitle = (step.activeSubObjective || step.fsmState || 'N/A').toUpperCase();
      
      vLines.push(`STEP ${(step.step || 0).toString().padStart(2, '0')} ─ ${stepTitle}`);
      vLines.push('');
      vLines.push(`Decision\n✓ ${targetStr}\n`);
      
      if (step.confidence) {
        totalConfidence += step.confidence;
        confidenceCount++;
        if (step.discoveryTier <= 2) exactMatches++;
        else semanticMatches++;
        
        vLines.push(`Confidence\n${step.confidence.toFixed(2)} | Tier ${step.discoveryTier} | ${step.matchedSignal}\n`);
      }
      
      vLines.push(`Action\n${step.action?.name || 'N/A'}\n`);
      vLines.push(`Result\n${step.toolResult?.success ? 'SUCCESS' : 'FAILURE'}\n`);
      
      if (step.alternatives && step.alternatives.length > 0) {
        vLines.push(`Alternatives`);
        step.alternatives.forEach((alt: any) => {
          const cleanAlt = this.cleanLabel(alt.label);
          const conf = alt.confidence || 0;
          vLines.push(`• ${cleanAlt.substring(0, 20).padEnd(22)} ${this.getProgressBar(conf)} ${conf.toFixed(2)}`);
        });
        vLines.push('');
      }
      
      if (step.confidence) {
        vLines.push(`Reasoning\nRequested: ${step.activeSubObjective || 'N/A'}\nSelected:  ${targetStr}\nWhy:       ${step.matchedSignal}\n`);
      }
      
      vLines.push('─'.repeat(64) + '\n');
    }
    
    const verboseReport = vLines.join('\n');
    fs.writeFileSync('./execution_trace.txt', verboseReport);
    
    // --- BUILD USER SUMMARY (THE DREAM OUTPUT) ---
    const avgConf = confidenceCount > 0 ? (totalConfidence / confidenceCount) : 0;
    
    const sLines: string[] = [];
    sLines.push('ATLAS EXECUTION REPORT\n');
    sLines.push(`Goal\n${this.goal}\n`);
    sLines.push(`Status\n${result.status === 'SUCCESS' ? 'SUCCESS' : 'FAILURE'}\n`);
    sLines.push(`Runtime\n${(result.durationMs / 1000).toFixed(1)}s\n`);
    sLines.push(`Confidence\n${avgConf.toFixed(2)}\n`);
    sLines.push(`Steps\n${entries.length}/${entries.length}\n`);
    
    sLines.push('Execution Timeline\n');
    entries.forEach((step, idx) => {
      const stepNum = (idx + 1).toString().padStart(2, '0');
      const target = this.cleanLabel(step.targetLabel || step.fsmState || 'Unknown');
      const conf = step.confidence ? step.confidence.toFixed(2) : 'N/A ';
      const mark = step.toolResult?.success ? '✓' : '✗';
      sLines.push(`[${stepNum}] ${target.substring(0, 20).padEnd(20)} ${mark} ${conf}`);
    });
    
    sLines.push('\nInsights\n');
    sLines.push(`• Exact Matches: ${exactMatches}`);
    sLines.push(`• Semantic Matches: ${semanticMatches}`);
    sLines.push(`• Recoveries: ${recoveries}`);
    sLines.push(`• Avg Confidence: ${avgConf.toFixed(2)}\n`);
    
    if (metrics && metrics.phaseTimings) {
      sLines.push('Performance\n');
      sLines.push(`Navigation      ${(metrics.phaseTimings.navigationMs / 1000).toFixed(1)}s`);
      sLines.push(`Observation     ${(metrics.phaseTimings.observationMs / 1000).toFixed(1)}s`);
      sLines.push(`Reasoning       ${(metrics.phaseTimings.reasoningMs / 1000).toFixed(1)}s`);
      sLines.push(`Actions         ${(metrics.phaseTimings.actionMs / 1000).toFixed(1)}s`);
      sLines.push(`Validation      ${(metrics.phaseTimings.validationMs / 1000).toFixed(1)}s\n`);
    }
    
    sLines.push(result.status === 'SUCCESS' ? 'CERTIFIED SUCCESS' : 'EXECUTION FAILED');
    
    const summaryReport = sLines.join('\n');
    
    return verbose ? verboseReport + '\n' + summaryReport : summaryReport;
  }
  
  private getProgressBar(score: number): string {
    const filled = Math.round(score * 10);
    return '█'.repeat(filled) + '░'.repeat(10 - filled);
  }
  
  private cleanLabel(label: string): string {
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-/.test(label)) {
      return 'Unnamed Input';
    }
    return label;
  }
}
