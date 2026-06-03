import { Goal, SubObjective } from './types';

export class GoalManager {
  private goal: Goal | null = null;
  private currentSubObjectiveIndex = 0;
  private _lastCompletedSubObjective: string = '';
  public completedSubObjectives: import('./types').ActionOutcomeRecord[] = [];

  get activeSubObjective(): SubObjective {
    if (!this.goal || this.currentSubObjectiveIndex >= this.goal.subObjectives.length) {
      throw new Error('No active sub-objective');
    }
    return this.goal.subObjectives[this.currentSubObjectiveIndex];
  }

  get lastCompletedSubObjective(): string {
    return this._lastCompletedSubObjective;
  }

  get currentGoal(): import('./types').Goal | null {
    return this.goal;
  }

  load(goal: Goal) {
    this.goal = goal;
    this.currentSubObjectiveIndex = 0;
    this._lastCompletedSubObjective = '';
    this.completedSubObjectives = [];
  }

  markComplete(outcome: import('./types').ActionOutcomeRecord) {
    if (this.goal && this.currentSubObjectiveIndex < this.goal.subObjectives.length) {
      this.completedSubObjectives.push(outcome);
      this._lastCompletedSubObjective = this.goal.subObjectives[this.currentSubObjectiveIndex].label;
      this.currentSubObjectiveIndex++;
    }
  }

  isComplete(): boolean {
    if (!this.goal) return false;
    return this.currentSubObjectiveIndex >= this.goal.subObjectives.length;
  }
}

