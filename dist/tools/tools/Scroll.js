"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScrollTool = exports.ScrollInputSchema = void 0;
const zod_1 = require("zod");
exports.ScrollInputSchema = zod_1.z.object({
    elementId: zod_1.z.string().optional(),
    direction: zod_1.z.enum(['up', 'down', 'left', 'right']).optional(),
    amount: zod_1.z.number().optional()
});
class ScrollTool {
    name = 'scroll';
    description = 'Scrolls the page or a specific element';
    inputSchema = exports.ScrollInputSchema;
    timeoutMs = 10000;
    maxRetries = 1;
    async execute(input, browser) {
        const start = Date.now();
        try {
            if (input.elementId) {
                const locator = await browser.locateElement(input.elementId);
                await locator.scrollIntoViewIfNeeded();
            }
            else {
                const page = browser.getPage();
                const amount = input.amount || 500;
                const sign = input.direction === 'up' || input.direction === 'left' ? -1 : 1;
                const x = input.direction === 'left' || input.direction === 'right' ? amount * sign : 0;
                const y = input.direction === 'up' || input.direction === 'down' ? amount * sign : amount; // Default down
                await page.mouse.wheel(x, y);
            }
            return {
                success: true,
                data: { scrolled: true },
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
                    code: 'SCROLL_FAILED',
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
exports.ScrollTool = ScrollTool;
