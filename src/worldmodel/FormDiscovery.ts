import { Observation } from '../perception/types';
import { FormState } from './types';

export class FormDiscovery {
  discoverForms(obs: Observation): FormState[] {
    const formIds = new Set<string>();
    for (const el of obs.elementInventory) {
      if (el.parentFormId) {
        formIds.add(el.parentFormId);
      }
    }
    
    if (formIds.size === 0) {
      return [{ formId: 'implicit_global_form', fields: [] }];
    }
    
    return Array.from(formIds).map(id => ({ formId: id, fields: [] }));
  }
}
