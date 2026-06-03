"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShortTermMemory = void 0;
class ShortTermMemory {
    config;
    state = {
        currentGoal: null,
        activeSubObjectiveIndex: 0,
        lastWorldState: null,
        lastAction: null,
        lastToolResult: null,
        failedAttempts: new Map(), // sub_obj_id → strategies[]
        healedElements: new Map(), // original_id → healed_id
        frameContext: null,
        worldStateWindow: [], // Last N world states
    };
    constructor(config) {
        this.config = config;
    }
    // Record that a strategy was tried and failed
    recordFailedAttempt(subObjId, strategy) {
        const existing = this.state.failedAttempts.get(subObjId) || [];
        this.state.failedAttempts.set(subObjId, [...existing, strategy]);
    }
    // Check if a strategy was already tried
    wasAttempted(subObjId, strategy) {
        return this.state.failedAttempts.get(subObjId)?.includes(strategy) ?? false;
    }
    // Cache healed element reference
    recordHealing(originalId, healedId) {
        this.state.healedElements.set(originalId, healedId);
    }
    // Sliding window — keep last N world states
    pushWorldState(ws) {
        this.state.worldStateWindow.push(ws);
        // Assuming 5 as default for cacheLastN since it wasn't in ATLASConfig schema explicitly
        const cacheLastN = 10;
        if (this.state.worldStateWindow.length > cacheLastN) {
            this.state.worldStateWindow.shift();
        }
        this.state.lastWorldState = ws;
    }
    // Setters and getters
    setCurrentGoal(goal) {
        this.state.currentGoal = goal;
    }
    getCurrentGoal() {
        return this.state.currentGoal;
    }
    setLastAction(action) {
        this.state.lastAction = action;
    }
    setLastToolResult(result) {
        this.state.lastToolResult = result;
    }
}
exports.ShortTermMemory = ShortTermMemory;
