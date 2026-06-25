import { ExecutionLease, LeaseState } from './ExecutionLease';

export interface Objective {
  id: string;
  description: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETE' | 'FAILED';
}

export interface RecoveryEvent {
  target: string;
  classification: string;
  strategyUsed: string;
  success: boolean;
  timestamp: number;
}

export class ExecutionContext {
  public goal: string;
  public objectives: Objective[] = [];
  public activeObjective?: Objective;
  public executionLease?: ExecutionLease;
  public progress: string = 'INITIALIZING';
  public recoveryHistory: RecoveryEvent[] = [];

  constructor(goal: string) {
    this.goal = goal;
  }

  setObjective(description: string) {
    if (this.activeObjective && this.activeObjective.description !== description) {
      this.activeObjective.status = 'COMPLETE';
    }
    
    let obj = this.objectives.find(o => o.description === description);
    if (!obj) {
      obj = {
        id: `obj_${Date.now()}`,
        description,
        status: 'IN_PROGRESS'
      };
      this.objectives.push(obj);
    } else {
      obj.status = 'IN_PROGRESS';
    }
    this.activeObjective = obj;
    this.progress = 'OBJECTIVE_STARTED';
  }

  grantLease(target: { elementId: string; selector: string; label: string }, intendedAction: any) {
    this.executionLease = {
      target,
      intendedAction,
      state: LeaseState.LOCKED,
      createdAt: Date.now()
    };
    this.progress = 'TARGET_LOCKED';
    // Clear recovery history for the new target
    this.recoveryHistory = [];
  }

  updateLeaseState(state: LeaseState) {
    if (this.executionLease) {
      this.executionLease.state = state;
    }
  }

  addRecoveryEvent(event: RecoveryEvent) {
    this.recoveryHistory.push(event);
  }

  getSummary() {
    return {
      active_objective: this.activeObjective?.description || 'None',
      progress: this.progress,
      lease_target: this.executionLease ? this.executionLease.target.label : null,
      lease_state: this.executionLease ? this.executionLease.state : null,
      recovery_history: this.recoveryHistory.slice(-5)
    };
  }
}
