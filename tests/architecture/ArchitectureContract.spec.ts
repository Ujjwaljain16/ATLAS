import { describe, it, expect, vi } from 'vitest';
import { ReasoningEngine } from '../../src/reasoning/ReasoningEngine';
import { ElementDiscovery } from '../../src/reasoning/ElementDiscovery';
import { WorldModelBuilder } from '../../src/worldmodel/WorldModelBuilder';
import { ResilienceEngine } from '../../src/resilience/ResilienceEngine';
import { FailureClassifier } from '../../src/resilience/FailureClassifier';
import { EventBus } from '../../src/observability/EventBus';
import { ConfidenceScorer } from '../../src/reasoning/ConfidenceScorer';
import { ATLASConfigLoader } from '../../src/config';

describe('Architecture Compliance Contracts', () => {
  it('ReasoningEngine MUST invoke ElementDiscovery', async () => {
    const config = ATLASConfigLoader.load();
    const eventBus = new EventBus();
    const scorer = new ConfidenceScorer();
    const discovery = new ElementDiscovery(eventBus, config, scorer);
    
    const spy = vi.spyOn(discovery, 'discover').mockReturnValue([]);
    
    const engine = new ReasoningEngine(discovery);
    await engine.decide({ pageId: 'test', forms: [] } as any, {}, { id: 'test', label: 'Test', targetFieldDescription: 'Test', expectedValue: 'Test', completionCondition: { fieldLabel: '', expectedValue: '' } });
    
    expect(spy).toHaveBeenCalled();
  });

  it('WorldModel MUST contain fields hierarchy', () => {
    const builder = new WorldModelBuilder();
    const state = builder.build({ url: 'http://test', elementInventory: [
      {
        tag: 'input',
        type: 'text',
        id: 'test',
        name: 'test',
        ariaLabel: null,
        ariaLabelledBy: null,
        placeholder: null,
        value: '',
        labelText: 'Test',
        nearbyText: '',
        hasAdjacentError: false,
        visible: true,
        disabled: false,
        required: false,
        ariaInvalid: null,
        boundingBox: { x: 0, y: 0, width: 10, height: 10 },
        role: 'textbox',
        parentFormId: null,
        selector: '#test',
        elementId: '123',
        frameContext: null
      }
    ] } as any, 'Test');
    
    expect(state.forms).toBeDefined();
    expect(state.forms.length).toBeGreaterThan(0);
    expect(state.forms[0].fields).toBeDefined();
    expect(state.forms[0].fields.length).toBeGreaterThan(0);
  });

  it('ResilienceEngine MUST invoke FailureClassifier', async () => {
    const resilience = new ResilienceEngine();
    
    // We can spy on the classifier property
    const classifier = (resilience as any).classifier as FailureClassifier;
    const spy = vi.spyOn(classifier, 'classify').mockReturnValue({ severity: 'RECOVERABLE' } as any);
    
    await resilience.handle({ code: 'ERR', message: 'Test error', severity: 'RECOVERABLE', source: 'BROWSER' });
    
    expect(spy).toHaveBeenCalled();
  });
});
