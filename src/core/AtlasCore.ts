import { FSMState, VALID_TRANSITIONS, Goal, ExecutionResult } from './types';
import { SafetyMonitor, TraceBuilder, ReplayLog } from './SafetyMonitor';
import { EventBus } from '../observability/EventBus';
import { BrowserController } from '../browser/BrowserController';
import { ATLASConfig } from '../config/ATLASConfig';
import { ToolRuntime } from '../tools/ToolRuntime';
import { PerceptionEngine } from '../perception/PerceptionEngine';
import { WorldModelBuilder } from '../worldmodel/WorldModelBuilder';
import { ShortTermMemory } from '../memory/ShortTermMemory';
import { v4 as uuid } from 'uuid';
import { WorldState } from '../worldmodel/types';
import { ToolResult } from '../tools/types';

import { GoalManager } from './GoalManager';
import { ReasoningEngine } from '../reasoning/ReasoningEngine';
import { Decision } from '../reasoning/types';
import { ResilienceEngine } from '../resilience/ResilienceEngine';
import { ExecutionReplayLog } from '../memory/ExecutionReplayLog';
import { SubObjective } from './types';

export class AtlasCore {
  private currentState: FSMState = FSMState.INIT;
  private stepCount = 0;
  private executionId = uuid();
  private currentActionId?: string;
  
  private sessionStartTime: number = Date.now();
  private timingMetrics = {
    navigationMs: 0,
    observationMs: 0,
    worldModelMs: 0,
    reasoningMs: 0,
    actionMs: 0,
    validationMs: 0,
    teardownMs: 0
  };

  constructor(
    private config: ATLASConfig,
    private eventBus: EventBus,
    private browser: BrowserController,
    private toolRuntime: ToolRuntime,
    private perceptionEngine: PerceptionEngine,
    private worldModelBuilder: WorldModelBuilder,
    private memory: { stm: ShortTermMemory, execution: ExecutionReplayLog },
    private goalManager: GoalManager,
    private reasoningEngine: ReasoningEngine,
    private resilienceEngine: ResilienceEngine,
    private safetyMonitor: SafetyMonitor,
    private traceBuilder: TraceBuilder,
    private replayLog: ReplayLog,
    private sessionId: string
  ) {}

  private emitEvent(event: any) {
    this.eventBus.emit({
      sessionId: this.sessionId,
      executionId: this.executionId,
      stepId: this.stepCount,
      actionId: this.currentActionId,
      ...event
    });
  }

  private transition(newState: FSMState) {
    const valid = VALID_TRANSITIONS[this.currentState] || [];
    if (!valid.includes(newState) && this.currentState !== FSMState.FAILED) {
      // In production, we might throw, but let's just log or force
    }
    this.currentState = newState;
  }

  private isTerminal() {
    return this.currentState === FSMState.COMPLETE || 
           this.currentState === FSMState.TEARDOWN || 
           this.currentState === FSMState.FAILED;
  }
  
