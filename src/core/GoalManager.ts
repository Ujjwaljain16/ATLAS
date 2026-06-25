import { Goal, SubObjective } from './types';
import { TaskPlan, TaskStep } from '../reasoning/TaskAnalyzer';

export class GoalManager {
  private goal: Goal | null = null;
  private currentSubObjectiveIndex = 0;
  private _lastCompletedSubObjective: string = '';
  private _globalComplete: boolean = false;
  public completedSubObjectives: import('./types').ActionOutcomeRecord[] = [];

  /** Structured plan produced by TaskAnalyzer */
  private taskPlan: TaskPlan | null = null;
  private currentStepIndex = 0;

  get activeSubObjective(): SubObjective {
    if (!this.goal || this.currentSubObjectiveIndex >= this.goal.subObjectives.length) {
      return { id: 'global', label: this.goal?.label || '', targetFieldDescription: '', expectedValue: '', completionCondition: { fieldLabel: '', expectedValue: '' } };
    }
    return this.goal.subObjectives[this.currentSubObjectiveIndex];
  }

  get lastCompletedSubObjective(): string {
    return this._lastCompletedSubObjective;
  }

  get currentGoal(): import('./types').Goal | null {
    return this.goal;
  }

  /** Returns the current active step from the TaskPlan, or null if no plan. */
  get currentStep(): TaskStep | null {
    if (!this.taskPlan || this.currentStepIndex >= this.taskPlan.steps.length) return null;
    return this.taskPlan.steps[this.currentStepIndex];
  }

  /** Returns the label for the current active step. Falls back to overall goal label. */
  get activeStepLabel(): string {
    if (this.currentStep) {
      return `[Step ${this.currentStep.id}/${this.taskPlan!.steps.length}] ${this.currentStep.description}`;
    }
    return this.goal?.label || 'Complete the task';
  }

  /** Returns a compact progress string like "2/7 steps" */
  get stepProgress(): string {
    if (!this.taskPlan) return '—';
    return `${this.currentStepIndex + 1}/${this.taskPlan.steps.length}`;
  }

  load(goal: Goal) {
    this.goal = goal;
    this.currentSubObjectiveIndex = 0;
    this._lastCompletedSubObjective = '';
    this.completedSubObjectives = [];
    this._globalComplete = false;
    this.taskPlan = null;
    this.currentStepIndex = 0;
  }

  /** Called after TaskAnalyzer runs. Sets the structured plan. */
  loadTaskPlan(plan: TaskPlan) {
    this.taskPlan = plan;
    this.currentStepIndex = 0;
  }

  /** Advance to the next step. Returns true if there are more steps, false if plan is exhausted. */
  advanceStep(): boolean {
    if (!this.taskPlan) return false;
    this.currentStepIndex++;
    const hasMore = this.currentStepIndex < this.taskPlan.steps.length;
    if (!hasMore) this._globalComplete = true;
    return hasMore;
  }

  markComplete(outcome: import('./types').ActionOutcomeRecord) {
    this.completedSubObjectives.push(outcome);
    if (outcome.subObjectiveId === 'global') {
      this._lastCompletedSubObjective = this.goal?.label || 'Global Goal';
    } else if (this.goal && this.currentSubObjectiveIndex < this.goal.subObjectives.length) {
      this._lastCompletedSubObjective = this.goal.subObjectives[this.currentSubObjectiveIndex].label;
      this.currentSubObjectiveIndex++;
    }
  }

  isComplete(): boolean {
    if (!this.goal) return false;
    return this._globalComplete || (this.goal.subObjectives.length > 0 && this.currentSubObjectiveIndex >= this.goal.subObjectives.length);
  }

  getTaskPlan(): TaskPlan | null {
    return this.taskPlan;
  }
}
