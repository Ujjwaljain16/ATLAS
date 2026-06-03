"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.BrowserController = void 0;
const playwright_1 = require("playwright");
const ReadinessDetector_1 = require("./ReadinessDetector");
const FrameManager_1 = require("./FrameManager");
const path = __importStar(require("path"));
class BrowserController {
    browser = null;
    context = null;
    page = null;
    readinessDetector;
    frameManager;
    // Element registry for locating by elementId
    elementRegistry = new Map();
    constructor() {
        this.readinessDetector = new ReadinessDetector_1.ReadinessDetector();
        this.frameManager = new FrameManager_1.FrameManager();
    }
    async launch(config) {
        try {
            this.browser = await playwright_1.chromium.launch({
                headless: config.headless,
                timeout: config.launchTimeoutMs,
                slowMo: config.headless ? 0 : 800
            });
            this.context = await this.browser.newContext({
                viewport: config.viewport
            });
            this.page = await this.context.newPage();
            this.frameManager.setPage(this.page);
            return { success: true };
        }
        catch (error) {
            return { success: false, error };
        }
    }
    async navigate(url, options) {
        if (!this.page)
            return { success: false, error: new Error('Browser not launched') };
        // Security: Check allowed domains
        try {
            const targetUrl = new URL(url);
            const allowed = options.allowedDomains || [];
            if (allowed.length > 0 && !allowed.some((domain) => targetUrl.hostname.endsWith(domain))) {
                if (options.strictDomainCheck) {
                    return { success: false, error: new Error(`Navigation blocked: ${targetUrl.hostname} is not an allowed domain.`) };
                }
                else {
                    console.warn(`[WARN] Navigation to ${targetUrl.hostname} is outside allowed domains. Proceeding in non-strict mode.`);
                }
            }
        }
        catch (e) {
            return { success: false, error: new Error(`Navigation blocked: invalid URL ${url}`) };
        }
        try {
            await this.page.goto(url, {
                waitUntil: options.waitUntil || 'networkidle',
                timeout: options.timeoutMs || 30000
            });
            // Dual-signal wait
            await this.readinessDetector.waitForReady(this.page, { timeoutMs: options.timeoutMs || 30000 });
            return { success: true };
        }
        catch (error) {
            return { success: false, error };
        }
    }
    async screenshot(label, fullPage) {
        if (!this.page)
            throw new Error('Browser not launched');
        const safeLabel = label.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 50);
        const filename = `${Date.now()}_${safeLabel}.png`;
        const screenshotPath = path.join(process.cwd(), 'screenshots', filename);
        await this.page.screenshot({ path: screenshotPath, fullPage });
        return screenshotPath;
    }
    async getFrames() {
        return this.frameManager.getFrames();
    }
    async switchFrame(frameId) {
        await this.frameManager.switchFrame(frameId);
    }
    async resetToMainFrame() {
        await this.frameManager.resetToMainFrame();
    }
    async evaluate(script) {
        if (!this.page)
            throw new Error('Browser not launched');
        // We execute script in the currently active frame
        const target = this.frameManager.getActiveTarget() || this.page;
        return target.evaluate(script);
    }
    async getA11ySnapshot() {
        if (!this.page)
            return null;
        return this.page.accessibility?.snapshot();
    }
    async forceClose() {
        const withTimeout = (promise, ms) => {
            return Promise.race([
                promise,
                new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), ms))
            ]);
        };
        if (this.page) {
            try {
                await withTimeout(this.page.close(), 500);
            }
            catch (e) { }
            this.page = null;
        }
        if (this.context) {
            try {
                await withTimeout(this.context.close(), 500);
            }
            catch (e) { }
            this.context = null;
        }
        if (this.browser) {
            try {
                await withTimeout(this.browser.close(), 2000);
            }
            catch (e) {
                console.warn('\n[WARN] Forced Browser Shutdown: Chromium process hung and was abandoned after 2000ms.');
            }
            this.browser = null;
        }
    }
    // Expose for tool usage indirectly via a safe getter if needed,
    // but strictly ATLAS pattern: Only BrowserController interacts directly with playwright APIs.
    // Actually, ToolRuntime needs to interact with Playwright elements. 
    // Let's provide a safe accessor for the active page/frame so tools can execute Playwright actions.
    // Registration for ElementId
    registerElements(elements) {
        this.elementRegistry.clear();
        for (const el of elements) {
            if (el.elementId)
                this.elementRegistry.set(el.elementId, el);
        }
    }
    // locateElement needed by tools
    async locateElement(elementId) {
        if (!this.page)
            throw new Error('Browser not launched');
        const record = this.elementRegistry.get(elementId);
        if (!record)
            throw new Error(`Element ${elementId} not found in registry`);
        const target = this.frameManager.getActiveTarget() || this.page;
        if (!record.selector) {
            throw new Error(`Element ${elementId} missing selector in registry`);
        }
        return target.locator(record.selector);
    }
    async pressKey(key) {
        if (!this.page)
            throw new Error('Browser not launched');
        await this.page.keyboard.press(key);
    }
    getActiveTarget() {
        if (!this.page)
            throw new Error('Browser not launched');
        return this.frameManager.getActiveTarget() || this.page;
    }
    getPage() {
        if (!this.page)
            throw new Error('Browser not launched');
        return this.page;
    }
}
exports.BrowserController = BrowserController;
