"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NavigateTool = void 0;
const zod_1 = require("zod");
const uuid_1 = require("uuid");
class NavigateTool {
    name = 'navigate_to_url';
    description = 'Navigates to a specific URL';
    inputSchema = zod_1.z.object({
        url: zod_1.z.string().url(),
        allowedDomains: zod_1.z.array(zod_1.z.string()).optional(),
        strictDomainCheck: zod_1.z.boolean().optional()
    });
    timeoutMs = 30000;
    maxRetries = 2;
    async execute(params, browser) {
        const startedAt = new Date().toISOString();
        const result = await browser.navigate(params.url, { timeoutMs: this.timeoutMs, allowedDomains: params.allowedDomains, strictDomainCheck: params.strictDomainCheck });
        const endedAt = new Date().toISOString();
        if (!result.success) {
            return {
                success: false,
                data: null,
                error: {
                    code: 'NAVIGATION_FAILED',
                    message: result.error?.message || 'Failed to navigate',
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
exports.NavigateTool = NavigateTool;
