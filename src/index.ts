import { AtlasCore, SafetyMonitor } from './core';
import { GoalManager } from './core/GoalManager';
import { ATLASConfigLoader } from './config';
import { EventBus, StructuredLogger, ExecutionTraceBuilder, MetricsRegistry } from './observability';
import { BrowserController } from './browser/BrowserController';
import { ToolRuntime, SendKeysTool, NavigateTool, OpenBrowserTool, ClickOnScreenTool, ScrollTool, DoubleClickTool, TakeScreenshotTool, SelectOptionTool, WaitTool, HoverTool, PressKeyTool, GoBackTool, GoForwardTool, DragTool, KeyChordTool, CopyTool, PasteTool, SetSliderValueTool } from './tools';
import * as path from 'path';
import { PerceptionEngine, DOMObserver, A11yObserver, ObservationAssembler } from './perception';
import { WorldModelBuilder } from './worldmodel/WorldModelBuilder';
import { ShortTermMemory } from './memory/ShortTermMemory';
import { ExecutionReplayLog } from './memory/ExecutionReplayLog';
import { PageContextAnalyzer } from './perception/PageContextAnalyzer';
import { GoalSatisfactionEngine } from './reasoning/GoalSatisfactionEngine';
import { ReasoningEngine } from './reasoning/ReasoningEngine';
import { ElementDiscovery } from './reasoning/ElementDiscovery';
import { ConfidenceScorer } from './reasoning/ConfidenceScorer';
import { ResilienceEngine } from './resilience/ResilienceEngine';
import { GeminiPlanner } from './reasoning/GeminiPlanner';
import { SelfReflectionEngine } from './reasoning/SelfReflectionEngine';
import { SkillRegistry } from './skills/SkillRegistry';
import { SearchSkill } from './skills/SearchSkill';
import { FillFormSkill } from './skills/FillFormSkill';
import { ScrollAndFindSkill } from './skills/ScrollAndFindSkill';
import { ContinuousScrollSkill } from './skills/ContinuousScrollSkill';
import { TaskAnalyzer } from './reasoning/TaskAnalyzer';
import * as fs from 'fs';
import { ActionVerificationEngine } from './verification/ActionVerificationEngine';

import { Goal } from './core/types';

