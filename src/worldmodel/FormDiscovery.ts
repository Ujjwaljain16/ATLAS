import { Observation } from '../perception/types';
import { FormState } from './types';

export class FormDiscovery {
  discoverForms(obs: Observation): FormState[] {
    const forms: FormState[] = [];
    
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
        formId: 'implicit_global_form',
        metadata: {
          id: 'implicit_global_form',
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
