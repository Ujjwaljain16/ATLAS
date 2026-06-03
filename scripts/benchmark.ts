import * as fs from 'fs';
import * as path from 'path';
import { runAgent } from '../src/index';
import { IntentPlanner } from '../src/cli/IntentPlanner';

const NUM_RUNS = process.env.RUNS ? parseInt(process.env.RUNS, 10) : 10;
const HEADLESS = process.env.HEADLESS !== 'false';

async function runBenchmark() {
  console.log(`Starting ATLAS Reliability Benchmark (${NUM_RUNS} runs)`);
  console.log(`Headless: ${HEADLESS}`);
  
  const results = [];
  let successCount = 0;
  let totalRuntimeMs = 0;
  let maxRuntimeMs = 0;
  
  const historyDir = path.join(process.cwd(), 'benchmark-history');
  if (!fs.existsSync(historyDir)) {
    fs.mkdirSync(historyDir, { recursive: true });
  }
  
  const planner = new IntentPlanner();
  const goal = planner.plan({
    goal: 'Fill Name and Description fields on shadcn react-hook-form demo',
    url: 'https://ui.shadcn.com/docs/forms/react-hook-form',
    parameters: {
      Name: 'John Doe',
      Description: 'A passionate developer.'
    }
  });
  
  for (let i = 1; i <= NUM_RUNS; i++) {
    const sessionId = `benchmark_run_${i}_${Date.now()}`;
    console.log(`\n--- RUN ${i}/${NUM_RUNS} [${sessionId}] ---`);
    
    const start = Date.now();
    try {
      const { result, metrics } = await runAgent(goal, sessionId, HEADLESS);
      const runtime = Date.now() - start;
      
      console.log(`Run ${i} finished with status: ${result.status} in ${runtime}ms`);
      
      if (result.status === 'SUCCESS') successCount++;
      totalRuntimeMs += runtime;
      if (runtime > maxRuntimeMs) maxRuntimeMs = runtime;
      
      results.push({
        run: i,
        sessionId,
        status: result.status,
        steps: result.steps,
        runtimeMs: runtime,
        metrics
      });
      
    } catch (err: any) {
      console.error(`Run ${i} failed with uncaught error:`, err);
      results.push({
        run: i,
        sessionId,
        status: 'UNCAUGHT_ERROR',
        error: err.message,
        runtimeMs: Date.now() - start
      });
    }
  }
  
  const successRate = (successCount / NUM_RUNS) * 100;
  const avgRuntimeMs = totalRuntimeMs / NUM_RUNS;
  
  const report = {
    date: new Date().toISOString(),
    runs: NUM_RUNS,
    successRate,
    avgRuntimeMs: Math.round(avgRuntimeMs),
    maxRuntimeMs,
    failures: NUM_RUNS - successCount,
    detailedResults: results
  };
  
  const today = new Date().toISOString().split('T')[0];
  const reportPath = path.join(historyDir, `${today}.json`);
  
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  
  console.log('\n=========================================');
  console.log(' ATLAS Reliability Report');
  console.log('=========================================');
  console.log(JSON.stringify({
    runs: report.runs,
    successRate: report.successRate + '%',
    avgRuntimeMs: report.avgRuntimeMs,
    failures: report.failures
  }, null, 2));
  console.log(`\nFull report saved to: ${reportPath}`);
}

runBenchmark().catch(console.error);
