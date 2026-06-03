"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenBrowserTool = void 0;
const zod_1 = require("zod");
const uuid_1 = require("uuid");
class OpenBrowserTool {
    name = 'open_browser';
    description = 'Launches the playwright browser';
    inputSchema = zod_1.z.any();
    timeoutMs = 15000;
    maxRetries = 1;
    async execute(params, browser) {
        const startedAt = new Date().toISOString();
        const result = await browser.launch(params);
        const endedAt = new Date().toISOString();
        if (!result.success) {
            return {
                success: false,
                data: null,
                error: {
                    code: 'LAUNCH_FAILED',
                    message: result.error?.message || 'Browser failed to launch',
                    severity: 'FATAL',
                    source: 'BROWSER'
                },
                timing: { startedAt, endedAt, durationMs: Date.parse(endedAt) - Date.parse(startedAt) },
                actionLogEntry: { actionId: (0, uuid_1.v4)(), name: this.name, params, status: 'failure', timestamp: endedAt }
            };
        }
        return {
            success: true,
            data: null,
            error: null,
            timing: { startedAt, endedAt, durationMs: Date.parse(endedAt) - Date.parse(startedAt) },
            actionLogEntry: { actionId: (0, uuid_1.v4)(), name: this.name, params, status: 'success', timestamp: endedAt }
        };
    }
}
exports.OpenBrowserTool = OpenBrowserTool;
