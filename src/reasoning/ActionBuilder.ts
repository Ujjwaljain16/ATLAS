import { SubObjective } from './../core/types';
import { RankedCandidate } from './types';

export class ActionBuilder {
  build(candidate: RankedCandidate, subObjective: SubObjective) {
    // Determine the appropriate action based on the element and sub-objective
    if (candidate.element.tag === 'select') {
      return {
        name: 'select_option',
        params: {
          elementId: candidate.element.elementId,
          text: subObjective.expectedValue,
        }
      };
    }

    return {
      name: 'send_keys',
      params: {
        elementId: candidate.element.elementId,
        text: subObjective.expectedValue,
        clearFirst: true,
      }
    };
  }
}
