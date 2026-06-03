import { describe, it, expect, vi } from 'vitest';
import { BrowserController } from '../src/browser/BrowserController';

describe('BrowserController', () => {
  it('should sanitize screenshot labels securely', async () => {
    const browser = new BrowserController();
    
    // Hack: mock the page to bypass the throw
    (browser as any).page = {
      screenshot: vi.fn().mockResolvedValue(Buffer.from(''))
    };

    const path = await browser.screenshot('../../../etc/passwd', false);
    
    // Ensure path.join resulted in a safe filename like "____etc_passwd.png"
    expect(path).toContain('___etc_passwd.png');
    expect(path).not.toContain('../');
  });

  it('should block navigation to invalid domains when strict check is enabled', async () => {
    const browser = new BrowserController();
    (browser as any).page = {}; // mock

    const result = await browser.navigate('http://evil.com', {
      allowedDomains: ['ui.shadcn.com'],
      strictDomainCheck: true
    });

    expect(result.success).toBe(false);
    expect(result.error?.message).toContain('Navigation blocked');
  });
  
  it('should allow navigation and warn when strict check is disabled', async () => {
    const browser = new BrowserController();
    (browser as any).page = {
      goto: vi.fn().mockResolvedValue(null)
    };
    (browser as any).readinessDetector = {
      waitForReady: vi.fn().mockResolvedValue(null)
    };

    const result = await browser.navigate('http://evil.com', {
      allowedDomains: ['ui.shadcn.com'],
      strictDomainCheck: false
    });

    expect(result.success).toBe(true);
  });
});
