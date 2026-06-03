import { ElementRecord, FieldStatus } from '../shared/types';
import { FieldState } from './types';

export class FieldStatusEvaluator {
  evaluateStatus(el: ElementRecord): FieldStatus {
    if (el.hasAdjacentError) return 'ERROR';
    if (el.disabled) return 'DISABLED';
    if (!el.value || el.value.trim() === '') return 'EMPTY';
    return 'FILLED';
  }

  evaluateSubObjectives(fields: FieldState[]): 'ACHIEVED' | 'PENDING' | 'FAILED' {
    if (fields.some(f => f.status === 'ERROR')) return 'FAILED';
    if (fields.every(f => f.status === 'FILLED' || !f.required)) return 'ACHIEVED';
    return 'PENDING';
  }
}
