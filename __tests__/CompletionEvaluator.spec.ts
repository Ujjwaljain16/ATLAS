import { describe, it, expect } from 'vitest';
import { ReasoningEngine } from '../src/reasoning/ReasoningEngine';
import { ElementDiscovery } from '../src/reasoning/ElementDiscovery';
import { EventBus } from '../src/observability/EventBus';
import { ATLASConfigLoader } from '../src/config';
import { ConfidenceScorer } from '../src/reasoning/ConfidenceScorer';

describe('CompletionEvaluator', () => {
  it('should evaluate completion successfully when element value matches', () => {
    const config = ATLASConfigLoader.load();
    const eventBus = new EventBus();
    const scorer = new ConfidenceScorer();
    const discovery = new ElementDiscovery(eventBus, config, scorer);
    const engine = new ReasoningEngine(discovery);

    const worldStateBefore = { forms: [] };
    const worldStateAfter = {
      forms: [
        {
          fields: [
            {
              selector: '#username',
              currentValue: 'John Doe',
              label: 'Username'
            }
          ]
        }
      ]
    };

    const subObjective = {
      label: 'Fill Name field',
      expectedValue: 'John Doe'
    };

    // Passing targetSelector #username
    const result = engine.evaluateCompletion(
      worldStateBefore as any, 
      worldStateAfter as any, 
      subObjective, 
      '#username'
    );
    
    expect(result).toBe('COMPLETE');
  });

  it('should evaluate as PENDING when field value does not match', () => {
    const config = ATLASConfigLoader.load();
    const engine = new ReasoningEngine(new ElementDiscovery(new EventBus(), config, new ConfidenceScorer()));

    const worldStateAfter = {
      forms: [
        {
          fields: [
            {
              selector: '#username',
              currentValue: 'Wrong',
              label: 'Username'
            }
          ]
        }
      ]
    };

    const result = engine.evaluateCompletion(
      { forms: [] } as any, 
      worldStateAfter as any, 
      { expectedValue: 'John Doe' }, 
      '#username'
    );
    
    expect(result).toBe('PENDING');
  });
});
