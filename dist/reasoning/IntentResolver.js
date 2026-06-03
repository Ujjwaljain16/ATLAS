"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntentResolver = void 0;
class IntentResolver {
    resolve(subObjective) {
        return subObjective.targetFieldDescription || subObjective.label;
    }
}
exports.IntentResolver = IntentResolver;
