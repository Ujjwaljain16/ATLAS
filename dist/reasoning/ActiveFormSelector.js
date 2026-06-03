"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ActiveFormSelector = void 0;
class ActiveFormSelector {
    rankForms(forms, activeSubObjective, goalLabel) {
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
        const goalStr = (goalLabel || '').toLowerCase();
        const subObjStr = activeSubObjective.label.toLowerCase();
        const candidates = forms.map(form => {
            let score = 0;
            let reason = 'No Relevant Matches';
            const meta = form.metadata;
            const formText = [meta.id, meta.heading, meta.legend, meta.ariaLabel].filter(Boolean).join(' ').toLowerCase();
            // 1. Check if the overall goal matches the form's metadata (e.g. "Profile" in "Fill my profile form")
            let goalMatchCount = 0;
            if (goalStr) {
                const goalWords = goalStr.split(' ').filter((w) => w.length > 3); // ignore small words
                for (const w of goalWords) {
                    if (formText.includes(w)) {
                        goalMatchCount++;
                    }
                }
            }
            if (goalMatchCount > 0) {
                score += Math.min(0.80, goalMatchCount * 0.40);
                reason = `Goal Semantic Match (${goalMatchCount} words)`;
            }
            // 2. Check if the sub-objective matches the form's metadata (e.g. "Payment" sub-objective for a Payment form)
            if (formText.includes(subObjStr)) {
                score += 0.50;
                reason = reason === 'No Relevant Matches' ? 'SubObjective Context Match' : reason + ' + SubObjective Match';
            }
            // 3. Fallback / Boost: Semantic Field Label Overlap (does this form have fields that match the sub-objective?)
            let fieldMatchCount = 0;
            const keywords = subObjStr.split(' ');
            for (const field of form.fields) {
                if (field.label) {
                    const lbl = field.label.toLowerCase();
                    if (keywords.some((k) => lbl.includes(k))) {
                        fieldMatchCount++;
                    }
                }
            }
            if (fieldMatchCount > 0) {
                score += Math.min(0.40, fieldMatchCount * 0.20);
                reason = score > fieldMatchCount * 0.20 ? reason + ` + Field Overlap` : `Field Label Overlap (${fieldMatchCount} matches)`;
            }
            return { formId: form.formId, score, reason, formState: form };
        });
        return candidates.sort((a, b) => b.score - a.score);
    }
}
exports.ActiveFormSelector = ActiveFormSelector;
