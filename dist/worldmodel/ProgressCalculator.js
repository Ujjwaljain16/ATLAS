"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProgressCalculator = void 0;
class ProgressCalculator {
    calculateProgress(fields, activeSubObjective) {
        if (fields.length === 0)
            return 0;
        // In the future, this can be weighted by activeSubObjective. 
        // For now, it calculates the raw percentage of filled fields.
        const filled = fields.filter(f => f.status === 'FILLED').length;
        return filled / fields.length;
    }
}
exports.ProgressCalculator = ProgressCalculator;
