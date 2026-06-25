import { ATLASTool, ToolResult, Action, ToolError } from './types';
import { BrowserController } from '../browser/BrowserController';
import { ZodError } from 'zod';
import { v4 as uuid } from 'uuid';
import { SkillRegistry } from '../skills/SkillRegistry';

import * as fs from 'fs';
import * as path from 'path';
import { pathToFileURL } from 'url';

export class ToolRuntime {
  private registry: Map<string, ATLASTool<any, any>> = new Map();
  private skillRegistry?: SkillRegistry;
  /** Set after construction — the observe function needed by skills */
  private observeFn?: () => Promise<any[]>;
  
  setSkillRegistry(skillRegistry: SkillRegistry): void {
    this.skillRegistry = skillRegistry;
  }

  setObserveFn(fn: () => Promise<any[]>): void {
    this.observeFn = fn;
  }
  
  register(tool: ATLASTool<any, any>): void {
    this.registry.set(tool.name, tool);
  }

  getDescriptions(): Array<{ name: string; description: string; metadata?: any }> {
    return Array.from(this.registry.values()).map(t => ({
      name: t.name,
      description: t.description,
      metadata: t.metadata
    }));
  }

  getSkillDescriptions(): Array<{ name: string; description: string; metadata?: any }> {
    if (!this.skillRegistry) return [];
    return this.skillRegistry.getDescriptions();
  }

  async loadPlugins(pluginsDir: string): Promise<void> {
    if (!fs.existsSync(pluginsDir)) {
      console.warn(`[WARN] Plugins directory not found: ${pluginsDir}`);
      return;
    }

    const files = fs.readdirSync(pluginsDir);
    let loadedCount = 0;

    for (const file of files) {
      if (file.endsWith('.js') || file.endsWith('.ts')) {
        try {
          const modulePath = path.join(pluginsDir, file);
          const module = await import(pathToFileURL(modulePath).toString());
          
          // Heuristic: try to find exported classes that look like tools
          for (const key of Object.keys(module)) {
            const ExportedItem = module[key];
            if (typeof ExportedItem === 'function' && ExportedItem.prototype && ExportedItem.prototype.execute) {
              const toolInstance = new ExportedItem();
              if (toolInstance.name && toolInstance.execute) {
                this.register(toolInstance);
                loadedCount++;
              }
            }
          }
        } catch (err: any) {
          console.error(`[ERROR] Failed to load plugin from ${file}:`, err.message);
        }
      }
    }
    console.log(`[INFO] Loaded ${loadedCount} plugins from ${pluginsDir}`);
  }
  
