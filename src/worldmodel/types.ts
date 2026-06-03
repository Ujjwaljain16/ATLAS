import { FieldStatus } from '../shared/types';
import { PageMetadata } from '../perception/types';

export interface FieldState {
  fieldId: string;
  label: string | null;
  type: string;
  tag: string;
  status: FieldStatus;
  currentValue: string;
  required: boolean;
  confidence: number;
  discoveryTier: number;
  frameContext: string | null;
  ariaInvalid: boolean;
  elementId?: string;
  selector: string;
}

export interface FormState {
  formId: string;
  fields: FieldState[];
}

export interface WorldState {
  pageId: string;
  timestamp: string;
  url: string;
  title: string;
  ready: boolean;
  activeSubObjective: string;
  forms: FormState[];
  subObjectiveStatus: 'ACHIEVED' | 'PENDING' | 'FAILED';
  goalProgress: number;
  errorSignals: string[];
  pageMetadata: PageMetadata;
}
