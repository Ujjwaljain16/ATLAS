"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReadinessDetector = void 0;
class ReadinessDetector {
    async waitForReady(page, config) {
        try {
            // Signal 1: Playwright networkidle
            const networkIdle = await this.waitForNetworkIdle(page, config.timeoutMs);
            // Signal 2: Custom element probe
            // Verify ≥1 input/textarea with an associated label exists in DOM
            const elementProbe = await this.runElementProbe(page);
            // BOTH must pass — this prevents acting on empty React SPA shells
            return networkIdle && elementProbe;
        }
        catch (e) {
            return false;
        }
    }
    async checkReady(page) {
        try {
            return await this.runElementProbe(page);
        }
        catch (e) {
            return false;
        }
    }
    async waitForNetworkIdle(page, timeoutMs) {
        try {
            await page.waitForLoadState('networkidle', { timeout: timeoutMs });
            return true;
        }
        catch (e) {
            // On shadcn, networkidle might timeout because of polling etc.
            // We catch the timeout and still proceed to the element probe.
            return false;
        }
    }
    async runElementProbe(page) {
        return page.evaluate(() => {
            const inputs = document.querySelectorAll('input, textarea');
            for (const input of inputs) {
                const id = input.getAttribute('id');
                if (id && document.querySelector(`label[for="${id}"]`))
                    return true;
                if (input.getAttribute('aria-label'))
                    return true;
                if (input.getAttribute('aria-labelledby'))
                    return true;
            }
            return false;
        });
    }
}
exports.ReadinessDetector = ReadinessDetector;
