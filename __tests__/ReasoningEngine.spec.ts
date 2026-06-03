import { describe, it, expect } from 'vitest';
import { ReasoningEngine } from '../src/reasoning/ReasoningEngine';
import { ElementDiscovery } from '../src/reasoning/ElementDiscovery';
import { EventBus } from '../src/observability/EventBus';
import { ATLASConfigLoader } from '../src/config';
import { ConfidenceScorer } from '../src/reasoning/ConfidenceScorer';

describe('ReasoningEngine', () => {
  it('should resolve intent and build action based on discovery', async () => {
    const config = ATLASConfigLoader.load();
    const eventBus = new EventBus();
    const scorer = new ConfidenceScorer();
    const discovery = new ElementDiscovery(eventBus, config, scorer);
    const engine = new ReasoningEngine(discovery);

    const worldState = {
      pageId: 'test',
      forms: [
        {
          formId: 'form-1',
          fields: [
            {
              fieldId: 'field-1',
              selector: '#name-input',
              elementId: 'elem-1',
              label: 'Your Name',
              type: 'text',
              currentValue: '',
              required: true,
              visible: true,
              frameContext: null
            }
          ]
        }
      ]
    };

    const subObjective = {
      id: 'obj-1',
      label: 'Fill Name field',
      targetFieldDescription: 'Name',
      expectedValue: 'Alice',
      completionCondition: { fieldLabel: 'Name', expectedValue: 'Alice' }
    };

    const decision = await engine.decide(worldState as any, {}, subObjective);
    
    expect(decision.action.name).toBe('send_keys');
    expect((decision.action.params as any).text).toBe('Alice');
    expect(decision.targetSelector).toBe('#name-input');
    // Tier 3 match because 'Your Name' includes 'Name'
    expect(decision.discoveryTier).toBe(3);
  });
});
