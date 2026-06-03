import { ElementRecord } from '../shared/types';
import { ATLASConfig } from '../config/ATLASConfig';
import { EventBus } from '../observability/EventBus';
import { ConfidenceScorer } from './ConfidenceScorer';
import { Candidate, RankedCandidate } from './types';

interface DiscoveryTier {
  tier: number;
  name: string;
  baseConfidence: number;
  discover(elements: ElementRecord[], target: string): Candidate[];
}

export class ElementDiscovery {
  private tiers: DiscoveryTier[];
  
  constructor(
    private readonly eventBus: EventBus,
    private readonly config: ATLASConfig,
    private readonly confidenceScorer: ConfidenceScorer,
  ) {
    this.tiers = [
      {
        tier: 1,
        name: 'Exact ARIA Label Match',
        baseConfidence: 0.95,
        discover: (elements, target) =>
          elements.filter(el =>
            el.ariaLabel?.toLowerCase() === target.toLowerCase()
          ).map(el => ({ element: el, matchStrength: 1.0, matchedSignal: `aria-label: '${el.ariaLabel}'` }))
      },
      {
        tier: 2,
        name: 'Exact Associated Label Text Match',
        baseConfidence: 0.90,
        discover: (elements, target) =>
          elements.filter(el =>
            el.labelText?.toLowerCase() === target.toLowerCase()
          ).map(el => ({ element: el, matchStrength: 1.0, matchedSignal: `label_text: '${el.labelText}'` }))
      },
      {
        tier: 3,
        name: 'Partial Label / aria-label Match',
        baseConfidence: 0.80,
        discover: (elements, target) =>
          elements.filter(el =>
            el.labelText?.toLowerCase().includes(target.toLowerCase()) ||
            el.ariaLabel?.toLowerCase().includes(target.toLowerCase())
          ).map(el => ({ element: el, matchStrength: 0.70, matchedSignal: `partial_label: '${el.labelText}'` }))
      },
      {
        tier: 4,
        name: 'Placeholder Text Match',
        baseConfidence: 0.75,
        discover: (elements, target) =>
          elements.filter(el =>
            el.placeholder?.toLowerCase().includes(target.toLowerCase())
          ).map(el => ({ element: el, matchStrength: 0.70, matchedSignal: `placeholder: '${el.placeholder}'` }))
      },
      {
        tier: 5,
        name: 'name / id Attribute Match',
        baseConfidence: 0.70,
        discover: (elements, target) =>
          elements.filter(el =>
            el.name?.toLowerCase().includes(target.toLowerCase()) ||
            el.id?.toLowerCase().includes(target.toLowerCase())
          ).map(el => ({ element: el, matchStrength: 0.70, matchedSignal: `name_attr: '${el.name}'` }))
      },
      {
        tier: 6,
        name: 'Nearby Visible Text Heuristic',
        baseConfidence: 0.60,
        discover: (elements, target) =>
          elements.filter(el =>
            el.nearbyText?.toLowerCase().includes(target.toLowerCase())
          ).map(el => ({ element: el, matchStrength: 0.50, matchedSignal: `nearby_text: '${el.nearbyText}'` }))
      },
      {
        tier: 7,
        name: 'Role + Type Semantic Heuristic',
        baseConfidence: 0.50,
        discover: (elements, target) => {
          const isDescriptionTarget = target.toLowerCase().includes('desc');
          return elements
            .filter(el => isDescriptionTarget ? el.tag === 'textarea' : el.type === 'text')
            .slice(0, 1)
            .map(el => ({ element: el, matchStrength: 0.50, matchedSignal: `role_heuristic: ${el.tag}[${el.type}]` }));
        }
      },
      {
        tier: 8,
        name: 'DOM Position Heuristic',
        baseConfidence: 0.40,
        discover: (elements, _target) => {
          return elements
            .filter(el => !el.value)
            .slice(0, 1)
            .map(el => ({ element: el, matchStrength: 0.40, matchedSignal: `dom_position: first_empty_input` }));
        }
      },
      {
        tier: 9,
        name: 'Visual Coordinate Fallback',
        baseConfidence: 0.30,
        discover: (_elements, target) => {
          this.eventBus.emit({ type: 'CoordinateFallbackTriggered', target });
          return [];
        }
      },
    ];
  }
  
  discover(elements: ElementRecord[], target: string): RankedCandidate[] {
    const allCandidates: RankedCandidate[] = [];
    
    for (const tier of this.tiers) {
      if (tier.tier === 9 && !this.config.reasoning.enableCoordinateFallback) continue;
      
      const candidates = tier.discover(elements, target);
      
      for (const candidate of candidates) {
        const confidence = this.confidenceScorer.score(
          candidate,
          tier.baseConfidence,
          candidate.matchStrength
        );
        
        allCandidates.push({
          ...candidate,
          tier: tier.tier,
          tierName: tier.name,
          confidence,
          discoveryTier: tier.tier,
          matchedSignal: candidate.matchedSignal,
        });
      }
    }
    
    return this.deduplicateAndRank(allCandidates);
  }

  private deduplicateAndRank(candidates: RankedCandidate[]): RankedCandidate[] {
    const map = new Map<string, RankedCandidate>();
    for (const c of candidates) {
      if (!c.element.elementId) continue;
      const existing = map.get(c.element.elementId);
      if (!existing || c.confidence > existing.confidence) {
        map.set(c.element.elementId, c);
      }
    }
    return Array.from(map.values()).sort((a, b) => b.confidence - a.confidence);
  }
}
