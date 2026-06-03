"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RetryManager = void 0;
class RetryManager {
    calculateBackoff(attempt, config) {
        const backoff = config.backoffBaseMs * Math.pow(config.backoffMultiplier, attempt);
        return Math.min(backoff, config.maxBackoffMs);
    }
}
exports.RetryManager = RetryManager;
