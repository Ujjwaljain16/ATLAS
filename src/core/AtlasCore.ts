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
import { PageState } from '../worldmodel/types';
import { ToolResult } from '../tools/types';

import { GoalManager } from './GoalManager';
import { ReasoningEngine } from '../reasoning/ReasoningEngine';
import { Decision } from '../reasoning/types';
import { GoalSatisfactionEngine, SatisfactionResult } from '../reasoning/GoalSatisfactionEngine';
import { DeltaAnalyzer } from '../reasoning/DeltaAnalyzer';
import { ResilienceEngine } from '../resilience/ResilienceEngine';
import { ExecutionReplayLog } from '../memory/ExecutionReplayLog';
import { SubObjective } from './types';
import { SelfReflectionEngine } from '../reasoning/SelfReflectionEngine';
import { ExecutionGraph, WorldStateSummary } from '../memory/ExecutionGraph';
import { TaskAnalyzer } from '../reasoning/TaskAnalyzer';
import { ConfidenceTracker } from '../observability/ConfidenceTracker';
import { ActionVerificationEngine } from '../verification/ActionVerificationEngine';
import { PageContextAnalyzer } from '../perception/PageContextAnalyzer';
import { ExecutionContext } from './ExecutionContext';
import { LeaseState } from './ExecutionLease';
import { FailureClassifier } from '../resilience/FailureClassifier';
import { RecoveryPolicy } from '../resilience/RecoveryPolicy';

export class AtlasCore {
  private currentState: FSMState = FSMState.INIT;
  private stepCount = 0;
  private executionId = uuid();
  private currentActionId?: string;
  private executionGraph: ExecutionGraph = new ExecutionGraph();
  private currentGraphNodeId?: string;
  readonly confidenceTracker: ConfidenceTracker = new ConfidenceTracker();
  
  private executionContext: ExecutionContext = new ExecutionContext('');
  private failureClassifier: FailureClassifier = new FailureClassifier();
  private recoveryPolicy: RecoveryPolicy = new RecoveryPolicy();
  
