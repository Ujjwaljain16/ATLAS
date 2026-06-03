"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClickOnScreenTool = exports.ClickOnScreenInputSchema = void 0;
const zod_1 = require("zod");
exports.ClickOnScreenInputSchema = zod_1.z.object({
    elementId: zod_1.z.string().optional(),
    x: zod_1.z.number().optional(),
    y: zod_1.z.number().optional(),
});
class ClickOnScreenTool {
    name = 'click_on_screen';
    description = 'Clicks on an element or specific coordinates on the screen';
    inputSchema = exports.ClickOnScreenInputSchema;
    timeoutMs = 10000;
    maxRetries = 2;
    async execute(input, browser) {
        const start = Date.now();
        try {
            if (input.elementId) {
                const locator = await browser.locateElement(input.elementId);
                await locator.click();
            }
            else if (input.x !== undefined && input.y !== undefined) {
                const page = browser.getPage(); // Need to check if getPage is exposed
                if (!page)
                    throw new Error("Page not available");
                await page.mouse.click(input.x, input.y);
            }
            else {
                throw new Error("Must provide either elementId or x/y coordinates");
            }
            return {
                success: true,
                data: {
                    clickedElementId: input.elementId,
                    x: input.x,
                    y: input.y
                },
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
                    code: 'CLICK_FAILED',
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
exports.ClickOnScreenTool = ClickOnScreenTool;
