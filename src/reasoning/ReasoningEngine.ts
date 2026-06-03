import { WorldState } from '../worldmodel/types';
import { SubObjective } from '../core/types';
import { ElementDiscovery } from './ElementDiscovery';
import { IntentResolver } from './IntentResolver';
import { ActionBuilder } from './ActionBuilder';
import { ActiveFormSelector } from './ActiveFormSelector';

export class ReasoningEngine {
  private intentResolver = new IntentResolver();
  private actionBuilder = new ActionBuilder();
  private formSelector = new ActiveFormSelector();

  constructor(private elementDiscovery: ElementDiscovery) {}

  async decide(worldState: WorldState, memory: any, activeSubObjective: SubObjective, goalLabel?: string) {
    // 1. Resolve Intent
    const targetLabel = this.intentResolver.resolve(activeSubObjective);

    // 2. Active Form Selection
    const formCandidates = this.formSelector.rankForms(worldState.forms, activeSubObjective, goalLabel);
    const activeForm = formCandidates.length > 0 ? formCandidates[0].formState : null;
    
    // 3. Element Discovery
    // Only use fields from the active form (prevents cross-form bleed)
    const fields = activeForm ? activeForm.fields : [];
    
    const mockElements = fields.map(f => ({
      elementId: f.elementId!,
      tag: f.tag,
      type: f.type,
      id: f.fieldId,
      name: null,
      ariaLabel: null,
      ariaLabelledBy: null,
      placeholder: null,
      value: f.currentValue,
      labelText: f.label,
      nearbyText: '',
      hasAdjacentError: false,
      visible: true,
      disabled: false,
      required: f.required,
      ariaInvalid: null,
      boundingBox: { x: 0, y: 0, width: 0, height: 0 },
      role: 'textbox',
      parentFormId: activeForm ? activeForm.formId : null,
      selector: f.selector,
      frameContext: f.frameContext,
    }));

    const candidates = this.elementDiscovery.discover(mockElements, targetLabel);
    
    if (candidates.length === 0) {
      return {
        thought: `No candidates found for ${targetLabel}`,
        action: { name: 'none', params: {} },
        confidence: 0,
        discoveryTier: 9,
        matchedSignal: 'none',
        formCandidates
      };
    }

    const topCandidate = candidates[0];

    // 4. Build Action
    const action = this.actionBuilder.build(topCandidate, activeSubObjective);

    const alternatives = candidates.slice(0, 3).map(c => ({
      elementId: c.element.elementId,
      label: c.element.labelText || c.element.id || c.element.name || 'Unknown Element',
      confidence: c.confidence
    }));

    return {
      thought: `Discovered element ${topCandidate.element.elementId} with ${topCandidate.confidence} confidence using ${topCandidate.tierName}`,
      action,
      confidence: topCandidate.confidence,
      discoveryTier: topCandidate.discoveryTier,
      matchedSignal: topCandidate.matchedSignal,
      targetSelector: topCandidate.element.selector,
      targetLabel: topCandidate.element.labelText || topCandidate.element.id || topCandidate.element.name || 'Unknown Element',
      alternatives,
      formCandidates
    };
  }

  evaluateCompletion(before: WorldState, after: WorldState, obj: SubObjective, targetSelector?: string): 'COMPLETE' | 'FAILED' | 'PENDING' {
    if (!targetSelector) return 'PENDING';

    const fieldsAfter = after.forms.flatMap(f => f.fields);
    const targetField = fieldsAfter.find(f => f.selector === targetSelector);
    
    if (!targetField) return 'PENDING';

    const expectedValue = obj.expectedValue;
    if (expectedValue !== undefined) {
      if (targetField.currentValue === expectedValue) return 'COMPLETE';
    } else {
      if (targetField.currentValue) return 'COMPLETE';
    }

    return 'PENDING';
  }
}

