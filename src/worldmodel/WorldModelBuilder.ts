import { v4 as uuid } from 'uuid';
import { Observation } from '../perception/types';
import { WorldState, FormState, FieldState } from './types';
import { FormDiscovery } from './FormDiscovery';
import { FieldStatusEvaluator } from './FieldStatusEvaluator';
import { ProgressCalculator } from './ProgressCalculator';

export class WorldModelBuilder {
  private formDiscovery = new FormDiscovery();
  private statusEvaluator = new FieldStatusEvaluator();
  private progressCalculator = new ProgressCalculator();

  // REFINEMENT R1: Accepts active sub-objective as input
  build(observation: Observation, activeSubObjective: string): WorldState {
    const forms = this.formDiscovery.discoverForms(observation);
    const fields: FieldState[] = [];
    
    for (const form of forms) {
      const formFields = this.classifyFields(form, observation);
      form.fields = formFields;
      fields.push(...formFields);
    }
    
    const goalProgress = this.progressCalculator.calculateProgress(fields, activeSubObjective);
    
    return {
      pageId: uuid(),
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

  private classifyFields(form: FormState, obs: Observation): FieldState[] {
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
        fieldId: uuid(),
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
