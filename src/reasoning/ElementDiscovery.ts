import { InteractiveElement } from '../shared/types';
import { ATLASConfig } from '../config/ATLASConfig';
import { EventBus } from '../observability/EventBus';
import { ConfidenceScorer } from './ConfidenceScorer';
import { Candidate, RankedCandidate } from './types';

interface DiscoveryTier {
  tier: number;
  name: string;
  baseConfidence: number;
  discover(elements: InteractiveElement[], target: string): Candidate[];
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
            el.label?.toLowerCase() === target.toLowerCase()
          ).map(el => ({ element: el, matchStrength: 1.0, matchedSignal: `label_text: '${el.label}'` }))
      },
      {
        tier: 3,
        name: 'Partial Label / aria-label Match',
        baseConfidence: 0.80,
        discover: (elements, target) =>
          elements.filter(el =>
            el.label?.toLowerCase().includes(target.toLowerCase()) ||
            el.ariaLabel?.toLowerCase().includes(target.toLowerCase())
          ).map(el => ({ element: el, matchStrength: 0.70, matchedSignal: `partial_label: '${el.label}'` }))
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
            el.text?.toLowerCase().includes(target.toLowerCase())
          ).map(el => ({ element: el, matchStrength: 0.50, matchedSignal: `nearby_text: '${el.text}'` }))
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
  
  discover(elements: InteractiveElement[], targetGoal: string): RankedCandidate[] {
    const quotes = targetGoal.match(/'([^']+)'|"([^"]+)"/g)?.map(q => q.replace(/['"]/g, '').toLowerCase()) || [];
    const goalLower = targetGoal.toLowerCase();
    
    // Pass 1: In-viewport only
    const viewportElements = elements.filter(el => el.inViewport && el.visible);
    const pass1Candidates = this.scoreElements(viewportElements, targetGoal, quotes, goalLower);
    
    // If we have high confidence candidates in viewport, return them
    if (pass1Candidates.length > 0 && pass1Candidates[0].confidence >= this.config.reasoning.minConfidenceThreshold) {
      return pass1Candidates;
    }
    
    // Pass 2: Fallback to off-screen elements
    const offscreenElements = elements.filter(el => !el.inViewport && el.visible);
    const pass2Candidates = this.scoreElements(offscreenElements, targetGoal, quotes, goalLower);
    
    // Combine and sort
    return [...pass1Candidates, ...pass2Candidates].sort((a, b) => b.confidence - a.confidence);
  }

  private scoreElements(elements: InteractiveElement[], targetGoal: string, quotes: string[], goalLower: string): RankedCandidate[] {
    const candidates: RankedCandidate[] = [];
    const goalTerms = goalLower.split(/\s+/).filter(w => w.length > 3);
    
    for (const el of elements) {
      let score = 0.1;
      let matchedSignal = 'visible_element';

      const elText = [el.text, el.label, el.ariaLabel, el.placeholder, el.value].filter(Boolean).join(' ').toLowerCase();
      
      if (quotes.length > 0 && quotes.some(q => elText.includes(q))) {
        score = 0.95;
        matchedSignal = 'goal_quote_match';
      } else {
        const matches = goalTerms.filter(w => elText.includes(w)).length;
        if (matches > 0) {
          // Progressive scoring: more matched terms = higher confidence
          score = 0.30 + (0.12 * matches);
          matchedSignal = `keyword_match(${matches}/${goalTerms.length} terms)`;
        }
      }

      // Element-type bonus (differentiated)
      if (el.elementType === 'TEXTBOX' || el.elementType === 'CONTENT_EDITABLE') score += 0.15;
      else if (el.elementType === 'BUTTON') score += 0.08;
      else if (el.elementType === 'LINK') score += 0.05;

      // Viewport and aria bonuses
      if (el.inViewport) score += 0.05;
      if (el.ariaLabel) score += 0.03;

      candidates.push({
        element: el,
        matchStrength: score,
        tier: 1,
        tierName: 'Semantic Ranking',
        confidence: Math.min(0.99, score),
        discoveryTier: 1,
        matchedSignal
      });
    }

    // Normalize scores so there's visible differentiation between candidates
    const sorted = candidates.sort((a, b) => b.confidence - a.confidence);
    if (sorted.length > 1 && sorted[0].confidence > 0.1) {
      for (let i = 1; i < sorted.length; i++) {
        sorted[i].confidence = Math.max(0.05, sorted[i].confidence - i * 0.03);
      }
    }
    return sorted;
  }
}
