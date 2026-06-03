"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ToolRuntime = void 0;
const uuid_1 = require("uuid");
class ToolRuntime {
    registry = new Map();
    register(tool) {
        this.registry.set(tool.name, tool);
    }
    async execute(action, browser) {
        const tool = this.registry.get(action.name);
        if (!tool)
            throw new Error(`Unknown tool: ${action.name}`);
        // Input validation via Zod
        const validated = tool.inputSchema.safeParse(action.params);
        if (!validated.success) {
            return this.buildValidationError(action, validated.error);
        }
        // Execute with retry.
        // STRICT-MODE FIX: `let lastResult: ToolResult<any>` without initialization
        // causes a TS2454 "used before assignment" error under strict:true because
        // the compiler cannot prove the loop body executes.
        // Declared as `| undefined` to satisfy strict typing. The non-null cast at
        // the end is safe: the loop always runs ≥1 iteration (attempt 0 always fires).
        // The `!` non-null assertion on the original code is ILLEGAL under strict:true.
        let lastResult;
        for (let attempt = 0; attempt <= tool.maxRetries; attempt++) {
            lastResult = await Promise.race([
                tool.execute(validated.data, browser),
                this.timeout(tool.timeoutMs, action.name),
            ]);
            if (lastResult.success)
                return lastResult;
            if (attempt < tool.maxRetries) {
                const backoff = this.calculateBackoff(attempt);
                await this.sleep(backoff);
            }
        }
        // Safe cast: loop invariant guarantees lastResult is assigned (maxRetries ≥ 0)
        return lastResult;
    }
    buildValidationError(action, error) {
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
                actionId: (0, uuid_1.v4)(),
                name: action.name,
                params: action.params,
                status: 'failure',
                timestamp: new Date().toISOString()
            }
        };
    }
    timeout(ms, name) {
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
                        actionId: (0, uuid_1.v4)(),
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
    calculateBackoff(attempt) {
        return Math.min(1000 * Math.pow(2, attempt), 8000);
    }
    sleep(ms) {
        return new Promise(r => setTimeout(r, ms));
    }
}
exports.ToolRuntime = ToolRuntime;
