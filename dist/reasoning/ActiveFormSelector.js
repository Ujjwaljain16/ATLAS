"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ActiveFormSelector = void 0;
class ActiveFormSelector {
    rankForms(forms, activeSubObjective) {
        if (!forms || forms.length === 0)
            return [];
        // If there's only one form (or just the implicit global form), no ranking needed.
        if (forms.length === 1) {
            return [{
                    formId: forms[0].formId,
                    score: 1.0,
                    reason: 'Only available form',
                    formState: forms[0]
                }];
        }
        const goalStr = activeSubObjective.targetFieldDescription.toLowerCase() + " " + activeSubObjective.label.toLowerCase();
        const candidates = forms.map(form => {
            let score = 0;
            let reason = 'No Relevant Matches';
            const meta = form.metadata;
            const checkExactMatch = (val) => val && val.toLowerCase() === goalStr;
            const checkPartialMatch = (val) => val && val.toLowerCase().includes(goalStr);
            if (checkExactMatch(meta.id)) {
                score += 1.0;
                reason = 'Exact ID Match';
            }
            else if (checkExactMatch(meta.legend)) {
                score += 0.95;
                reason = 'Exact Legend Match';
            }
            else if (checkExactMatch(meta.heading)) {
                score += 0.95;
                reason = 'Exact Heading Match';
            }
            else if (checkExactMatch(meta.ariaLabel)) {
                score += 0.90;
                reason = 'Exact Aria Label Match';
            }
            else if (checkPartialMatch(meta.heading)) {
                score += 0.75;
                reason = 'Partial Heading Match';
            }
            else if (checkPartialMatch(meta.legend)) {
                score += 0.75;
                reason = 'Partial Legend Match';
            }
            else if (checkPartialMatch(meta.ariaLabel)) {
                score += 0.70;
                reason = 'Partial Aria Label Match';
            }
            // Fallback: Semantic Field Label Overlap
            if (score === 0) {
                let fieldMatchCount = 0;
                const keywords = goalStr.split(' ');
                for (const field of form.fields) {
                    if (field.label) {
                        const lbl = field.label.toLowerCase();
                        if (keywords.some((k) => lbl.includes(k))) {
                            fieldMatchCount++;
                        }
                    }
                }
                if (fieldMatchCount > 0) {
                    score += Math.min(0.60, fieldMatchCount * 0.15);
                    reason = `Field Label Overlap (${fieldMatchCount} matches)`;
                }
            }
            return { formId: form.formId, score, reason, formState: form };
        });
        return candidates.sort((a, b) => b.score - a.score);
    }
}
exports.ActiveFormSelector = ActiveFormSelector;
