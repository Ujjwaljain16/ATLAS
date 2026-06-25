import { Browser, BrowserContext, Page, chromium } from 'playwright';
import { ATLASConfig } from '../config/ATLASConfig';
import { BrowserLaunchResult, NavigateOptions, NavigateResult, FrameRecord } from './types';
import { ReadinessDetector } from './ReadinessDetector';
import { FrameManager } from './FrameManager';
import * as path from 'path';

export class BrowserController {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  
  private readinessDetector: ReadinessDetector;
  private frameManager: FrameManager;
  
  // Element registry for locating by elementId
  private elementRegistry: Map<string, any> = new Map();

  // V2 Browser State Tracking
  private lastConsoleError: string | null = null;
  private activeDialog: { type: string, message: string } | null = null;
  private canGoBack: boolean = false;
  private canGoForward: boolean = false;

  constructor() {
    this.readinessDetector = new ReadinessDetector();
    this.frameManager = new FrameManager();
  }

  async launch(config: ATLASConfig['browser']): Promise<BrowserLaunchResult> {
    try {
      this.browser = await chromium.launch({
        headless: config.headless,
        timeout: config.launchTimeoutMs,
        slowMo: config.headless ? 0 : 800
      });
      this.context = await this.browser.newContext({
        viewport: config.viewport
      });
      this.page = await this.context.newPage();
      this.frameManager.setPage(this.page);
      
      this.page.on('pageerror', (err) => {
        this.lastConsoleError = err.message;
      });
      
      this.page.on('console', (msg) => {
        if (msg.type() === 'error') {
          this.lastConsoleError = msg.text();
        }
      });
      
      this.page.on('dialog', async (dialog) => {
        this.activeDialog = { type: dialog.type(), message: dialog.message() };
        // We do not auto-dismiss here in V2 because the agent might want to interact with it,
        // but if it blocks, it might be problematic. Let's dismiss by default after recording.
        await dialog.dismiss();
      });

      return { success: true };
    } catch (error: any) {
      return { success: false, error };
    }
  }

  async navigate(url: string, options: NavigateOptions & { allowedDomains?: string[], strictDomainCheck?: boolean }): Promise<NavigateResult> {
    if (!this.page) return { success: false, error: new Error('Browser not launched') };
    
    // Security: Check allowed domains
    try {
      const targetUrl = new URL(url);
      const allowed = options.allowedDomains || [];
      if (allowed.length > 0 && !allowed.some((domain: string) => targetUrl.hostname.endsWith(domain))) {
        if (options.strictDomainCheck) {
          return { success: false, error: new Error(`Navigation blocked: ${targetUrl.hostname} is not an allowed domain.`) };
        } else {
          console.warn(`[WARN] Navigation to ${targetUrl.hostname} is outside allowed domains. Proceeding in non-strict mode.`);
        }
      }
    } catch (e) {
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
    } catch (error: any) {
      return { success: false, error };
    }
  }

  async screenshot(label: string, fullPage: boolean): Promise<string> {
    if (!this.page) {
      console.warn('[WARN] Cannot take screenshot: Browser not launched.');
      return '';
    }
    const safeLabel = label.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 50);
    const filename = `${Date.now()}_${safeLabel}.png`;
    const screenshotPath = path.join(process.cwd(), 'screenshots', filename);
    await this.page.screenshot({ path: screenshotPath, fullPage });
    return screenshotPath;
  }

  async getFrames(): Promise<FrameRecord[]> {
    return this.frameManager.getFrames();
  }

  async switchFrame(frameId: string): Promise<void> {
    await this.frameManager.switchFrame(frameId);
  }

  async resetToMainFrame(): Promise<void> {
    await this.frameManager.resetToMainFrame();
  }

  async evaluate<T>(script: string): Promise<T> {
    if (!this.page) throw new Error('Browser not launched');
    // We execute script in the currently active frame
    const target = this.frameManager.getActiveTarget() || this.page;
    return target.evaluate(script) as Promise<T>;
  }
  
  async getA11ySnapshot(): Promise<any | null> {
    if (!this.page) return null;
    return (this.page as any).accessibility?.snapshot();
  }
  
  async forceClose(): Promise<void> {
    const withTimeout = (promise: Promise<any>, ms: number) => {
      return Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), ms))
      ]);
    };

    if (this.page) {
      try { await withTimeout(this.page.close(), 500); } catch (e) {}
      this.page = null;
    }
    if (this.context) {
      try { await withTimeout(this.context.close(), 500); } catch (e) {}
      this.context = null;
    }
    if (this.browser) {
      try {
        await withTimeout(this.browser.close(), 2000);
      } catch (e) {
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
  registerElements(elements: any[]) {
    this.elementRegistry.clear();
    for (const el of elements) {
      if (el.id) this.elementRegistry.set(el.id, el);
    }
  }

  // locateElement needed by tools
  async locateElement(elementId: string): Promise<any> {
    if (!this.page) throw new Error('Browser not launched');
    const record = this.elementRegistry.get(elementId);
    if (!record) throw new Error(`Element ${elementId} not found in registry`);
    
    const target = this.frameManager.getActiveTarget() || this.page;
    
    if (!record.selector) {
      throw new Error(`Element ${elementId} missing selector in registry`);
    }
    
    return target.locator(record.selector);
  }

  async getElementState(elementId: string): Promise<{ visible: boolean; enabled: boolean; editable: boolean; focused: boolean }> {
    if (!this.page) throw new Error('Browser not launched');
    const locator = await this.locateElement(elementId);
    
    const visible = await locator.isVisible().catch(() => false);
    const enabled = await locator.isEnabled().catch(() => false);
    const editable = await locator.isEditable().catch(() => false);
    const focused = await locator.evaluate((node: any) => document.activeElement === node).catch(() => false);

    return { visible, enabled, editable, focused };
  }

  async pressKey(key: string): Promise<void> {
    if (!this.page) throw new Error('Browser not launched');
    await this.page.keyboard.press(key);
  }

  getActiveTarget() {
    if (!this.page) throw new Error('Browser not launched');
    return this.frameManager.getActiveTarget() || this.page;
  }
  
  getPage(): Page {
    if (!this.page) throw new Error('Browser not launched');
    return this.page;
  }
  
  getEnvironmentState() {
    return {
      lastConsoleError: this.lastConsoleError,
      activeDialog: this.activeDialog,
      openTabsCount: this.context ? this.context.pages().length : 0,
      canGoBack: this.canGoBack,
      canGoForward: this.canGoForward
    };
  }

  public readonly pageOperations = {
    scroll: async (direction: 'up' | 'down' | 'left' | 'right', amount: number = 500): Promise<void> => {
      if (!this.page) throw new Error('Browser not launched');
      const sign = direction === 'up' || direction === 'left' ? -1 : 1;
      const x = direction === 'left' || direction === 'right' ? amount * sign : 0;
      const y = direction === 'up' || direction === 'down' ? amount * sign : amount;
      await this.page.mouse.wheel(x, y);
      await this.page.waitForTimeout(400); // Give JS time to load items after scroll
    }
  };
}
