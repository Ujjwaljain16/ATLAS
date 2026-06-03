"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FormDiscovery = void 0;
class FormDiscovery {
    discoverForms(obs) {
        const forms = [];
        // Explicit forms extracted via DOMObserver
        for (const rawForm of obs.forms) {
            forms.push({
                formId: rawForm.id || `form_${rawForm.selector}`,
                metadata: rawForm,
                fields: []
            });
        }
        // Check if there are orphaned fields (fields with no parentFormId or a parentFormId that doesn't match extracted forms)
        const knownFormIds = new Set(obs.forms.map(f => f.id).filter(Boolean));
        const hasOrphans = obs.elementInventory.some(el => !el.parentFormId || !knownFormIds.has(el.parentFormId));
        if (hasOrphans || forms.length === 0) {
            forms.push({
                formId: 'implicit_global_context',
                metadata: {
                    id: 'implicit_global_context',
                    name: null,
                    ariaLabel: null,
                    title: null,
                    heading: null,
                    legend: null,
                    selector: 'body'
                },
                fields: []
            });
        }
        return forms;
    }
}
exports.FormDiscovery = FormDiscovery;
