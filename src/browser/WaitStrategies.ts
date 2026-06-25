import { Page } from 'playwright';

export type WaitConditionType = 'NETWORK_IDLE' | 'DOM_STABLE' | 'ELEMENT_VISIBLE' | 'ELEMENT_HIDDEN' | 'URL_CONTAINS' | 'TEXT_APPEARS';

export interface WaitCondition {
  type: WaitConditionType;
  value?: string;
  timeoutMs?: number;
}

export class WaitStrategies {
  static async waitFor(page: Page, condition: WaitCondition): Promise<boolean> {
    const timeout = condition.timeoutMs || 5000;
    
    try {
      switch (condition.type) {
        case 'NETWORK_IDLE':
          await page.waitForLoadState('networkidle', { timeout });
          return true;
          
        case 'DOM_STABLE':
          // Wait for DOM to stop mutating
          await page.evaluate((timeoutMs) => {
            return new Promise((resolve) => {
              let timer: NodeJS.Timeout;
              const observer = new MutationObserver(() => {
                clearTimeout(timer);
                timer = setTimeout(() => {
                  observer.disconnect();
                  resolve(true);
                }, 300); // 300ms of no mutations = stable
              });
              
              observer.observe(document.body, { childList: true, subtree: true, attributes: true });
              
              // Fallback
              timer = setTimeout(() => {
                observer.disconnect();
                resolve(true);
              }, timeoutMs);
            });
          }, timeout);
          return true;
          
        case 'ELEMENT_VISIBLE':
          if (!condition.value) throw new Error("Missing selector for ELEMENT_VISIBLE");
          await page.waitForSelector(condition.value, { state: 'visible', timeout });
          return true;
          
        case 'ELEMENT_HIDDEN':
          if (!condition.value) throw new Error("Missing selector for ELEMENT_HIDDEN");
          await page.waitForSelector(condition.value, { state: 'hidden', timeout });
          return true;
          
        case 'URL_CONTAINS':
          if (!condition.value) throw new Error("Missing url pattern for URL_CONTAINS");
          await page.waitForURL(`**/*${condition.value}*`, { timeout });
          return true;
          
        case 'TEXT_APPEARS':
          if (!condition.value) throw new Error("Missing text for TEXT_APPEARS");
          await page.waitForFunction((text) => document.body.innerText.includes(text), condition.value, { timeout });
          return true;
          
        default:
          throw new Error(`Unknown wait condition: ${condition.type}`);
      }
    } catch (err) {
      // Timeout hit
      return false;
    }
  }
}
