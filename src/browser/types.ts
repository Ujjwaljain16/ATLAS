export interface BrowserLaunchResult {
  success: boolean;
  error?: Error;
}

export interface NavigateOptions {
  waitUntil?: 'networkidle' | 'domcontentloaded' | 'load';
  timeoutMs?: number;
}

export interface NavigateResult {
  success: boolean;
  error?: Error;
}

export interface FrameRecord {
  frameId: string;
  name: string;
  url: string;
}
