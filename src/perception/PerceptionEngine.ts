import { BrowserController } from '../browser/BrowserController';
import { ReadinessDetector } from '../browser/ReadinessDetector';
import { DOMObserver } from './DOMObserver';
import { A11yObserver } from './A11yObserver';
import { ObservationAssembler } from './ObservationAssembler';
import { Observation, PageMetadata } from './types';
import { ATLASConfig } from '../config/ATLASConfig';

export class PerceptionEngine {
  private domObserver = new DOMObserver();
  private a11yObserver = new A11yObserver();
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
    if (this.config.screenshots.enabled && this.config.screenshots.onAction) {
      screenshotPath = await this.browser.screenshot('observe', false);
    }

    // Extract DOM and A11y signals
    const domElements = await this.domObserver.extract(page);
    const a11yRecords = await this.a11yObserver.extract(page);

    // Get frames
    const frames = await this.browser.getFrames();

    // Construct PageMetadata (partially stubbed for visible text blocks and error signals if not directly available)
    const meta: PageMetadata = {
      url: page.url(),
      title: await page.title(),
      frameInventory: frames,
      visibleTextBlocks: [], // Stub for VisionObserver later
      errorSignals: []       // Error signals handled per element in DOMObserver
    };

    return this.assembler.assemble(
      domElements,
      a11yRecords,
      screenshotPath,
      isReady,
      meta
    );
  }
}
