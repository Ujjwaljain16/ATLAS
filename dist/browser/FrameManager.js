"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FrameManager = void 0;
const uuid_1 = require("uuid");
class FrameManager {
    page = null;
    activeFrame = null;
    frameMap = new Map();
    setPage(page) {
        this.page = page;
        this.activeFrame = null;
        this.frameMap.clear();
    }
    getFrames() {
        if (!this.page)
            return [];
        const records = [];
        const frames = this.page.frames();
        const newMap = new Map();
        for (const frame of frames) {
            if (frame === this.page.mainFrame())
                continue; // Skip main frame for iframe listing
            // Find existing frameId if possible, else create new
            let frameId = null;
            for (const [id, existingFrame] of this.frameMap.entries()) {
                if (existingFrame === frame) {
                    frameId = id;
                    break;
                }
            }
            if (!frameId) {
                frameId = (0, uuid_1.v4)();
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
    async switchFrame(frameId) {
        const target = this.frameMap.get(frameId);
        if (!target) {
            throw new Error(`Frame with id ${frameId} not found`);
        }
        this.activeFrame = target;
    }
    async resetToMainFrame() {
        this.activeFrame = null;
    }
    getActiveTarget() {
        if (this.activeFrame)
            return this.activeFrame;
        return this.page;
    }
}
exports.FrameManager = FrameManager;
