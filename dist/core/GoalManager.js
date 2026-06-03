"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GoalManager = void 0;
class GoalManager {
    goal = null;
    currentSubObjectiveIndex = 0;
    _lastCompletedSubObjective = '';
    completedSubObjectives = [];
    get activeSubObjective() {
        if (!this.goal || this.currentSubObjectiveIndex >= this.goal.subObjectives.length) {
            throw new Error('No active sub-objective');
        }
        return this.goal.subObjectives[this.currentSubObjectiveIndex];
    }
    get lastCompletedSubObjective() {
        return this._lastCompletedSubObjective;
    }
    load(goal) {
        this.goal = goal;
        this.currentSubObjectiveIndex = 0;
        this._lastCompletedSubObjective = '';
        this.completedSubObjectives = [];
    }
    markComplete(outcome) {
        if (this.goal && this.currentSubObjectiveIndex < this.goal.subObjectives.length) {
            this.completedSubObjectives.push(outcome);
            this._lastCompletedSubObjective = this.goal.subObjectives[this.currentSubObjectiveIndex].label;
            this.currentSubObjectiveIndex++;
        }
    }
    isComplete() {
        if (!this.goal)
            return false;
        return this.currentSubObjectiveIndex >= this.goal.subObjectives.length;
    }
}
exports.GoalManager = GoalManager;
