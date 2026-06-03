import { FieldState } from './types';

export class ProgressCalculator {
  calculateProgress(fields: FieldState[], activeSubObjective: string): number {
    if (fields.length === 0) return 0;
    
    // In the future, this can be weighted by activeSubObjective. 
    // For now, it calculates the raw percentage of filled fields.
    const filled = fields.filter(f => f.status === 'FILLED').length;
    return filled / fields.length;
  }
}
