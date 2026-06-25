import { Page } from 'playwright';

export interface ReadinessConfig {
  timeoutMs: number;
}

export class ReadinessDetector {
  async waitForReady(page: Page, config: ReadinessConfig): Promise<boolean> {
    try {
      // Signal 1: Playwright networkidle
      const networkIdle = await this.waitForNetworkIdle(page, config.timeoutMs);
      
      // Signal 2: requestAnimationFrame and DOM stability check
      const isSettled = await this.waitForRenderSettlement(page);

      // Signal 3: Custom element probe
      const elementProbe = await this.runElementProbe(page);
      
      return networkIdle && isSettled && elementProbe;
    } catch (e) {
      return false;
    }
  }

  async checkReady(page: Page): Promise<boolean> {
    try {
      const isSettled = await this.waitForRenderSettlement(page);
      const elementProbe = await this.runElementProbe(page);
      return isSettled && elementProbe;
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

  /**
   * Monitor requestAnimationFrame to ensure main thread is unblocked,
   * then check if the total number of DOM nodes remains stable for 300ms.
   */
  private async waitForRenderSettlement(page: Page): Promise<boolean> {
    try {
      return await page.evaluate(async () => {
        // 1. Wait for RAF twice to ensure painting is unblocked
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        
        // 2. DOM Stability Check
        return await new Promise<boolean>((resolve) => {
          let lastCount = document.querySelectorAll('*').length;
          let checkInterval: number;
          let attempts = 0;
          
          checkInterval = window.setInterval(() => {
            attempts++;
            const currentCount = document.querySelectorAll('*').length;
            if (currentCount === lastCount) {
              window.clearInterval(checkInterval);
              resolve(true); // Stable
            } else {
              lastCount = currentCount;
              if (attempts > 10) { // Max wait 3 seconds
                window.clearInterval(checkInterval);
                resolve(false); // Unstable
              }
            }
          }, 300);
        });
      });
    } catch (e) {
      return false;
    }
  }
}
