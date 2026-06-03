"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PerceptionEngine = void 0;
const ReadinessDetector_1 = require("../browser/ReadinessDetector");
const DOMObserver_1 = require("./DOMObserver");
const A11yObserver_1 = require("./A11yObserver");
const ObservationAssembler_1 = require("./ObservationAssembler");
class PerceptionEngine {
    browser;
    config;
    domObserver = new DOMObserver_1.DOMObserver();
    a11yObserver = new A11yObserver_1.A11yObserver();
    assembler = new ObservationAssembler_1.ObservationAssembler();
    readinessDetector = new ReadinessDetector_1.ReadinessDetector();
    constructor(browser, config) {
        this.browser = browser;
        this.config = config;
    }
    async observe() {
        const page = this.browser.getPage();
        // Check readiness without waiting 30 seconds
        const isReady = await this.readinessDetector.checkReady(page);
        // Capture screenshot if enabled
        let screenshotPath = '';
        if (this.config.screenshots.enabled && this.config.screenshots.onAction) {
            screenshotPath = await this.browser.screenshot('observe', false);
        }
        // Extract DOM and A11y signals
        const { elements: domElements, forms } = await this.domObserver.extract(page);
        const a11yRecords = await this.a11yObserver.extract(page);
        // Get frames
        const frames = await this.browser.getFrames();
        // Construct PageMetadata (partially stubbed for visible text blocks and error signals if not directly available)
        const meta = {
            url: page.url(),
            title: await page.title(),
            frameInventory: frames,
            visibleTextBlocks: [], // Stub for VisionObserver later
            errorSignals: [] // Error signals handled per element in DOMObserver
        };
        return this.assembler.assemble(domElements, forms, a11yRecords, screenshotPath, isReady, meta);
    }
}
exports.PerceptionEngine = PerceptionEngine;
