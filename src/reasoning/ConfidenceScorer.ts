import { Candidate, ConfidenceLevel } from './types';

export class ConfidenceScorer {
  score(candidate: Candidate, baseConfidence: number, matchStrength: number): number {
    
    let score = baseConfidence * matchStrength;
    
    // Bonus signals
    if (candidate.element.visible)                score += 0.05;
    if (!candidate.element.disabled)              score += 0.05;
    if (candidate.element.parentFormId !== null)  score += 0.05;
    if (this.isTypeCompatible(candidate))         score += 0.10;
    if (candidate.confirmedByA11y)                score += 0.08;
    
    // Penalty signals
    if (!candidate.element.visible)               score -= 0.40;
    if (candidate.element.disabled)               score -= 0.30;
    if (!this.isTypeCompatible(candidate))        score -= 0.20;
    
    return Math.max(0, Math.min(1, score));
  }
  
  classify(score: number): ConfidenceLevel {
    if (score >= 0.80) return 'HIGH';
    if (score >= 0.60) return 'MEDIUM';
    if (score >= 0.40) return 'LOW';
    return 'INSUFFICIENT';
  }

  private isTypeCompatible(candidate: Candidate): boolean {
    // Basic heuristic: check if type implies text input.
    // Real implementation would compare with the action/target type
    return ['text', 'textarea', 'email', 'password'].includes(candidate.element.type || 'text');
  }
}
