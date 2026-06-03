"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runAgent = runAgent;
const core_1 = require("./core");
const GoalManager_1 = require("./core/GoalManager");
const config_1 = require("./config");
const observability_1 = require("./observability");
const BrowserController_1 = require("./browser/BrowserController");
const tools_1 = require("./tools");
const perception_1 = require("./perception");
const WorldModelBuilder_1 = require("./worldmodel/WorldModelBuilder");
const ShortTermMemory_1 = require("./memory/ShortTermMemory");
const ExecutionReplayLog_1 = require("./memory/ExecutionReplayLog");
const ReasoningEngine_1 = require("./reasoning/ReasoningEngine");
const ElementDiscovery_1 = require("./reasoning/ElementDiscovery");
const ConfidenceScorer_1 = require("./reasoning/ConfidenceScorer");
const ResilienceEngine_1 = require("./resilience/ResilienceEngine");
async function runAgent(goal, customSessionId, headless = true, verbose = false) {
    const config = config_1.ATLASConfigLoader.load();
    config.browser.headless = headless;
    const sessionId = customSessionId || 'atlas_sess_demo_' + Date.now();
    const eventBus = new observability_1.EventBus(config.events.asyncDispatch);
    new observability_1.StructuredLogger(eventBus, config.logging);
    const metrics = new observability_1.MetricsRegistry(eventBus);
    const browser = new BrowserController_1.BrowserController();
    const toolRuntime = new tools_1.ToolRuntime();
    toolRuntime.register(new tools_1.SendKeysTool());
    toolRuntime.register(new tools_1.OpenBrowserTool());
    toolRuntime.register(new tools_1.NavigateTool());
    toolRuntime.register(new tools_1.ClickOnScreenTool());
    toolRuntime.register(new tools_1.ScrollTool());
    toolRuntime.register(new tools_1.DoubleClickTool());
    toolRuntime.register(new tools_1.TakeScreenshotTool());
    toolRuntime.register(new tools_1.SelectOptionTool());
    const perceptionEngine = new perception_1.PerceptionEngine(browser, config);
    const worldModelBuilder = new WorldModelBuilder_1.WorldModelBuilder();
    const memory = {
        stm: new ShortTermMemory_1.ShortTermMemory(config),
        execution: new ExecutionReplayLog_1.ExecutionReplayLog(sessionId)
    };
    const goalManager = new GoalManager_1.GoalManager();
    const confidenceScorer = new ConfidenceScorer_1.ConfidenceScorer();
    const elementDiscovery = new ElementDiscovery_1.ElementDiscovery(eventBus, config, confidenceScorer);
    const reasoningEngine = new ReasoningEngine_1.ReasoningEngine(elementDiscovery);
    const resilienceEngine = new ResilienceEngine_1.ResilienceEngine();
    const traceBuilder = new observability_1.ExecutionTraceBuilder(sessionId, goal.label, memory.execution);
    const safetyMonitor = new core_1.SafetyMonitor(eventBus, traceBuilder, memory.execution, browser);
    const atlas = new core_1.AtlasCore(config, eventBus, browser, toolRuntime, perceptionEngine, worldModelBuilder, memory, goalManager, reasoningEngine, resilienceEngine, safetyMonitor, traceBuilder, memory.execution, sessionId);
    const result = await atlas.run(goal);
    const finalMetrics = metrics.generateReport();
    console.log('\n' + traceBuilder.generateReport(result, finalMetrics, verbose));
    return {
        result,
        metrics: finalMetrics
    };
}
