"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ObservationAssembler = void 0;
const uuid_1 = require("uuid");
const A11yObserver_1 = require("./A11yObserver");
class ObservationAssembler {
    a11yObserver = new A11yObserver_1.A11yObserver();
    assemble(domElements, forms, a11yRecords, screenshotPath, readiness, meta) {
        const confirmedNames = this.a11yObserver.buildConfirmedNameSet(a11yRecords);
        const mergedElements = domElements.map(el => ({
            ...el,
            // +0.08 confidence bonus when DOM label is corroborated by the ARIA tree
            confirmedByA11y: confirmedNames.has((el.labelText ?? el.ariaLabel ?? '').toLowerCase().trim()),
        }));
        return {
            observationId: (0, uuid_1.v4)(),
            timestamp: new Date().toISOString(),
            url: meta.url,
            title: meta.title,
            readiness,
            screenshotPath,
            elementInventory: mergedElements,
            forms,
            accessibilityTree: a11yRecords,
            frameInventory: meta.frameInventory,
            visibleTextBlocks: meta.visibleTextBlocks,
            errorSignals: meta.errorSignals,
            metadata: meta,
        };
    }
}
exports.ObservationAssembler = ObservationAssembler;
