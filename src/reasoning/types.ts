import { ElementRecord } from '../shared/types';

export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW' | 'INSUFFICIENT';

export interface Candidate {
  element: ElementRecord;
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
  confidence: number;
  discoveryTier: number;
  matchedSignal: string;
  targetSelector?: string;
}
