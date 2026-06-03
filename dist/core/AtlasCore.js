"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AtlasCore = void 0;
const types_1 = require("./types");
const uuid_1 = require("uuid");
class AtlasCore {
    config;
    eventBus;
    browser;
    toolRuntime;
    perceptionEngine;
    worldModelBuilder;
    memory;
    goalManager;
    reasoningEngine;
    resilienceEngine;
    safetyMonitor;
    traceBuilder;
    replayLog;
    sessionId;
    currentState = types_1.FSMState.INIT;
    stepCount = 0;
    executionId = (0, uuid_1.v4)();
    currentActionId;
    sessionStartTime = Date.now();
    timingMetrics = {
        navigationMs: 0,
        observationMs: 0,
        worldModelMs: 0,
        reasoningMs: 0,
        actionMs: 0,
        validationMs: 0,
        teardownMs: 0
    };
    constructor(config, eventBus, browser, toolRuntime, perceptionEngine, worldModelBuilder, memory, goalManager, reasoningEngine, resilienceEngine, safetyMonitor, traceBuilder, replayLog, sessionId) {
        this.config = config;
        this.eventBus = eventBus;
        this.browser = browser;
        this.toolRuntime = toolRuntime;
        this.perceptionEngine = perceptionEngine;
        this.worldModelBuilder = worldModelBuilder;
        this.memory = memory;
        this.goalManager = goalManager;
        this.reasoningEngine = reasoningEngine;
        this.resilienceEngine = resilienceEngine;
        this.safetyMonitor = safetyMonitor;
        this.traceBuilder = traceBuilder;
        this.replayLog = replayLog;
        this.sessionId = sessionId;
    }
    emitEvent(event) {
        this.eventBus.emit({
            sessionId: this.sessionId,
            executionId: this.executionId,
            stepId: this.stepCount,
            actionId: this.currentActionId,
            ...event
        });
    }
    transition(newState) {
        const valid = types_1.VALID_TRANSITIONS[this.currentState] || [];
        if (!valid.includes(newState) && this.currentState !== types_1.FSMState.FAILED) {
            // In production, we might throw, but let's just log or force
        }
        this.currentState = newState;
    }
    isTerminal() {
        return this.currentState === types_1.FSMState.COMPLETE ||
            this.currentState === types_1.FSMState.TEARDOWN ||
            this.currentState === types_1.FSMState.FAILED;
    }
    async run(goal) {
        this.safetyMonitor.start(this.config.execution); // REFINEMENT R2: independent watchdog
        this.emitEvent({ type: 'SessionStarted', goal: goal.label, timestamp: new Date().toISOString() });
        try {
            this.transition(types_1.FSMState.VALIDATE_GOAL);
            this.goalManager.load(goal);
            this.transition(types_1.FSMState.LAUNCH_BROWSER);
            const navStart = performance.now();
            await this.toolRuntime.execute({ name: 'open_browser', params: this.config.browser }, this.browser);
            this.transition(types_1.FSMState.NAVIGATE);
            const navResult = await this.toolRuntime.execute({
                name: 'navigate_to_url',
                params: {
                    url: goal.targetUrl,
                    allowedDomains: this.config.navigation.allowedDomains,
                    strictDomainCheck: this.config.navigation.strictDomainCheck
                }
            }, this.browser);
            this.timingMetrics.navigationMs += performance.now() - navStart;
            if (!navResult.success) {
                throw new Error('Navigation failed: ' + navResult.error?.message);
            }
            // Core ReAct loop
            while (!this.isTerminal()) {
                this.stepCount++;
                if (this.stepCount > this.config.execution.maxSteps) {
                    this.emitEvent({ type: 'FailureDetected', severity: 'FATAL', source: 'SYSTEM', code: 'MAX_STEPS_EXCEEDED' });
                    this.transition(types_1.FSMState.FAILED);
                    break;
                }
                try {
                    await this.executeStep();
                }
                catch (stepError) {
                    this.emitEvent({ type: 'FailureDetected', severity: 'RECOVERABLE', source: 'SYSTEM', code: stepError.message });
                    const recovery = await this.resilienceEngine.handle({
                        code: 'STEP_ERROR',
                        message: stepError.message,
                        severity: 'RECOVERABLE',
                        source: 'SYSTEM'
                    });
                    if (!recovery.success) {
                        throw stepError;
                    }
                    this.transition(types_1.FSMState.RECOVER);
                }
            }
        }
        catch (error) {
            this.emitEvent({ type: 'FailureDetected', severity: 'FATAL', source: 'SYSTEM', code: error.message });
            this.transition(types_1.FSMState.FAILED);
        }
        finally {
            this.safetyMonitor.stop();
            this.transition(types_1.FSMState.TEARDOWN);
            const tdStart = performance.now();
            await this.browser.forceClose();
            this.timingMetrics.teardownMs += performance.now() - tdStart;
        }
        const finalResult = this.buildResult();
        this.emitEvent({
            type: 'SessionComplete',
            result: finalResult.status,
            steps: finalResult.steps,
            durationMs: finalResult.durationMs,
            metrics: this.timingMetrics
        });
        return finalResult;
    }
    buildResult() {
        const isSuccess = this.goalManager.isComplete();
        const durationMs = Date.now() - this.sessionStartTime;
        return {
            status: isSuccess ? 'SUCCESS' : (this.currentState === types_1.FSMState.FAILED ? 'FAILURE' : 'PARTIAL'),
            steps: this.stepCount,
            durationMs,
            completedOutcomes: this.goalManager.completedSubObjectives,
        };
    }
    async executeStep() {
        // OBSERVE
        this.transition(types_1.FSMState.OBSERVE);
        this.currentActionId = (0, uuid_1.v4)();
        const obsStart = performance.now();
        const observation = await this.perceptionEngine.observe();
        this.timingMetrics.observationMs += performance.now() - obsStart;
        this.emitEvent({ type: 'ObservationReady', observationId: (0, uuid_1.v4)(), elementCount: observation.elementInventory.length });
        const wmStart = performance.now();
        const worldState = this.worldModelBuilder.build(observation, this.goalManager.activeSubObjective.label // REFINEMENT R1
        );
        this.timingMetrics.worldModelMs += performance.now() - wmStart;
        this.emitEvent({ type: 'WorldModelBuilt', worldStateId: worldState.pageId, formCount: worldState.forms.length, fieldCount: worldState.forms.reduce((acc, f) => acc + f.fields.length, 0) });
        // Let BrowserController know about elements to map elementId to handle later
        this.browser.registerElements(observation.elementInventory);
        this.memory.stm.pushWorldState(worldState);
        // PLAN
        this.transition(types_1.FSMState.PLAN);
        const planStart = performance.now();
        const decision = await this.reasoningEngine.decide(worldState, this.memory, this.goalManager.activeSubObjective, this.goalManager.currentGoal?.label);
        this.timingMetrics.reasoningMs += performance.now() - planStart;
        this.emitEvent({ type: 'DecisionMade', ...decision, action: decision.action.name });
        if (decision.confidence < this.config.reasoning.minConfidenceThreshold) {
            this.transition(types_1.FSMState.RECOVER);
            this.emitEvent({ type: 'RecoveryAttempted', strategy: 'low_confidence_fallback', attempt: 1 });
            await this.resilienceEngine.handleInsufficient(decision);
            return;
        }
        // ACT
        this.transition(types_1.FSMState.ACT);
        const actStart = performance.now();
        const result = await this.toolRuntime.execute(decision.action, this.browser);
        this.timingMetrics.actionMs += performance.now() - actStart;
        this.emitEvent({ type: 'ActionExecuted', tool: decision.action.name, success: result.success, durationMs: result.timing.durationMs });
        // Append to memory with toolResult included
        this.memory.execution.append({ step: this.stepCount, fsmState: this.currentState, activeSubObjective: this.goalManager.activeSubObjective.label, ...decision, toolResult: result });
        if (!result.success) {
            this.transition(types_1.FSMState.RECOVER);
            this.emitEvent({ type: 'RecoveryAttempted', strategy: 'tool_error_retry', attempt: 1 });
            await this.resilienceEngine.handle(result.error);
            return;
        }
        // VALIDATE
        this.transition(types_1.FSMState.VALIDATE);
        const valStart = performance.now();
        const postObs = await this.perceptionEngine.observe();
        const postWorld = this.worldModelBuilder.build(postObs, this.goalManager.activeSubObjective.label);
        const completionStatus = this.reasoningEngine.evaluateCompletion(worldState, postWorld, this.goalManager.activeSubObjective, decision.targetSelector);
        this.timingMetrics.validationMs += performance.now() - valStart;
        if (completionStatus === 'COMPLETE') {
            const actualField = postWorld.forms.flatMap(f => f.fields).find(f => f.selector === decision.targetSelector);
            this.goalManager.markComplete({
                subObjectiveId: this.goalManager.activeSubObjective.id,
                targetSelector: decision.targetSelector || '',
                expectedValue: this.goalManager.activeSubObjective.expectedValue,
                actualValue: actualField?.currentValue || '',
                status: 'COMPLETE'
            });
            this.emitEvent({ type: 'SubObjectiveComplete', subObjective: this.goalManager.lastCompletedSubObjective });
            if (this.goalManager.isComplete()) {
                this.transition(types_1.FSMState.COMPLETE);
            }
        }
    }
}
exports.AtlasCore = AtlasCore;
