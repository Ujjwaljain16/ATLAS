import { InteractiveElement } from '../shared/types';

export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW' | 'INSUFFICIENT';

export interface Candidate {
  element: InteractiveElement;
  matchStrength: number;
  matchedSignal: string;
  confirmedByA11y?: boolean;
}

export interface RankedCandidate extends Candidate {
  tier: number;
  tierName: string;
  confidence: number;
  discoveryTier: number;
}

export interface Decision {
  thought: string;
  action: { name: string; params: any };
  expectedOutcome: string;
  goalStatusGuess: 'IN_PROGRESS' | 'COMPLETE' | 'FAILED';
  confidence: number;
  discoveryTier: number;
  matchedSignal: string;
  targetSelector?: string;
}
