"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FieldStatusEvaluator = void 0;
class FieldStatusEvaluator {
    evaluateStatus(el) {
        if (el.hasAdjacentError)
            return 'ERROR';
        if (el.disabled)
            return 'DISABLED';
        if (!el.value || el.value.trim() === '')
            return 'EMPTY';
        return 'FILLED';
    }
    evaluateSubObjectives(fields) {
        if (fields.some(f => f.status === 'ERROR'))
            return 'FAILED';
        if (fields.every(f => f.status === 'FILLED' || !f.required))
            return 'ACHIEVED';
        return 'PENDING';
    }
}
exports.FieldStatusEvaluator = FieldStatusEvaluator;