  async execute(action: Action, browser: BrowserController): Promise<ToolResult<any>> {
    // Route capability invocations to the SkillRegistry
    if (action.name === 'capability') {
      if (!this.skillRegistry) {
        throw new Error('capability action called but no SkillRegistry is registered.');
      }
      
      // Dispatcher: resolve capability to specific skill class
      const capabilityMapping: Record<string, string> = {
        'continuous_scroll': 'ContinuousScrollSkill'
      };
      
      const capabilityType = action.params?.type;
      const skillName = capabilityMapping[capabilityType];
      
      if (!skillName) {
         throw new Error(`Unknown capability: ${capabilityType}`);
      }

      const ctx = {
        toolRuntime: this,
        browser,
        observe: this.observeFn || (() => Promise.resolve([]))
      };
      
      const skillResult = await this.skillRegistry.invoke(skillName, action.params?.params || {}, ctx);
      const now = new Date().toISOString();
      return {
        success: skillResult.success,
        data: skillResult.data,
        error: skillResult.success ? null : {
          code: 'SKILL_FAILED',
          message: skillResult.failureReason || 'Skill failed',
          severity: 'RECOVERABLE',
          source: 'SYSTEM'
        },
        timing: { startedAt: now, endedAt: now, durationMs: 0 },
        actionLogEntry: { actionId: uuid(), name: 'capability', params: action.params, status: skillResult.success ? 'success' : 'failure', timestamp: now }
      };
    }

    const tool = this.registry.get(action.name);
    if (!tool) throw new Error(`Unknown tool: ${action.name}`);
    
    // Input validation via Zod
    const validated = tool.inputSchema.safeParse(action.params);
    if (!validated.success) {
      return this.buildValidationError(action, validated.error);
    }

    let finalAction = action;
    let finalValidatedData = validated.data;

    // --- TRANSITION ENGINE (Pre-Execution Resolution) ---
    if (tool.requiredState && finalAction.params?.elementId) {
      const elementId = finalAction.params.elementId;
      try {
        const currentState = await browser.getElementState(elementId);
        const engine = new (require('./TransitionEngine').TransitionEngine)();
        const plan = engine.plan(finalAction, currentState, tool.requiredState);

        // Execute setup actions
        for (const setupAction of plan.setupActions) {
          console.log(`[TransitionEngine] Executing setup action: ${setupAction.name} on ${setupAction.params.elementId}`);
          const setupResult = await this.execute(setupAction, browser);
          if (!setupResult.success) {
            throw new Error(`Transition failed during ${setupAction.name}: ${setupResult.error?.message}`);
          }
        }

        if (plan.resolvedAction) {
          finalAction = plan.resolvedAction;
          // Re-validate the new params
          const reValidated = tool.inputSchema.safeParse(finalAction.params);
          if (!reValidated.success) throw new Error("Resolved action failed validation");
          finalValidatedData = reValidated.data;
        }
      } catch (err: any) {
         return {
           success: false,
           data: null,
           error: {
             code: 'TRANSITION_FAILED',
             message: err.message,
             severity: 'RECOVERABLE',
             source: 'SYSTEM'
           },
           timing: { startedAt: new Date().toISOString(), endedAt: new Date().toISOString(), durationMs: 0 },
           actionLogEntry: {
             actionId: uuid(),
             name: action.name,
             params: action.params,
             status: 'failure',
             timestamp: new Date().toISOString()
           }
         };
      }
    }
    // --- END TRANSITION ENGINE ---

    // Execute with retry.
    // STRICT-MODE FIX: `let lastResult: ToolResult<any>` without initialization
    // causes a TS2454 "used before assignment" error under strict:true because
    // the compiler cannot prove the loop body executes.
    // Declared as `| undefined` to satisfy strict typing. The non-null cast at
    // the end is safe: the loop always runs ≥1 iteration (attempt 0 always fires).
    // The `!` non-null assertion on the original code is ILLEGAL under strict:true.
    let lastResult: ToolResult<any> | undefined;
    for (let attempt = 0; attempt <= tool.maxRetries; attempt++) {
      lastResult = await Promise.race([
        tool.execute(finalValidatedData, browser),
        this.timeout(tool.timeoutMs, action.name),
      ]);
      
      if (lastResult.success) return lastResult;
      
      if (attempt < tool.maxRetries) {
        const backoff = this.calculateBackoff(attempt);
        await this.sleep(backoff);
      }
    }
    
    // Safe cast: loop invariant guarantees lastResult is assigned (maxRetries ≥ 0)
    return lastResult as ToolResult<any>;
  }

  private buildValidationError(action: Action, error: ZodError): ToolResult<any> {
    return {
      success: false,
      data: null,
      error: {
        code: 'VALIDATION_ERROR',
        message: error.message,
        severity: 'FATAL',
        source: 'SYSTEM',
      },
      timing: {
        startedAt: new Date().toISOString(),
        endedAt: new Date().toISOString(),
        durationMs: 0
      },
      actionLogEntry: {
        actionId: uuid(),
        name: action.name,
        params: action.params,
        status: 'failure',
        timestamp: new Date().toISOString()
      }
    };
  }

  private timeout(ms: number, name: string): Promise<ToolResult<any>> {
    return new Promise(resolve => {
      const timer = setTimeout(() => {
        resolve({
          success: false,
          data: null,
          error: {
            code: 'TOOL_TIMEOUT',
            message: `Tool ${name} timed out after ${ms}ms`,
            severity: 'RECOVERABLE',
            source: 'SYSTEM'
          },
          timing: { startedAt: '', endedAt: '', durationMs: ms },
          actionLogEntry: {
            actionId: uuid(),
            name,
            params: {},
            status: 'failure',
            timestamp: new Date().toISOString()
          }
        });
      }, ms);
      timer.unref();
    });
  }

  private calculateBackoff(attempt: number): number {
    return Math.min(1000 * Math.pow(2, attempt), 8000);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(r => setTimeout(r, ms));
  }
}
