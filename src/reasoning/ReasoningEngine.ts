import { WorldState } from '../worldmodel/types';
import { SubObjective } from '../core/types';
import { ElementDiscovery } from './ElementDiscovery';
import { IntentResolver } from './IntentResolver';
import { ActionBuilder } from './ActionBuilder';

export class ReasoningEngine {
  private intentResolver = new IntentResolver();
  private actionBuilder = new ActionBuilder();

  constructor(private elementDiscovery: ElementDiscovery) {}

  async decide(worldState: WorldState, memory: any, activeSubObjective: SubObjective) {
    // 1. Resolve Intent
    const targetLabel = this.intentResolver.resolve(activeSubObjective);

    // 2. Element Discovery
    // Flat map all fields from world model forms to element records for discovery
    // Wait, ElementDiscovery expects ElementRecords, but worldState has FieldState.
    // We can map FieldState to a pseudo-ElementRecord, or change ElementDiscovery to use FieldState.
    // Since ElementDiscovery takes elements, we should pass the raw elements from memory or WorldModel.
    // Let's map FieldState back:
    const fields = worldState.forms.flatMap(f => f.fields);
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
      parentFormId: null,
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
        matchedSignal: 'none'
      };
    }

    const topCandidate = candidates[0];

    // 3. Build Action
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
      alternatives
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

