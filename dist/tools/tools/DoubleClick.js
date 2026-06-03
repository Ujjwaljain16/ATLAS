"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DoubleClickTool = exports.DoubleClickInputSchema = void 0;
const zod_1 = require("zod");
exports.DoubleClickInputSchema = zod_1.z.object({
    elementId: zod_1.z.string().optional(),
    x: zod_1.z.number().optional(),
    y: zod_1.z.number().optional(),
});
class DoubleClickTool {
    name = 'double_click';
    description = 'Double clicks on an element or specific coordinates';
    inputSchema = exports.DoubleClickInputSchema;
    timeoutMs = 10000;
    maxRetries = 2;
    async execute(input, browser) {
        const start = Date.now();
        try {
            if (input.elementId) {
                const locator = await browser.locateElement(input.elementId);
                await locator.dblclick();
            }
            else if (input.x !== undefined && input.y !== undefined) {
                const page = browser.getPage();
                await page.mouse.dblclick(input.x, input.y);
            }
            else {
                throw new Error("Must provide either elementId or x/y coordinates");
            }
            return {
                success: true,
                data: { clickedElementId: input.elementId },
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
                    code: 'DBLCLICK_FAILED',
                    message: err.message,
                    severity: 'RECOVERABLE',
                    source: 'ELEMENT',
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
exports.DoubleClickTool = DoubleClickTool;
