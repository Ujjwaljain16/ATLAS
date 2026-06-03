"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const yaml = __importStar(require("yaml"));
const types_1 = require("./types");
const IntentPlanner_1 = require("./IntentPlanner");
const index_1 = require("../index");
const zod_1 = require("zod");
const program = new commander_1.Command();
program.name('atlas').description('ATLAS Browser Agent CLI');
function parseTaskFile(filePath) {
    const fullPath = path.resolve(process.cwd(), filePath);
    if (!fs.existsSync(fullPath)) {
        console.error(`Error: File not found at ${fullPath}`);
        process.exit(1);
    }
    const content = fs.readFileSync(fullPath, 'utf8');
    let parsed;
    try {
        if (fullPath.endsWith('.yaml') || fullPath.endsWith('.yml')) {
            parsed = yaml.parse(content);
        }
        else {
            parsed = JSON.parse(content);
        }
    }
    catch (err) {
        console.error(`Error parsing file: ${err.message}`);
        process.exit(1);
    }
    try {
        return types_1.TaskInputSchema.parse(parsed);
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError) {
            console.error('Validation Error: Task definition does not match schema:');
            console.error(JSON.stringify(err.errors, null, 2));
        }
        else {
            console.error('Validation Error:', err);
        }
        process.exit(1);
    }
}
program
    .command('validate <file>')
    .description('Validate a YAML/JSON task definition against the schema')
    .action((file) => {
    parseTaskFile(file);
    console.log('✓ Validation successful. Task definition is structurally sound.');
    process.exit(0);
});
program
    .command('inspect <file>')
    .description('Inspect the generated Goal tree for a task definition without executing it')
    .action((file) => {
    const input = parseTaskFile(file);
    const planner = new IntentPlanner_1.IntentPlanner();
    const goal = planner.plan(input);
    console.log(JSON.stringify(goal, null, 2));
    process.exit(0);
});
program
    .command('run <file>')
    .description('Run the ATLAS agent against a task definition')
    .option('--headless <boolean>', 'Run browser in headless mode', 'true')
    .option('--verbose', 'Enable verbose execution tracing', false)
    .action(async (file, options) => {
    const input = parseTaskFile(file);
    const planner = new IntentPlanner_1.IntentPlanner();
    const goal = planner.plan(input);
    console.log(`Executing Goal: ${goal.label}`);
    const headless = options.headless === 'true' || options.headless === true;
    const verbose = options.verbose === true || options.verbose === 'true';
    console.log(`[DEBUG] headless parsed as: ${headless} (from options.headless: ${options.headless})`);
    const { result, metrics } = await (0, index_1.runAgent)(goal, undefined, headless, verbose);
    if (verbose) {
        console.log('\n════════════════════════════════════════════════════════════════');
        console.log(' ATLAS Run Summary (JSON)');
        console.log('════════════════════════════════════════════════════════════════');
        console.log(JSON.stringify(metrics, null, 2));
    }
    process.exit(result.status === 'SUCCESS' ? 0 : 1);
});
// Expose parseTaskFile and run benchmark logic via export or separate command
// For benchmark, since the logic is complex, we can put it here or require scripts/benchmark.ts
program
    .command('benchmark <file>')
    .description('Run a reliability benchmark against a task definition')
    .option('-n, --runs <number>', 'Number of runs', '10')
    .option('--headless <boolean>', 'Run headless', 'true')
    .action(async (file, options) => {
    const input = parseTaskFile(file);
    const planner = new IntentPlanner_1.IntentPlanner();
    const goal = planner.plan(input);
    const runs = parseInt(options.runs, 10);
    const headless = options.headless === 'true';
    // Inline simplified benchmark executor
    const results = [];
    let successCount = 0;
    let totalRuntimeMs = 0;
    const historyDir = path.join(process.cwd(), 'benchmark-history');
    if (!fs.existsSync(historyDir))
        fs.mkdirSync(historyDir, { recursive: true });
    console.log(`Starting ATLAS Reliability Benchmark (${runs} runs) for goal: ${goal.label}`);
    for (let i = 1; i <= runs; i++) {
        const sessionId = `benchmark_run_${i}_${Date.now()}`;
        console.log(`\n--- RUN ${i}/${runs} [${sessionId}] ---`);
        const start = Date.now();
        try {
            const { result, metrics } = await (0, index_1.runAgent)(goal, sessionId, headless);
            const runtime = Date.now() - start;
            console.log(`Run ${i} finished with status: ${result.status} in ${runtime}ms`);
            if (result.status === 'SUCCESS')
                successCount++;
            totalRuntimeMs += runtime;
            results.push({ run: i, sessionId, status: result.status, runtimeMs: runtime, metrics });
        }
        catch (err) {
            console.error(`Run ${i} failed:`, err);
            results.push({ run: i, status: 'UNCAUGHT_ERROR', error: err.message });
        }
    }
    const report = {
        date: new Date().toISOString(),
        runs,
        successRate: (successCount / runs) * 100,
        avgRuntimeMs: totalRuntimeMs / runs,
        detailedResults: results
    };
    const today = new Date().toISOString().split('T')[0];
    const reportPath = path.join(historyDir, `${today}_${path.basename(file)}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log('\n=========================================');
    console.log(' ATLAS Reliability Report');
    console.log('=========================================');
    console.log(JSON.stringify({ runs, successRate: report.successRate + '%', avgRuntimeMs: report.avgRuntimeMs }, null, 2));
    process.exit(successCount === runs ? 0 : 1);
});
program
    .command('replay <session.json>')
    .description('Replay a previously executed session from the replay log (Coming soon)')
    .action((sessionFile) => {
    console.log('Replay functionality is not yet fully implemented.');
    process.exit(0);
});
program.parse(process.argv);
