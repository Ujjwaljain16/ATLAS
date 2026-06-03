import * as fs from 'fs';
import * as path from 'path';

export interface ScreenshotEntry {
  stepId: number;
  actionId?: string;
  path: string;
  timestamp: string;
  label?: string;
}

export class ScreenshotManifest {
  private entries: ScreenshotEntry[] = [];
  
  constructor(private sessionId: string, private baseDir: string) {}

  addEntry(entry: Omit<ScreenshotEntry, 'timestamp'>) {
    this.entries.push({
      ...entry,
      timestamp: new Date().toISOString()
    });
  }

  async flush() {
    const manifestPath = path.join(this.baseDir, 'manifest.json');
    await fs.promises.writeFile(manifestPath, JSON.stringify({
      sessionId: this.sessionId,
      screenshots: this.entries
    }, null, 2));
  }
}

export class ScreenshotService {
  private baseDir: string;
  private manifest: ScreenshotManifest;

  constructor(private sessionId: string) {
    this.baseDir = path.join(process.cwd(), 'screenshots', this.sessionId);
    this.manifest = new ScreenshotManifest(this.sessionId, this.baseDir);
  }

  async initialize() {
    if (!fs.existsSync(this.baseDir)) {
      await fs.promises.mkdir(this.baseDir, { recursive: true });
    }
  }

  async saveScreenshot(buffer: Buffer, stepId: number, label: string = 'screenshot', actionId?: string): Promise<string> {
    const filename = `step-${stepId.toString().padStart(3, '0')}${label ? '_' + label : ''}.png`;
    const filePath = path.join(this.baseDir, filename);
    
    await fs.promises.writeFile(filePath, buffer);
    
    this.manifest.addEntry({
      stepId,
      actionId,
      path: filename,
      label
    });
    
    await this.manifest.flush();
    
    return filePath;
  }
}
