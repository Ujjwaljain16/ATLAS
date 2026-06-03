import { Page } from 'playwright';

export interface ReadinessConfig {
  timeoutMs: number;
}

export class ReadinessDetector {
  async waitForReady(page: Page, config: ReadinessConfig): Promise<boolean> {
    try {
      // Signal 1: Playwright networkidle
      const networkIdle = await this.waitForNetworkIdle(page, config.timeoutMs);
      
      // Signal 2: Custom element probe
      // Verify ≥1 input/textarea with an associated label exists in DOM
      const elementProbe = await this.runElementProbe(page);
      
      // BOTH must pass — this prevents acting on empty React SPA shells
      return networkIdle && elementProbe;
    } catch (e) {
      return false;
    }
  }

  async checkReady(page: Page): Promise<boolean> {
    try {
      return await this.runElementProbe(page);
    } catch (e) {
      return false;
    }
  }

  private async waitForNetworkIdle(page: Page, timeoutMs: number): Promise<boolean> {
    try {
      await page.waitForLoadState('networkidle', { timeout: timeoutMs });
      return true;
    } catch (e) {
      // On shadcn, networkidle might timeout because of polling etc.
      // We catch the timeout and still proceed to the element probe.
      return false; 
    }
  }
  
  private async runElementProbe(page: Page): Promise<boolean> {
    return page.evaluate(() => {
      const inputs = document.querySelectorAll('input, textarea');
      for (const input of inputs) {
        const id = input.getAttribute('id');
        if (id && document.querySelector(`label[for="${id}"]`)) return true;
        if (input.getAttribute('aria-label')) return true;
        if (input.getAttribute('aria-labelledby')) return true;
      }
      return false;
    });
  }
}
