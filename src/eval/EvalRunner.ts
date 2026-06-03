import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';
import { runAgent } from '../index';
import { TaskInputSchema, TaskInput } from '../cli/types';
import { IntentPlanner } from '../cli/IntentPlanner';

export interface EvalResult {
  testId: string;
  testName: string;
  passed: boolean;
  score: number;
  details: any;
}

export class EvalRunner {
  async runSuite(directoryOrFile: string, saveReports: boolean = true) {
    const fullPath = path.resolve(process.cwd(), directoryOrFile);
    let files: string[] = [];

    if (fs.statSync(fullPath).isDirectory()) {
      const allFiles = fs.readdirSync(fullPath);
      files = allFiles
        .filter((f: string) => f.endsWith('.yaml') || f.endsWith('.yml'))
        .map((f: string) => path.join(fullPath, f));
    } else {
      files = [fullPath];
    }

    console.log(`Starting ATLAS Eval Harness. Found ${files.length} tests.`);
    const results: EvalResult[] = [];
    let successCount = 0;

    for (const file of files) {
      console.log(`\n================================`);
      console.log(`Running Eval: ${path.basename(file)}`);
      console.log(`================================`);
      
      const content = fs.readFileSync(file, 'utf8');
      const parsed = yaml.parse(content);
      const testDef = parsed as any; // Allow extra fields like expected
      
      // Convert to TaskInput
      const taskInput: TaskInput = {
        url: testDef.url,
        goal: testDef.goal,
        parameters: testDef.parameters
      };
      
      try {
        const planner = new IntentPlanner();
        const goal = planner.plan(taskInput);
        
        const start = Date.now();
        const { result, metrics } = await runAgent(goal, `eval_${testDef.id}_${Date.now()}`, true, false);
        const duration = Date.now() - start;
        
        const expected = testDef.expected;
        if (!expected) {
          console.warn(`Test ${testDef.id} has no 'expected' block.`);
          continue;
        }
        
        // Validation
        const outcomes = result.completedOutcomes || [];
        const filledSelectors = outcomes.map(o => o.targetSelector);
        
        let passed = true;
        let reasons: string[] = [];
        
        if (expected.success !== undefined) {
          const isSuccess = result.status === 'SUCCESS';
          if (isSuccess !== expected.success) {
            passed = false;
            reasons.push(`Expected success=${expected.success}, got ${isSuccess}`);
          }
        }
        
        if (expected.expectedElements) {
          for (const el of expected.expectedElements) {
            // Very naive check: does any filled selector contain the expected element name/id?
            const found = filledSelectors.some(s => s.includes(el));
            if (!found) {
              passed = false;
              reasons.push(`Missing expected element: ${el}`);
            }
          }
        }
        
        if (expected.activeFormId) {
           const formFound = filledSelectors.some(s => s.includes(expected.activeFormId));
           if (!formFound && expected.expectedElements && expected.expectedElements.length > 0) {
               reasons.push(`Active form mismatch or form not found in selectors: ${expected.activeFormId}`);
               // Note: This is an approximation. A robust check would inspect the actual form of the elements
           }
        }
        
        if (expected.forbiddenElements) {
          for (const el of expected.forbiddenElements) {
            const found = filledSelectors.some(s => s.includes(el));
            if (found) {
              passed = false;
              reasons.push(`Manipulated forbidden element: ${el}`);
            }
          }
        }
        
        console.log(`\nResult for ${testDef.id}: ${passed ? '✅ PASS' : '❌ FAIL'}`);
        if (!passed) {
          console.log(`Reasons: \n - ${reasons.join('\n - ')}`);
        }
        
        results.push({
          testId: testDef.id,
          testName: testDef.name,
          passed,
          score: passed ? 1 : 0,
          details: { duration, status: result.status, reasons, outcomes, metrics }
        });
        
        if (passed) successCount++;
        
      } catch (err: any) {
        console.error(`Eval failed to run ${testDef.id}:`, err);
        results.push({
          testId: testDef.id,
          testName: testDef.name,
          passed: false,
          score: 0,
          details: { error: err.message }
        });
      }
    }
    
    console.log(`\n================================`);
    console.log(`EVAL SUITE COMPLETE`);
    console.log(`Passed: ${successCount} / ${files.length} (${Math.round(successCount / files.length * 100)}%)`);
    console.log(`================================\n`);
    
    // Generate ATLAS_EVAL_REPORT.md
    const reportPath = path.join(process.cwd(), 'ATLAS_EVAL_REPORT.md');
    let reportMd = `# ATLAS Evaluation Report\n\n`;
    reportMd += `**Date:** ${new Date().toISOString()}\n`;
    reportMd += `**Total Tests:** ${files.length}\n`;
    reportMd += `**Success Rate:** ${Math.round(successCount / files.length * 100)}%\n\n`;
    
    reportMd += `## Test Details\n\n`;
    for (const res of results) {
      reportMd += `### ${res.testId}: ${res.testName} - ${res.passed ? '✅ PASS' : '❌ FAIL'}\n`;
      reportMd += `- **Runtime:** ${res.details.duration || 0}ms\n`;
      if (!res.passed && res.details.reasons) {
        reportMd += `- **Failures:**\n  - ${res.details.reasons.join('\n  - ')}\n`;
      }
      if (res.details.error) {
        reportMd += `- **Error:** ${res.details.error}\n`;
      }
      reportMd += `\n`;
    }
    
    fs.writeFileSync(reportPath, reportMd);
    console.log(`Saved evaluation report to ${reportPath}`);
    
    return results;
  }
}
