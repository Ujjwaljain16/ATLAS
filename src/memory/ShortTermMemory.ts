import { PageState } from '../worldmodel/types';
import { Action, ToolResult } from '../tools/types';
import { ATLASConfig } from '../config/ATLASConfig';
import { ExecutionReplayLog } from './ExecutionReplayLog';
import { KnowledgeManager } from './KnowledgeManager';

export interface ActionMemoryRecord {
  step: number;
  action_type: string;
  target_desc: string;
  result: 'SUCCESS' | 'FAILURE' | 'PARTIAL';
  change_summary: string;
  timestamp: string;
  /** Self-reflection learning carried forward into next planning cycle */
  learning?: string;
}

export interface FailedAttempt {
  action: string;
  target: string;
  failure_reason: string;
  timestamp: string;
}

export interface FailureRecord {
  sub_goal: string;
  failed_actions: FailedAttempt[];
  retry_count: number;
  last_failure: string;
}

export interface ElementCacheRecord {
  semantic_key: string;
  element_id: string;
  element_summary: string;
  confidence: number;
  cached_at: string;
  valid: boolean;
}

export interface StepStatus {
  description: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETE' | 'FAILED' | 'BLOCKED';
  completed_at?: string;
}

export interface GoalProgress {
  original_goal: string;
  steps: StepStatus[];
  overall_status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETE' | 'FAILED';
}

export class ShortTermMemory {
  private actionHistory: ActionMemoryRecord[] = [];
  private failureRecords = new Map<string, FailureRecord>();
  private elementCache = new Map<string, ElementCacheRecord>();
  private goalProgress: GoalProgress = { original_goal: '', steps: [], overall_status: 'NOT_STARTED' };
  private worldStateWindow: PageState[] = [];
  private stepCounter = 0;
  
  // Phase F: Working Memory Additions
  public execution = new ExecutionReplayLog();
  public knowledge = new KnowledgeManager();
  public visitedUrls = new Set<string>();
  public visitedSemanticObjects = new Set<string>();
  
  constructor(private config: ATLASConfig) {}

  // STAM Methods
  recordAction(record: Omit<ActionMemoryRecord, 'step' | 'timestamp'>) {
    this.actionHistory.push({
      ...record,
      step: ++this.stepCounter,
      timestamp: new Date().toISOString()
    });
    if (this.actionHistory.length > 10) this.actionHistory.shift();
  }

  getActionHistory() { return this.actionHistory; }

  /** Returns the most recent non-empty learning string, if any. Used to inject into planner context. */
  getLastLearning(): string | null {
    for (let i = this.actionHistory.length - 1; i >= 0; i--) {
      if (this.actionHistory[i].learning) return this.actionHistory[i].learning!;
    }
    return null;
  }

  // Failure Memory Methods
  recordFailure(sub_goal: string, attempt: Omit<FailedAttempt, 'timestamp'>) {
    let record = this.failureRecords.get(sub_goal);
    if (!record) {
      record = { sub_goal, failed_actions: [], retry_count: 0, last_failure: '' };
      this.failureRecords.set(sub_goal, record);
    }
    record.failed_actions.push({ ...attempt, timestamp: new Date().toISOString() });
    record.retry_count++;
    record.last_failure = new Date().toISOString();
  }

  getFailureRecord(sub_goal: string) { return this.failureRecords.get(sub_goal); }

  // Element Cache Methods
  cacheElement(record: ElementCacheRecord) {
    this.elementCache.set(record.semantic_key, record);
  }

  getCachedElement(semantic_key: string) {
    const record = this.elementCache.get(semantic_key);
    return record && record.valid ? record : null;
  }

  invalidateElementCache() {
    this.elementCache.clear();
  }

  // Goal Progress Methods
  initializeGoal(goal: string) {
    this.goalProgress = { original_goal: goal, steps: [], overall_status: 'IN_PROGRESS' };
  }

  updateGoalStatus(status: GoalProgress['overall_status']) {
    this.goalProgress.overall_status = status;
  }

  getGoalProgress() { return this.goalProgress; }

  // World State Sliding Window
  pushWorldState(state: PageState) {
    this.worldStateWindow.push(state);
    if (this.worldStateWindow.length > this.config.memory.contextWindowSize) {
      this.worldStateWindow.shift();
    }
    
    // Track working memory context to prevent loops
    if (state.url) {
      this.visitedUrls.add(state.url);
    }
    if (state.semanticObjects) {
      state.semanticObjects.forEach(obj => {
        this.visitedSemanticObjects.add(`${state.url}#${obj.type}`);
      });
    }
  }

  getLastWorldState() {
    return this.worldStateWindow.length > 0 ? this.worldStateWindow[this.worldStateWindow.length - 1] : null;
  }

  getPreviousWorldState() {
    return this.worldStateWindow.length > 1 ? this.worldStateWindow[this.worldStateWindow.length - 2] : null;
  }
}
