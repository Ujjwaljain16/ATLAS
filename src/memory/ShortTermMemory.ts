import { WorldState } from '../worldmodel/types';
import { Action, ToolResult } from '../tools/types';
import { ATLASConfig } from '../config/ATLASConfig';

export interface STMState {
  currentGoal: string | null;
  activeSubObjectiveIndex: number;
  lastWorldState: WorldState | null;
  lastAction: Action | null;
  lastToolResult: ToolResult<any> | null;
  failedAttempts: Map<string, string[]>;
  healedElements: Map<string, string>;
  frameContext: string | null;
  worldStateWindow: WorldState[];
}

export class ShortTermMemory {
  private state: STMState = {
    currentGoal: null,
    activeSubObjectiveIndex: 0,
    lastWorldState: null,
    lastAction: null,
    lastToolResult: null,
    failedAttempts: new Map(),     // sub_obj_id → strategies[]
    healedElements: new Map(),     // original_id → healed_id
    frameContext: null,
    worldStateWindow: [],          // Last N world states
  };

  constructor(private config: ATLASConfig) {}
  
  // Record that a strategy was tried and failed
  recordFailedAttempt(subObjId: string, strategy: string): void {
    const existing = this.state.failedAttempts.get(subObjId) || [];
    this.state.failedAttempts.set(subObjId, [...existing, strategy]);
  }
  
  // Check if a strategy was already tried
  wasAttempted(subObjId: string, strategy: string): boolean {
    return this.state.failedAttempts.get(subObjId)?.includes(strategy) ?? false;
  }
  
  // Cache healed element reference
  recordHealing(originalId: string, healedId: string): void {
    this.state.healedElements.set(originalId, healedId);
  }
  
  // Sliding window — keep last N world states
  pushWorldState(ws: WorldState): void {
    this.state.worldStateWindow.push(ws);
    // Assuming 5 as default for cacheLastN since it wasn't in ATLASConfig schema explicitly
    const cacheLastN = 10;
    if (this.state.worldStateWindow.length > cacheLastN) {
      this.state.worldStateWindow.shift();
    }
    this.state.lastWorldState = ws;
  }

  // Setters and getters
  setCurrentGoal(goal: string) {
    this.state.currentGoal = goal;
  }
  
  getCurrentGoal() {
    return this.state.currentGoal;
  }

  setLastAction(action: Action) {
    this.state.lastAction = action;
  }

  setLastToolResult(result: ToolResult<any>) {
    this.state.lastToolResult = result;
  }
}
