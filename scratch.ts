import { BrowserController } from './src/browser/BrowserController';
async function test() {
  const browser = new BrowserController();
  console.log("launching...");
  await browser.launch({ headless: true, viewport: {width: 1280, height: 720}, launchTimeoutMs: 30000 });
  console.log("navigating...");
  const navStart = Date.now();
  await browser.navigate('https://ui.shadcn.com/docs/forms/react-hook-form', { waitUntil: 'networkidle', timeoutMs: 30000 });
  console.log("navigated in " + (Date.now() - navStart) + " ms");
  console.log("closing...");
  const start = Date.now();
  await browser.forceClose();
  const end = Date.now();
  console.log("forceClose took " + (end - start) + " ms");
}
test();
