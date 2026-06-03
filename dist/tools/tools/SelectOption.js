"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SelectOptionTool = exports.SelectOptionInputSchema = void 0;
const zod_1 = require("zod");
exports.SelectOptionInputSchema = zod_1.z.object({
    elementId: zod_1.z.string(),
    text: zod_1.z.string(), // The visible text to select
});
class SelectOptionTool {
    name = 'select_option';
    description = 'Selects an option from a dropdown element identified by elementId';
    inputSchema = exports.SelectOptionInputSchema;
    timeoutMs = 15000;
    maxRetries = 2;
    async execute(input, browser) {
        const start = Date.now();
        try {
            const locator = await browser.locateElement(input.elementId);
            // Select the option by its visible text label
            const selected = await locator.selectOption({ label: input.text });
            return {
                success: true,
                data: {
                    selectedValues: selected
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
                    code: 'SELECT_OPTION_FAILED',
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
exports.SelectOptionTool = SelectOptionTool;
