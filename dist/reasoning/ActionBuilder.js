"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ActionBuilder = void 0;
class ActionBuilder {
    build(candidate, subObjective) {
        // Determine the appropriate action based on the element and sub-objective
        if (candidate.element.tag === 'select') {
            return {
                name: 'select_option',
                params: {
                    elementId: candidate.element.elementId,
                    text: subObjective.expectedValue,
                }
            };
        }
        return {
            name: 'send_keys',
            params: {
                elementId: candidate.element.elementId,
                text: subObjective.expectedValue,
                clearFirst: true,
            }
        };
    }
}
exports.ActionBuilder = ActionBuilder;
