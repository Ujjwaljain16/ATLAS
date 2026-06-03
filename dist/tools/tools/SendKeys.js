"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SendKeysTool = exports.SendKeysInputSchema = void 0;
const zod_1 = require("zod");
exports.SendKeysInputSchema = zod_1.z.object({
    elementId: zod_1.z.string(),
    text: zod_1.z.string(),
    clearFirst: zod_1.z.boolean().default(false),
    typeDelayMs: zod_1.z.number().optional()
});
class SendKeysTool {
    name = 'send_keys';
    description = 'Sends keystrokes to an element identified by elementId';
    inputSchema = exports.SendKeysInputSchema;
    timeoutMs = 15000;
    maxRetries = 2;
    async execute(input, browser) {
        const start = Date.now();
        try {
            const locator = await browser.locateElement(input.elementId);
            if (input.clearFirst) {
                await locator.clear();
            }
            // Strategy 1: Playwright fill() — best for React controlled inputs
            await locator.fill(input.text);
            // Verify the value registered in the DOM
            const finalValue = await locator.inputValue();
            // react-hook-form check: if fill() didn't register, try type() char-by-char
            if (finalValue !== input.text) {
                await locator.clear();
                // Use pressSequentially() — fires keyboard events one character at a time,
                // correctly triggering React synthetic event handlers (onChange, onInput).
                await locator.pressSequentially(input.text, { delay: input.typeDelayMs || 20 });
            }
            return {
                success: true,
                data: {
                    charactersTyped: input.text.length,
                    finalValue: await locator.inputValue()
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
                    code: 'SEND_KEYS_FAILED',
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
exports.SendKeysTool = SendKeysTool;
