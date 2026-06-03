import * as fs from 'fs';

export type ReplayEntry = 
  | { type: 'Observation', data: any }
  | { type: 'Decision', data: any }
  | { type: 'Action', data: any }
  | { type: 'Failure', data: any }
  | any; // For now allow any since we just append raw decision objects. In a full refactor, we would strictly map AtlasCore append objects.

export class ExecutionReplayLog {
  private log: ReplayEntry[] = [];
  
  constructor(private sessionId: string) {}

  append(entry: ReplayEntry) {
    this.log.push(entry);
    if (this.log.length > 1000) {
      this.log.shift();
    }
  }

  getEntries(): ReplayEntry[] {
    return this.log;
  }

  async flush() {
    if (!fs.existsSync('./replay_logs')) {
      await fs.promises.mkdir('./replay_logs', { recursive: true });
    }
    await fs.promises.writeFile(`./replay_logs/${this.sessionId}.json`, JSON.stringify({
      session_id: this.sessionId,
      recorded_at: new Date().toISOString(),
      entries: this.log
    }, null, 2));
  }
}
