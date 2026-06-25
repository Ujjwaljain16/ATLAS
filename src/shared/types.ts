export interface InteractiveElement {
  id: string;          // Maps to what was elementId
  role: string | null;
  text: string;        // E.g., innerText or nearbyText
  label: string | null;
  ariaLabel: string | null;
  placeholder: string | null;
  href: string | null;
  editable: boolean;
  clickable: boolean;
  enabled: boolean;
  visible: boolean;
  boundingBox: { x: number; y: number; width: number; height: number };
  parent: string | null;
  children: string[];
  confidence?: number;
  
  // State
  checked: boolean | null;
  selected: boolean | null;
  expanded: boolean | null;
  focused: boolean;
  readonly: boolean;

  // Geometry
  inViewport: boolean;
  scrollOffset: { x: number; y: number };
  zIndex: number;

  // Context
  shadowRoot: boolean;
  parentGroup: string | null;

  // Internal tracking fields
  selector: string;
  frameContext: string | null;
  tag: string;
  type: string | null;
  elementType: string; // V2 mapping: TEXTBOX | BUTTON | LINK | VIDEO | etc.
  name: string | null;
  ariaLabelledBy: string | null;
  value: string;
  hasAdjacentError: boolean;
  required: boolean;
  ariaInvalid: string | null;
  parentFormId: string | null;
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
