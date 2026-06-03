import { SubObjective } from './../core/types';

export class IntentResolver {
  resolve(subObjective: SubObjective): string {
    return subObjective.targetFieldDescription || subObjective.label;
  }
}
