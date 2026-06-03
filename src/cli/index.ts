import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';
import { TaskInputSchema, TaskInput } from './types';
import { IntentPlanner } from './IntentPlanner';
import { runAgent } from '../index';
import { z } from 'zod';

const program = new Command();
program.name('atlas').description('ATLAS Browser Agent CLI');

function parseTaskFile(filePath: string): TaskInput {
  const fullPath = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(fullPath)) {
    console.error(`Error: File not found at ${fullPath}`);
    process.exit(1);
  }
  
  const content = fs.readFileSync(fullPath, 'utf8');
  let parsed: any;
  
  try {
    if (fullPath.endsWith('.yaml') || fullPath.endsWith('.yml')) {
      parsed = yaml.parse(content);
    } else {
      parsed = JSON.parse(content);
    }
  } catch (err: any) {
    console.error(`Error parsing file: ${err.message}`);
    process.exit(1);
  }
  
  try {
    return TaskInputSchema.parse(parsed);
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      console.error('Validation Error: Task definition does not match schema:');
      console.error(JSON.stringify((err as any).errors, null, 2));
    } else {
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
    const planner = new IntentPlanner();
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
    const planner = new IntentPlanner();
    const goal = planner.plan(input);
    
    console.log(`Executing Goal: ${goal.label}`);
    const headless = options.headless === 'true' || options.headless === true;
    const verbose = options.verbose === true || options.verbose === 'true';
    console.log(`[DEBUG] headless parsed as: ${headless} (from options.headless: ${options.headless})`);
    
    const { result, metrics } = await runAgent(goal, undefined, headless, verbose);
    
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
    const planner = new IntentPlanner();
    const goal = planner.plan(input);
    const runs = parseInt(options.runs, 10);
    const headless = options.headless === 'true';
    
    // Inline simplified benchmark executor
    const results = [];
    let successCount = 0;
    let totalRuntimeMs = 0;
    
    const historyDir = path.join(process.cwd(), 'benchmark-history');
    if (!fs.existsSync(historyDir)) fs.mkdirSync(historyDir, { recursive: true });
    
    console.log(`Starting ATLAS Reliability Benchmark (${runs} runs) for goal: ${goal.label}`);
    
    for (let i = 1; i <= runs; i++) {
      const sessionId = `benchmark_run_${i}_${Date.now()}`;
      console.log(`\n--- RUN ${i}/${runs} [${sessionId}] ---`);
      const start = Date.now();
      try {
        const { result, metrics } = await runAgent(goal, sessionId, headless);
        const runtime = Date.now() - start;
        console.log(`Run ${i} finished with status: ${result.status} in ${runtime}ms`);
        if (result.status === 'SUCCESS') successCount++;
        totalRuntimeMs += runtime;
        results.push({ run: i, sessionId, status: result.status, runtimeMs: runtime, metrics });
      } catch (err: any) {
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