  async run(goal: Goal): Promise<ExecutionResult> {
    this.safetyMonitor.start(this.config.execution); // REFINEMENT R2: independent watchdog
    this.emitEvent({ type: 'SessionStarted', goal: goal.label, timestamp: new Date().toISOString() });
    
    try {
      this.transition(FSMState.VALIDATE_GOAL);
      this.goalManager.load(goal);
      
      this.transition(FSMState.LAUNCH_BROWSER);
      const navStart = performance.now();
      await this.toolRuntime.execute({ name: 'open_browser', params: this.config.browser }, this.browser);
      
      this.transition(FSMState.NAVIGATE);
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
          this.transition(FSMState.FAILED);
          break;
        }
        
        try {
          await this.executeStep();
        } catch (stepError) {
          this.emitEvent({ type: 'FailureDetected', severity: 'RECOVERABLE', source: 'SYSTEM', code: (stepError as Error).message });
          const recovery = await this.resilienceEngine.handle({ 
            code: 'STEP_ERROR', 
            message: (stepError as Error).message, 
            severity: 'RECOVERABLE', 
            source: 'SYSTEM' 
          });
          
          if (!recovery.success) {
            throw stepError;
          }
          this.transition(FSMState.RECOVER);
        }
      }
      
    } catch (error) {
      this.emitEvent({ type: 'FailureDetected', severity: 'FATAL', source: 'SYSTEM', code: (error as Error).message });
      this.transition(FSMState.FAILED);
    } finally {
      this.safetyMonitor.stop();
      this.transition(FSMState.TEARDOWN);
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
  
  private buildResult(): ExecutionResult {
    const isSuccess = this.goalManager.isComplete();
    const durationMs = Date.now() - this.sessionStartTime;
    return {
      status: isSuccess ? 'SUCCESS' : (this.currentState === FSMState.FAILED ? 'FAILURE' : 'PARTIAL'),
      steps: this.stepCount,
      durationMs,
      completedOutcomes: this.goalManager.completedSubObjectives,
    };
  }
  
  private async executeStep(): Promise<void> {
    // OBSERVE
    this.transition(FSMState.OBSERVE);
    this.currentActionId = uuid();
    
    const obsStart = performance.now();
    const observation = await this.perceptionEngine.observe();
    this.timingMetrics.observationMs += performance.now() - obsStart;
    this.emitEvent({ type: 'ObservationReady', observationId: uuid(), elementCount: observation.elementInventory.length });
    
    const wmStart = performance.now();
    const worldState = this.worldModelBuilder.build(
      observation, 
      this.goalManager.activeSubObjective.label  // REFINEMENT R1
    );
    this.timingMetrics.worldModelMs += performance.now() - wmStart;
    this.emitEvent({ type: 'WorldModelBuilt', worldStateId: worldState.pageId, formCount: worldState.forms.length, fieldCount: worldState.forms.reduce((acc, f) => acc + f.fields.length, 0) });
    
    // Let BrowserController know about elements to map elementId to handle later
    this.browser.registerElements(observation.elementInventory);
    this.memory.stm.pushWorldState(worldState);
    
    // PLAN
    this.transition(FSMState.PLAN);
    const planStart = performance.now();
    const decision = await this.reasoningEngine.decide(
      worldState, 
      this.memory, 
      this.goalManager.activeSubObjective,
      this.goalManager.currentGoal?.label
    );
    this.timingMetrics.reasoningMs += performance.now() - planStart;
    this.emitEvent({ type: 'DecisionMade', ...decision, action: decision.action.name });
    
    if (decision.confidence < this.config.reasoning.minConfidenceThreshold) {
      this.transition(FSMState.RECOVER);
      this.emitEvent({ type: 'RecoveryAttempted', strategy: 'low_confidence_fallback', attempt: 1 });
      await this.resilienceEngine.handleInsufficient(decision);
      return;
    }
    
    // ACT
    this.transition(FSMState.ACT);
    const actStart = performance.now();
    const result = await this.toolRuntime.execute(decision.action, this.browser);
    this.timingMetrics.actionMs += performance.now() - actStart;
    this.emitEvent({ type: 'ActionExecuted', tool: decision.action.name, success: result.success, durationMs: result.timing.durationMs });
    
    // Append to memory with toolResult included
    this.memory.execution.append({ step: this.stepCount, fsmState: this.currentState, activeSubObjective: this.goalManager.activeSubObjective.label, ...decision, toolResult: result });
    
    if (!result.success) {
      this.transition(FSMState.RECOVER);
      this.emitEvent({ type: 'RecoveryAttempted', strategy: 'tool_error_retry', attempt: 1 });
      await this.resilienceEngine.handle(result.error!);
      return;
    }
    
    // VALIDATE
    this.transition(FSMState.VALIDATE);
    const valStart = performance.now();
    const postObs = await this.perceptionEngine.observe();
    const postWorld = this.worldModelBuilder.build(postObs, this.goalManager.activeSubObjective.label);
    
    const completionStatus = this.reasoningEngine.evaluateCompletion(
      worldState, postWorld, this.goalManager.activeSubObjective, decision.targetSelector
    );
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
        this.transition(FSMState.COMPLETE);
      }
    }
  }
}
