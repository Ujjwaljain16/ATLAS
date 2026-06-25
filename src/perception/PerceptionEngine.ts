import { BrowserController } from '../browser/BrowserController';
import { ReadinessDetector } from '../browser/ReadinessDetector';
import { DOMObserver } from './DOMObserver';
import { A11yObserver } from './A11yObserver';
import { DocumentObserver } from './DocumentObserver';
import { ObservationAssembler } from './ObservationAssembler';
import { Observation, PageMetadata } from './types';
import { ATLASConfig } from '../config/ATLASConfig';
import { PageClassifier } from './PageClassifier';
import { AccessibilityMatcher } from './AccessibilityMatcher';

export class PerceptionEngine {
  private domObserver = new DOMObserver();
  private a11yObserver = new A11yObserver();
  private documentObserver = new DocumentObserver();
  private assembler = new ObservationAssembler();
  private readinessDetector = new ReadinessDetector();

  constructor(
    private browser: BrowserController,
    private config: ATLASConfig
  ) {}

  async observe(): Promise<Observation> {
    const page = this.browser.getPage();
    
    // Check readiness without waiting 30 seconds
    const isReady = await this.readinessDetector.checkReady(page);

    // Capture screenshot if enabled
    let screenshotPath = '';
    // Note: The main screenshotting logic is moving to AtlasCore based on screenshotMode.
    // We only take an observation screenshot if in 'all_steps' mode.
    if (this.config.screenshots.enabled && this.config.screenshots.mode === 'all_steps') {
      screenshotPath = await this.browser.screenshot('observe', this.config.screenshots.fullPage);
    }

    // Extract DOM and A11y signals in parallel (Performance fix)
    const [
      { elements: rawDomElements, forms },
      a11yRecords,
      a11ySnapshot,
      documentIndex
    ] = await Promise.all([
      this.domObserver.extract(page),
      this.a11yObserver.extract(page),
      this.browser.getA11ySnapshot(),
      this.documentObserver.extract(page)
    ]);

    // V2: Capability 11 - Accessibility Tree Full Integration
    let domElements = AccessibilityMatcher.enrich(rawDomElements, a11ySnapshot);

    // Get frames
    const frames = await this.browser.getFrames();

    // Construct PageMetadata
    const url = page.url();
    const title = await page.title();
    const scrollMetrics = await page.evaluate(() => ({
      scrollX: window.scrollX,
      scrollY: window.scrollY
    }));

    const meta: PageMetadata = {
      url,
      title,
      frameInventory: frames,
      visibleTextBlocks: [], // Stub for VisionObserver later
      errorSignals: [],      // Error signals handled per element in DOMObserver
      scrollX: scrollMetrics.scrollX,
      scrollY: scrollMetrics.scrollY,
      documentIndex: documentIndex.summary // Only store summary in metadata to save tokens
    };

    // V2: Classify page
    const hasVideos = domElements.some(el => el.elementType === 'VIDEO');
    const hasForms = forms.length > 0;
    const classification = PageClassifier.classify(url, title, hasForms, hasVideos);

    // V2: Environment state
    const environment = this.browser.getEnvironmentState();

    return this.assembler.assemble(
      domElements,
      forms,
      a11yRecords,
      screenshotPath,
      isReady,
      meta,
      classification,
      environment
    );
  }
}