export async function runAgent(goal: Goal, customSessionId?: string, headless = true, verbose = false) {
  const config = ATLASConfigLoader.load();
  config.browser.headless = headless;
  
  const sessionId = customSessionId || 'atlas_sess_demo_' + Date.now();
  
  const eventBus = new EventBus(config.events.asyncDispatch);
  new StructuredLogger(eventBus, config.logging);
  const metrics = new MetricsRegistry(eventBus);

  if (verbose) {
    eventBus.on('ActionExecuted', (evt: any) => {
      console.log(`\x1b[36m[ACTION]\x1b[0m ${evt.tool} -> Success: ${evt.success} (${evt.durationMs}ms)`);
    });
    eventBus.on('RecoveryAttempted', (evt: any) => {
      console.log(`\x1b[33m[RECOVERY]\x1b[0m Strategy: ${evt.strategy} (Attempt ${evt.attempt})`);
    });
    eventBus.on('ValidationCompleted', (evt: any) => {
      console.log(`\x1b[32m[VALIDATE]\x1b[0m Goal Status: ${evt.completionStatus}`);
    });
    eventBus.on('SelfReflection', (evt: any) => {
      console.log(`\x1b[35m[REFLECT]\x1b[0m ${evt.outcomeMatch} | ${evt.verdict} | "${evt.learning}"`);
    });
    eventBus.on('TaskPlanReady', (evt: any) => {
      console.log(`\n\x1b[34m[TASK PLAN]\x1b[0m Intent: \x1b[1m${evt.intent}\x1b[0m | Target: ${evt.navigationTarget || 'Unknown'}`);
      console.log(`\x1b[90mSummary: ${evt.summary}\x1b[0m\n`);
    });
    eventBus.on('DecisionMade', (evt: any) => {
      console.log(`\n\x1b[33m[DECISION TRACE]\x1b[0m`);
      if (evt.candidateList && evt.candidateList.length > 0) {
        console.log(`\x1b[90mCandidates:\x1b[0m`);
        evt.candidateList.forEach((c: any, idx: number) => {
          const isSelected = evt.action.includes(c.id);
          const prefix = isSelected ? '\x1b[32m✓\x1b[0m' : ' ';
          console.log(`  ${prefix} #${idx + 1}  ${c.label.slice(0, 30).padEnd(30)} (${c.type.padEnd(8)})  score: ${c.score}`);
        });
      }
      console.log(`\x1b[90mReasoning:\x1b[0m  ${evt.thought}`);
      console.log(`\x1b[90mExpected:\x1b[0m   ${evt.expectedOutcome || 'N/A'}`);
      console.log(`\x1b[90mConfidence:\x1b[0m ${evt.confidence}`);
    });
  }
  
  const browser = new BrowserController();
  const toolRuntime = new ToolRuntime();
  // Load core built-in tools dynamically from the tools directory
  await toolRuntime.loadPlugins(path.join(__dirname, 'tools', 'tools'));

  // Register skill system
  const skillRegistry = new SkillRegistry();
  skillRegistry.register(new SearchSkill());
  skillRegistry.register(new FillFormSkill());
  skillRegistry.register(new ScrollAndFindSkill());
  skillRegistry.register(new ContinuousScrollSkill());
  toolRuntime.setSkillRegistry(skillRegistry);
  // Wire observe function into toolRuntime (set after perceptionEngine is created below)

  const perceptionEngine = new PerceptionEngine(
    browser,
    config
  );
  // Hook observe function into toolRuntime so skills can re-observe
  toolRuntime.setObserveFn(async () => {
    const obs = await perceptionEngine.observe();
    return obs.elementInventory;
  });
  
  const worldModelBuilder = new WorldModelBuilder();
  const memory = {
    stm: new ShortTermMemory(config),
    execution: new ExecutionReplayLog(sessionId)
  };
  
  const goalManager = new GoalManager();
  
  const confidenceScorer = new ConfidenceScorer();
  const elementDiscovery = new ElementDiscovery(eventBus, config, confidenceScorer);
  const apiKey = process.env.GEMINI_API_KEY || '';
  if (!apiKey) {
    console.warn("WARNING: GEMINI_API_KEY is not set. The GeminiPlanner will fail.");
  }
  const reasoningEngine = new ReasoningEngine(
    new ElementDiscovery(eventBus, config, new ConfidenceScorer()),
    new GeminiPlanner(apiKey, config.reasoning.modelName),
    apiKey,
    config.reasoning.modelName
  );
  
  const resilienceEngine = new ResilienceEngine();
  const selfReflectionEngine = new SelfReflectionEngine(apiKey, config.reasoning.modelName);
  
  const actionVerificationEngine = new ActionVerificationEngine(apiKey, config.reasoning.modelName);
  const pageContextAnalyzer = new PageContextAnalyzer();
  const goalSatisfactionEngine = new GoalSatisfactionEngine(apiKey, config.reasoning.modelName);

  const traceBuilder = new ExecutionTraceBuilder(sessionId, goal.label, memory.execution);
  
  const safetyMonitor = new SafetyMonitor(
    eventBus,
    traceBuilder,
    memory.execution,
    browser
  );

  const atlas = new AtlasCore(
    config,
    eventBus,
    browser,
    toolRuntime,
    perceptionEngine,
    worldModelBuilder,
    memory,
    goalManager,
    reasoningEngine,
    resilienceEngine,
    safetyMonitor,
    traceBuilder,
    memory.execution,
    sessionId,
    selfReflectionEngine,
    new TaskAnalyzer(apiKey, config.reasoning.modelName),
    actionVerificationEngine,
    goalSatisfactionEngine,
    pageContextAnalyzer
  );
  
  const result = await atlas.run(goal);

  // Serialize Execution Graph
  const graph = atlas.getExecutionGraph();
  const outputDir = path.join(process.cwd(), 'output');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
  const graphPath = path.join(outputDir, `execution_graph_${sessionId}.json`);
  fs.writeFileSync(graphPath, JSON.stringify(graph.serialize(), null, 2), 'utf8');

  if (verbose) {
    console.log('\n\x1b[35m══════════════════════ EXECUTION GRAPH (Mermaid) ══════════════════════\x1b[0m');
    console.log(graph.toMermaid());
    console.log(`\n\x1b[90mGraph saved to: ${graphPath}\x1b[0m`);
    
    console.log('\n\x1b[35m══════════════════════ CONFIDENCE REPORT ══════════════════════\x1b[0m');
    console.log(atlas.confidenceTracker.formatReport());
  }

  const finalMetrics: any = metrics.generateReport();
  // Merge completion evidence from atlas session into metrics for trace display
  const completionEvidence = (result as any).satisfactionResult;
  if (completionEvidence) finalMetrics.satisfactionResult = completionEvidence;
  // Merge compression stats
  const compressionStats = (atlas as any).getCompressionStats?.();
  if (compressionStats) {
    finalMetrics.compressionBefore = compressionStats.before;
    finalMetrics.compressionAfter = compressionStats.after;
  }
  console.log('\n' + traceBuilder.generateReport(result as any, finalMetrics, verbose));
  
  return {
    result,
    metrics: finalMetrics
  };
}


