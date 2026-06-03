export interface RawElementRecord {
  tag: string;
  type: string | null;
  id: string | null;
  name: string | null;
  ariaLabel: string | null;
  ariaLabelledBy: string | null;
  placeholder: string | null;
  value: string;
  labelText: string | null;
  nearbyText: string;
  hasAdjacentError: boolean;
  visible: boolean;
  disabled: boolean;
  required: boolean;
  ariaInvalid: string | null;
  boundingBox: { x: number; y: number; width: number; height: number };
  role: string | null;
  parentFormId: string | null;
  selector: string;
}

export interface ElementRecord extends RawElementRecord {
  elementId: string;
  frameContext: string | null;
  confirmedByA11y?: boolean;
}

export interface FormMetadata {
  id: string | null;
  name: string | null;
  ariaLabel: string | null;
  title: string | null;
  heading: string | null;
  legend: string | null;
  selector: string;
}

export type FieldStatus = 'ERROR' | 'DISABLED' | 'EMPTY' | 'FILLED' | 'MISSING' | 'UNKNOWN';
