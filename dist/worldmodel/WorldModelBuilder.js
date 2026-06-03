"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorldModelBuilder = void 0;
const uuid_1 = require("uuid");
const FormDiscovery_1 = require("./FormDiscovery");
const FieldStatusEvaluator_1 = require("./FieldStatusEvaluator");
const ProgressCalculator_1 = require("./ProgressCalculator");
class WorldModelBuilder {
    formDiscovery = new FormDiscovery_1.FormDiscovery();
    statusEvaluator = new FieldStatusEvaluator_1.FieldStatusEvaluator();
    progressCalculator = new ProgressCalculator_1.ProgressCalculator();
    // REFINEMENT R1: Accepts active sub-objective as input
    build(observation, activeSubObjective) {
        const forms = this.formDiscovery.discoverForms(observation);
        const fields = [];
        for (const form of forms) {
            const formFields = this.classifyFields(form, observation);
            form.fields = formFields;
            fields.push(...formFields);
        }
        const goalProgress = this.progressCalculator.calculateProgress(fields, activeSubObjective);
        return {
            pageId: (0, uuid_1.v4)(),
            timestamp: new Date().toISOString(),
            url: observation.url,
            title: observation.title,
            ready: observation.readiness,
            activeSubObjective,
            forms,
            subObjectiveStatus: this.statusEvaluator.evaluateSubObjectives(fields),
            goalProgress,
            errorSignals: observation.errorSignals,
            pageMetadata: observation.metadata,
        };
    }
    classifyFields(form, obs) {
        // If implicit global form, we process all inputs without a parentFormId
        const targetElements = form.formId === 'implicit_global_form'
            ? obs.elementInventory.filter(el => !el.parentFormId)
            : obs.elementInventory.filter(el => el.parentFormId === form.metadata.id);
        return targetElements
            // CRITICAL: scope to THIS form ONLY — without this filter, on pages with
            // multiple forms every form receives every input from every other form,
            // producing completely wrong field topology and duplicate element IDs.
            .filter(el => ['input', 'textarea', 'select'].includes(el.tag))
            .filter(el => el.visible && !el.disabled)
            .map(el => ({
            fieldId: (0, uuid_1.v4)(),
            label: el.labelText,
            type: el.tag === 'textarea' ? 'textarea' : (el.type || 'text'),
            tag: el.tag,
            status: this.statusEvaluator.evaluateStatus(el),
            currentValue: el.value,
            required: el.required,
            confidence: 0, // Filled by Reasoning Engine
            discoveryTier: 0,
            frameContext: el.frameContext || null,
            ariaInvalid: el.ariaInvalid === 'true',
            elementId: el.elementId,
            selector: el.selector,
        }));
    }
}
exports.WorldModelBuilder = WorldModelBuilder;
