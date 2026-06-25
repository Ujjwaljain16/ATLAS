import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';
import { TaskInputSchema, TaskInput } from './types';

import { runAgent } from '../index';
import { EvalRunner } from '../eval/EvalRunner';
import { z } from 'zod';

const program = new Command();
program.name('atlas').description('ATLAS Browser Agent CLI');

function extractUrlFromGoal(goal: string): string {
  // Match explicit http/https URLs
  const explicitUrl = goal.match(/https?:\/\/[^\s,]+/);
  if (explicitUrl) return explicitUrl[0];
  
  // Match domain-like patterns e.g. github.com/ujjwaljain16, youtube.com
  const domainMatch = goal.match(/\b([a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:\/[^\s,]*)?)\b/);
  if (domainMatch) return 'https://' + domainMatch[1];
  
  return '';
}

function parseGoalOrFile(input: string): TaskInput {
  if (input.endsWith('.yaml') || input.endsWith('.yml') || input.endsWith('.json')) {
    const fullPath = path.resolve(process.cwd(), input);
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
  } else {
    // Natural language goal — extract URL automatically
    const extractedUrl = extractUrlFromGoal(input);
    if (extractedUrl) {
      console.log(`[ATLAS] Detected URL from goal: ${extractedUrl}`);
    } else {
      console.log('[ATLAS] No URL detected in goal. Agent will navigate via reasoning.');
    }
    return {
      goal: input,
      url: extractedUrl || 'https://www.google.com' // fallback to google so planner can search
    } as any;
  }
}

program
  .command('validate <file>')
  .description('Validate a YAML/JSON task definition against the schema')
  .action((file) => {
    parseGoalOrFile(file);
    console.log('✓ Validation successful. Task definition is structurally sound.');
    process.exit(0);
  });

program
  .command('run <input>')
  .description('Run the ATLAS agent against a task definition or raw goal string')
  .option('--headless <boolean>', 'Run browser in headless mode', 'true')
  .option('--verbose', 'Enable verbose execution tracing', false)
  .action(async (input, options) => {
    const parsedInput = parseGoalOrFile(input);
    const goal = { label: parsedInput.goal, targetUrl: parsedInput.url, subObjectives: [] };
    
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

// Expose parseGoalOrFile and run benchmark logic via export or separate command
// For benchmark, since the logic is complex, we can put it here or require scripts/benchmark.ts
program
  .command('benchmark <file>')
  .description('Run a reliability benchmark against a task definition')
  .option('-n, --runs <number>', 'Number of runs', '10')
  .option('--headless <boolean>', 'Run headless', 'true')
  .action(async (file, options) => {
    const parsedInput = parseGoalOrFile(file);
    const goal = { label: parsedInput.goal, targetUrl: parsedInput.url, subObjectives: [] };
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
  .command('eval <directoryOrFile>')
  .description('Run the ATLAS Eval Harness on a test or directory of tests')
  .action(async (directoryOrFile) => {
    const runner = new EvalRunner();
    const results = await runner.runSuite(directoryOrFile);
    const allPassed = results.every(r => r.passed);
    process.exit(allPassed ? 0 : 1);
  });

program
  .command('replay <session.json>')
  .description('Replay a previously executed session from the replay log (Coming soon)')
  .action((sessionFile) => {
    console.log('Replay functionality is not yet fully implemented.');
    process.exit(0);
  });

program.parse(process.argv);
