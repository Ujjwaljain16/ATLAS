"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResilienceEngine = void 0;
const FailureClassifier_1 = require("./FailureClassifier");
class ResilienceEngine {
    classifier = new FailureClassifier_1.FailureClassifier();
    async handleInsufficient(decision) {
        // Stub: Implement recovery strategy here
        return { success: false };
    }
    async handle(error) {
        const classification = this.classifier.classify(error);
        if (classification.severity === 'FATAL') {
            throw new Error(`Fatal error: ${error.message}`);
        }
        // Recoverable errors will transition FSM to RECOVER and attempt next action.
        return { success: false };
    }
}
exports.ResilienceEngine = ResilienceEngine;