  private sessionStartTime: number = Date.now();
  private lastSatisfactionResult?: SatisfactionResult;
  private compressionStats: { before: number; after: number } = { before: 0, after: 0 };
  private deltaAnalyzer = new DeltaAnalyzer();
  private newKnowledgeAcquiredInStep = false;
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
    private sessionId: string,
    private selfReflectionEngine?: SelfReflectionEngine,
    private taskAnalyzer?: TaskAnalyzer,
    private actionVerificationEngine?: ActionVerificationEngine,
    private goalSatisfactionEngine?: GoalSatisfactionEngine,
    private pageContextAnalyzer?: PageContextAnalyzer
  ) {}

  /** Expose the execution graph for serialization after run() completes. */
  getExecutionGraph(): ExecutionGraph { return this.executionGraph; }

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
      this.executionContext.goal = goal.label;
      
      this.transition(FSMState.LAUNCH_BROWSER);
      const navStart = performance.now();
      await this.toolRuntime.execute({ name: 'open_browser', params: this.config.browser }, this.browser);
      
      this.transition(FSMState.NAVIGATE);
      const navResult = await this.toolRuntime.execute({ 
        name: 'navigate', 
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

      if (this.config.screenshots.enabled && this.config.screenshots.mode === 'first_and_last') {
        await this.browser.screenshot('first_step', this.config.screenshots.fullPage);
      }

      // TASK ANALYSIS — decompose goal into structured plan before the loop
      if (this.taskAnalyzer) {
        const plan = await this.taskAnalyzer.analyze(goal.label);
        this.goalManager.loadTaskPlan(plan);
        this.emitEvent({
          type: 'TaskPlanReady',
          intent: plan.intent,
          steps: plan.steps.length,
          summary: plan.summary,
          navigationTarget: plan.navigationTarget
        });
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
        } catch (stepError: any) {
          if (this.config.screenshots.enabled && (this.config.screenshots.mode === 'failures_only' || this.config.screenshots.mode === 'all_steps')) {
            await this.browser.screenshot('step_error', this.config.screenshots.fullPage);
          }
          this.emitEvent({ type: 'FailureDetected', severity: 'RECOVERABLE', source: 'SYSTEM', code: stepError.message });
          
          // Execute recovery strategy
          const recovery = await this.resilienceEngine.handle({ 
            code: stepError.name === 'VerificationError' ? 'VERIFICATION_FAILED' : 'STEP_ERROR', 
            message: stepError.message, 
            severity: 'RECOVERABLE', 
            source: 'SYSTEM' 
          });
          
          if (!recovery.success) {
            // Escalation exhausted, throw to fatal handler
            throw stepError;
          }
          
          // Recovery successful, transition appropriately
          this.transition(FSMState.PLAN); // Cycles back to planner for alternative
        }
      }
      
    } catch (error) {
      this.emitEvent({ type: 'FailureDetected', severity: 'FATAL', source: 'SYSTEM', code: (error as Error).message });
      if (this.config.screenshots.enabled && (this.config.screenshots.mode === 'failures_only' || this.config.screenshots.mode === 'first_and_last')) {
        await this.browser.screenshot('fatal_error', this.config.screenshots.fullPage);
      }
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
    const res: ExecutionResult & { satisfactionResult?: any } = {
      status: isSuccess ? 'SUCCESS' : (this.currentState === FSMState.FAILED ? 'FAILURE' : 'PARTIAL'),
      steps: this.stepCount,
      durationMs,
      completedOutcomes: this.goalManager.completedSubObjectives,
    };
    if (this.lastSatisfactionResult) res.satisfactionResult = this.lastSatisfactionResult;
    return res;
  }

  getCompressionStats(): { before: number; after: number } {
    return this.compressionStats;
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
    const pageState = this.worldModelBuilder.build(
      observation, 
      [] // Navigation history placeholder
    );
    this.timingMetrics.worldModelMs += performance.now() - wmStart;
    this.emitEvent({ type: 'WorldModelBuilt', worldStateId: pageState.pageId, elementCount: pageState.elements.length });
    
    // Let BrowserController know about elements to map elementId to handle later
    this.browser.registerElements(observation.elementInventory);
    this.memory.stm.pushWorldState(pageState);

    // EXECUTION GRAPH: Add a state node for this observation
    const graphSummary: WorldStateSummary = {
      url: pageState.url,
      title: pageState.title,
      classification: pageState.classification,
      goalProgress: `Step ${this.stepCount}`,
      errorSignals: pageState.errorSignals
    };
    const prevGraphNodeId = this.currentGraphNodeId;
    this.currentGraphNodeId = this.executionGraph.addNode(this.stepCount, graphSummary);
    
    const pageContext = this.pageContextAnalyzer ? this.pageContextAnalyzer.analyze(pageState) : { pageType: 'Unknown', confidence: 0 };
    
    // Evaluate Completion Preemptively
    if (this.goalSatisfactionEngine) {
      const satisfactionResult = await this.goalSatisfactionEngine.evaluate({
        goal: this.goalManager.currentGoal?.label || '',
        worldState: pageState,
        knowledgeSummary: this.memory.stm.knowledge.getSummary(),
        history: this.memory.execution.getEntries(),
        metrics: this.timingMetrics
      });
      
      if (satisfactionResult.status === 'COMPLETE') {
        this.lastSatisfactionResult = satisfactionResult;
        this.emitEvent({ type: 'ValidationCompleted', completionStatus: 'COMPLETE', evidence: satisfactionResult });
        this.goalManager.markComplete({ subObjectiveId: 'global', targetSelector: 'GoalSatisfactionEngine', status: 'COMPLETE' });
        if (this.goalManager.isComplete()) {
          this.transition(FSMState.COMPLETE);
          return;
        }
      }
    }

    // PLAN
    this.transition(FSMState.PLAN);
    const planStart = performance.now();
    
    // Delta Planning Check
    const prevHistory = this.memory.execution.getEntries();
    const lastExecution = prevHistory.length > 0 ? prevHistory[prevHistory.length - 1] : null;
    const hasMeaningfulChange = this.deltaAnalyzer.hasMeaningfulChange({
      previousState: this.memory.stm.getPreviousWorldState(),
      currentState: pageState,
      lastAction: lastExecution?.action || null,
      lastToolResult: lastExecution?.toolResult || null,
      newKnowledgeAcquired: this.newKnowledgeAcquiredInStep
    });

    if (!hasMeaningfulChange) {
      this.emitEvent({ type: 'RecoveryAttempted', strategy: 'loop_detection_fallback', attempt: 1 });
      throw new Error("Loop detected: No meaningful change in WorldState or Knowledge since last step.");
    }
    this.newKnowledgeAcquiredInStep = false;

    const goalText = this.goalManager.activeStepLabel; // Use specific step if available
    
    const availableCapabilities = [
      ...this.toolRuntime.getDescriptions().map(t => ({ type: 'tool', ...t })),
      ...this.toolRuntime.getSkillDescriptions().map(s => ({ type: 'skill', ...s }))
    ];

    let decision: Decision;
    const lease = this.executionContext.executionLease;
    
    if (lease && (lease.state === LeaseState.LOCKED || lease.state === LeaseState.RECOVERING)) {
      console.log(`[ExecutionLease] Executing active lease for ${lease.target.label} (${lease.state})`);
      decision = {
        thought: `Executing active lease for ${lease.target.label}`,
        action: lease.intendedAction,
        expectedOutcome: `Lease execution for ${lease.target.label}`,
        goalStatusGuess: 'IN_PROGRESS',
        confidence: 1.0,
        discoveryTier: 0,
        matchedSignal: 'execution-lease',
        targetSelector: lease.target.selector
      };
    } else {
      decision = await this.reasoningEngine.decide(
        pageState, 
        this.memory, 
        goalText,
        pageContext,
        this.goalManager.completedSubObjectives.map(o => o.subObjectiveId),
        {}, // State Delta not yet fully implemented
        availableCapabilities
      );

      // Extract Objective and Grant Lease if applicable
      if (decision.targetSelector) {
        const targetElement = pageState.elements.find(e => e.selector === decision.targetSelector || e.id === decision.targetSelector);
        if (targetElement) {
          this.executionContext.setObjective(`Execute ${decision.action.name} on ${decision.targetSelector}`);
          this.executionContext.grantLease({
            elementId: targetElement.id,
            selector: targetElement.selector,
            label: targetElement.label || targetElement.text || 'Unknown'
          }, decision.action);
        }
      }
    }
    this.confidenceTracker.record('PLANNING', decision.confidence, this.stepCount);
    
    this.timingMetrics.reasoningMs += performance.now() - planStart;
    this.emitEvent({ 
      type: 'DecisionMade', 
      ...decision, 
      action: decision.action.name,
      expectedOutcome: decision.expectedOutcome,
      goalStatusGuess: decision.goalStatusGuess
    });
    if (decision.confidence < this.config.reasoning.minConfidenceThreshold) {
      this.transition(FSMState.RECOVER);
      this.emitEvent({ type: 'RecoveryAttempted', strategy: 'low_confidence_fallback', attempt: 1 });
      await this.resilienceEngine.handleInsufficient(decision);
      return;
    }
    
    // ACT
    this.transition(FSMState.ACT);
    const actStart = performance.now();
    let result = await this.toolRuntime.execute(decision.action, this.browser);
    this.timingMetrics.actionMs += performance.now() - actStart;
    
    this.confidenceTracker.record('ACTION', result.success ? 1.0 : 0.0, this.stepCount);
    
    this.emitEvent({ type: 'ActionExecuted', tool: decision.action.name, success: result.success, durationMs: result.timing?.durationMs || 0 });
    
    // Process Knowledge Artifacts
    if (result.artifacts && result.artifacts.length > 0) {
      for (const artifact of result.artifacts) {
        const item = this.memory.stm.knowledge.add(artifact);
        this.newKnowledgeAcquiredInStep = true;
        this.emitEvent({ type: 'KnowledgeAcquired', id: item.id, itemType: item.type, summary: item.summary });
      }
    }
    // Append to STAM
    this.memory.stm.recordAction({
      action_type: decision.action.name,
      target_desc: decision.targetSelector || 'unknown target',
      result: result.success ? 'SUCCESS' : 'FAILURE',
      change_summary: result.success ? 'Action executed' : 'Action failed'
    });

    // Append to memory with toolResult included
    this.memory.execution.append({ step: this.stepCount, fsmState: this.currentState, activeGoal: goalText, ...decision, toolResult: result });

    // EXECUTION GRAPH: Add an edge from previous node to current node
    if (prevGraphNodeId && this.currentGraphNodeId) {
      this.executionGraph.addEdge(
        prevGraphNodeId,
        this.currentGraphNodeId,
        decision.action,
        result,
        decision.thought || '',
        decision.confidence,
        result.success ? 'PLANNED' : 'RECOVERY'
      );
    }
    
    if (!result.success) {
      if (this.config.screenshots.enabled && (this.config.screenshots.mode === 'failures_only' || this.config.screenshots.mode === 'all_steps')) {
        await this.browser.screenshot('action_failure', this.config.screenshots.fullPage);
      }
      this.transition(FSMState.RECOVER);
      
      const targetSelector = decision.targetSelector || '';
      
      // Post-action observation for environment diffing
      const postObsFail = await this.perceptionEngine.observe();
      const postStateFail = this.worldModelBuilder.build(postObsFail, []);
      
      const classification = this.failureClassifier.classifyEnvDiff(
        pageState, postStateFail, targetSelector, result.error || undefined
      );

      const recoveryAction = this.recoveryPolicy.determineRecovery(
        classification, this.executionContext, targetSelector
      );

      if (recoveryAction) {
        this.emitEvent({ type: 'RecoveryActionExecuted', strategy: recoveryAction.strategyName });
        this.executionContext.addRecoveryEvent({
          target: targetSelector,
          classification: classification.classification,
          strategyUsed: recoveryAction.strategyName,
          success: true, // Optimistic, we will evaluate next loop
          timestamp: Date.now()
        });
        
        const recoveryResult = await this.toolRuntime.execute(recoveryAction.action, this.browser);
        if (!recoveryResult.success) {
           this.executionContext.updateLeaseState(LeaseState.UNREACHABLE);
           this.emitEvent({ type: 'FailureDetected', severity: 'RECOVERABLE', source: 'SYSTEM', code: `Recovery failed: ${recoveryResult.error?.message}` });
           return;
        }
        this.executionContext.updateLeaseState(LeaseState.RECOVERING);
        // Return to let the next loop run and re-evaluate the target
        return;
      } else {
        this.executionContext.updateLeaseState(LeaseState.UNREACHABLE);
        this.emitEvent({ type: 'FailureDetected', severity: 'RECOVERABLE', source: 'SYSTEM', code: `Unrecoverable error (Classified: ${classification.classification}): ${result.error?.message}` });
        return;
      }
    } else {
      if (this.executionContext.executionLease) {
        this.executionContext.updateLeaseState(LeaseState.COMPLETED);
      }
    }
    
    // VALIDATE
    this.transition(FSMState.VALIDATE);
    const valStart = performance.now();
    const postObs = await this.perceptionEngine.observe();
    const postWorld = this.worldModelBuilder.build(postObs, []);

    // --- ACTION VERIFICATION ---
    if (this.actionVerificationEngine) {
      const actionVerification = await this.actionVerificationEngine.verify({
        beforeState: pageState,
        afterState: postWorld,
        action: decision.action,
        expectedOutcome: decision.expectedOutcome
      });
      
      const entries = this.memory.execution.getEntries();
      if (entries.length > 0) entries[entries.length - 1].actionVerification = actionVerification;
      
      this.executionGraph.updateLastEdgeVerification(actionVerification);

      if (!actionVerification.success) {
         this.emitEvent({ type: 'ActionFailedVerification', reason: actionVerification.reason });
         const error = new Error(`Action Verification Failed: ${actionVerification.reason}`);
         error.name = 'VerificationError';
         throw error;
      }
    }


    // --- SELF-REFLECTION (Capability 19) ---
    if (this.selfReflectionEngine) {
      try {
        const reflection = await this.selfReflectionEngine.reflect({
          planned_action: decision.action,
          expected_outcome: decision.expectedOutcome || '',
          actual_tool_result: { success: result.success, error: result.error },
          pre_action_world: { url: pageState.url, title: pageState.title, classification: pageState.classification },
          post_action_world: { url: postWorld.url, title: postWorld.title, classification: postWorld.classification }
        });

        if (reflection.learning) {
          // Store learning in STAM for retrieval on next planning cycle
          this.memory.stm.recordAction({
            action_type: '__reflection__',
            target_desc: decision.action.name,
            result: 'SUCCESS',
            change_summary: reflection.explanation,
            learning: reflection.learning
          });
          this.emitEvent({ type: 'SelfReflection', outcomeMatch: reflection.outcome_match, verdict: reflection.strategy_verdict, learning: reflection.learning });
        }
      } catch (err: any) {
        console.warn('[ATLAS] SelfReflection failed:', err.message);
      }
    }
    // --- END SELF-REFLECTION ---

    const completionStatus = await this.reasoningEngine.evaluateCompletion(
      pageState, postWorld, goalText, decision.action
    );
    this.timingMetrics.validationMs += performance.now() - valStart;

    // Record verification confidence
    this.confidenceTracker.record('VERIFICATION', completionStatus === 'COMPLETE' ? 1.0 : completionStatus === 'PENDING' ? 0.5 : 0.0, this.stepCount);
    
    if (completionStatus === 'COMPLETE') {
      if (this.config.screenshots.enabled && this.config.screenshots.mode === 'first_and_last') {
        await this.browser.screenshot('last_step', this.config.screenshots.fullPage);
      }
      this.goalManager.markComplete({
        subObjectiveId: 'global',
        targetSelector: decision.targetSelector || '',
        status: 'COMPLETE'
      });
      
      const hasMoreSteps = this.goalManager.advanceStep();
      
      if (!hasMoreSteps) {
        this.emitEvent({ type: 'GoalComplete', goal: goalText });
        this.emitEvent({ type: 'ValidationCompleted', completionStatus });
        this.transition(FSMState.COMPLETE);
        return;
      } else {
        this.emitEvent({ type: 'ValidationCompleted', completionStatus: 'PENDING' });
      }
    } else {
      this.emitEvent({ type: 'ValidationCompleted', completionStatus });
    }
  }
}
