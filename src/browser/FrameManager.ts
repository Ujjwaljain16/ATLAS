import { Page, Frame } from 'playwright';
import { FrameRecord } from './types';
import { v4 as uuid } from 'uuid';

export class FrameManager {
  private page: Page | null = null;
  private activeFrame: Frame | null = null;
  private frameMap: Map<string, Frame> = new Map();

  setPage(page: Page) {
    this.page = page;
    this.activeFrame = null;
    this.frameMap.clear();
  }

  getFrames(): FrameRecord[] {
    if (!this.page) return [];
    
    const records: FrameRecord[] = [];
    const frames = this.page.frames();
    const newMap = new Map<string, Frame>();
    
    for (const frame of frames) {
      if (frame === this.page.mainFrame()) continue; // Skip main frame for iframe listing
      
      // Find existing frameId if possible, else create new
      let frameId = null;
      for (const [id, existingFrame] of this.frameMap.entries()) {
        if (existingFrame === frame) {
          frameId = id;
          break;
        }
      }
      if (!frameId) {
        frameId = uuid();
      }
      
      newMap.set(frameId, frame);
      
      records.push({
        frameId,
        name: frame.name() || frame.url(),
        url: frame.url()
      });
    }
    
    this.frameMap = newMap;
    return records;
  }

  async switchFrame(frameId: string): Promise<void> {
    const target = this.frameMap.get(frameId);
    if (!target) {
      throw new Error(`Frame with id ${frameId} not found`);
    }
    this.activeFrame = target;
  }

  async resetToMainFrame(): Promise<void> {
    this.activeFrame = null;
  }

  getActiveTarget(): Frame | Page | null {
    if (this.activeFrame) return this.activeFrame;
    return this.page;
  }
}
