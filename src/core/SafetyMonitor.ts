import { EventBus } from '../observability/EventBus';
import { BrowserController } from '../browser/BrowserController';

// Stubs for Phase 11/12
export interface TraceBuilder {
  generateReport(result?: any, metrics?: any, verbose?: boolean): string | void;
}
export interface ReplayLog {
  flush(): Promise<void>;
}

export class SafetyMonitor {
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private eventBus: EventBus,
    private traceBuilder: TraceBuilder,
    private replayLog: ReplayLog,
    private browser: BrowserController
  ) {}
  
  start(config: { globalTimeoutMs: number }): void {
    // REFINEMENT R2: Runs as an independent Node.js timer — fires regardless
    // of what the main event loop is doing. A hung tool call (e.g., Playwright
    // waiting forever on a network request) CANNOT block this timer.
    this.timer = setTimeout(async () => {
      this.eventBus.emit({ 
        type: 'FailureDetected', 
        severity: 'FATAL', 
        source: 'SYSTEM', 
        code: 'GLOBAL_TIMEOUT_EXCEEDED' 
      });
      
      // CRITICAL FIX: process.exit() bypasses the `finally` block in
      // AtlasCore.run(), which means traceBuilder.generateReport() and
      // replayLog.flush() NEVER execute — leaving you with no evidence file
      // on timeout. Flush synchronously BEFORE calling process.exit().
      try {
        this.traceBuilder.generateReport();  // writes execution_trace.txt
        await this.replayLog.flush();              // writes replay_logs/*.json
        await this.browser.forceClose();     // releases Playwright resources
      } catch (_flushErr) {
        // Ignore flush errors — already in FATAL timeout path.
        // Best-effort: we still get partial output even if flush partially fails.
      } finally {
        process.exit(1); // Non-bypassable after flush attempt
      }
    }, config.globalTimeoutMs);
    
    // CRITICAL: timer.unref() tells Node.js: "do not keep the process alive
    // solely because this timer is pending". Without unref(), after AtlasCore
    // completes successfully and calls safetyMonitor.stop(), the process hangs
    // for up to globalTimeoutMs waiting for a timer that is never needed.
    this.timer.unref();
  }
  
  stop(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null; // prevent double-clear
    }
  }
}
