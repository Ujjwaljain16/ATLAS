"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TakeScreenshotTool = exports.TakeScreenshotInputSchema = void 0;
const zod_1 = require("zod");
exports.TakeScreenshotInputSchema = zod_1.z.object({
    label: zod_1.z.string().default('screenshot'),
    fullPage: zod_1.z.boolean().default(false)
});
class TakeScreenshotTool {
    name = 'take_screenshot';
    description = 'Takes a screenshot of the current page';
    inputSchema = exports.TakeScreenshotInputSchema;
    timeoutMs = 15000;
    maxRetries = 1;
    async execute(input, browser) {
        const start = Date.now();
        try {
            const path = await browser.screenshot(input.label, input.fullPage);
            return {
                success: true,
                data: { path },
                error: null,
                timing: this.buildTiming(start),
                actionLogEntry: this.buildActionLog(input, 'success'),
            };
        }
        catch (err) {
            return {
                success: false,
                data: null,
                error: {
                    code: 'SCREENSHOT_FAILED',
                    message: err.message,
                    severity: 'RECOVERABLE',
                    source: 'SYSTEM',
                },
                timing: this.buildTiming(start),
                actionLogEntry: this.buildActionLog(input, 'failure'),
            };
        }
    }
    buildTiming(start) {
        return {
            startedAt: new Date(start).toISOString(),
            endedAt: new Date().toISOString(),
            durationMs: Date.now() - start
        };
    }
    buildActionLog(input, status) {
        return {
            actionId: Math.random().toString(),
            name: this.name,
            params: input,
            status,
            timestamp: new Date().toISOString()
        };
    }
}
exports.TakeScreenshotTool = TakeScreenshotTool;
