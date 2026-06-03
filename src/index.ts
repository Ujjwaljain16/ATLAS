import { AtlasCore, SafetyMonitor } from './core';
import { GoalManager } from './core/GoalManager';
import { ATLASConfigLoader } from './config';
import { EventBus, StructuredLogger, ExecutionTraceBuilder, MetricsRegistry } from './observability';
import { BrowserController } from './browser/BrowserController';
import { ToolRuntime, SendKeysTool, NavigateTool, OpenBrowserTool, ClickOnScreenTool, ScrollTool, DoubleClickTool, TakeScreenshotTool, SelectOptionTool } from './tools';
import { PerceptionEngine, DOMObserver, A11yObserver, ObservationAssembler } from './perception';
import { WorldModelBuilder } from './worldmodel/WorldModelBuilder';
import { ShortTermMemory } from './memory/ShortTermMemory';
import { ExecutionReplayLog } from './memory/ExecutionReplayLog';
import { ReasoningEngine } from './reasoning/ReasoningEngine';
import { ElementDiscovery } from './reasoning/ElementDiscovery';
import { ConfidenceScorer } from './reasoning/ConfidenceScorer';
import { ResilienceEngine } from './resilience/ResilienceEngine';

import { Goal } from './core/types';

export async function runAgent(goal: Goal, customSessionId?: string, headless = true) {
  const config = ATLASConfigLoader.load();
  config.browser.headless = headless;
  
  const sessionId = customSessionId || 'atlas_sess_demo_' + Date.now();
  
  const eventBus = new EventBus(config.events.asyncDispatch);
  new StructuredLogger(eventBus, config.logging);
  const metrics = new MetricsRegistry(eventBus);
  
  const browser = new BrowserController();
  const toolRuntime = new ToolRuntime();
  toolRuntime.register(new SendKeysTool());
  toolRuntime.register(new OpenBrowserTool());
  toolRuntime.register(new NavigateTool());
  toolRuntime.register(new ClickOnScreenTool());
  toolRuntime.register(new ScrollTool());
  toolRuntime.register(new DoubleClickTool());
  toolRuntime.register(new TakeScreenshotTool());
  toolRuntime.register(new SelectOptionTool());

  const perceptionEngine = new PerceptionEngine(
    browser,
    config
  );
  
  const worldModelBuilder = new WorldModelBuilder();
  const memory = {
    stm: new ShortTermMemory(config),
    execution: new ExecutionReplayLog(sessionId)
  };
  
  const goalManager = new GoalManager();
  
  const confidenceScorer = new ConfidenceScorer();
  const elementDiscovery = new ElementDiscovery(eventBus, config, confidenceScorer);
  const reasoningEngine = new ReasoningEngine(elementDiscovery);
  
  const resilienceEngine = new ResilienceEngine();
  
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
    sessionId
  );
  
  const result = await atlas.run(goal);
  
  console.log('\n' + traceBuilder.generateReport(result as any));
  
  return {
    result,
    metrics: metrics.generateReport()
  };
}


