import { ElementRecord, FormMetadata } from '../shared/types';
import { FrameRecord } from '../browser/types';

export interface A11yRecord {
  role: string;
  name: string;
  value: string;
  disabled: boolean;
}

export interface PageMetadata {
  url: string;
  title: string;
  frameInventory: FrameRecord[];
  visibleTextBlocks: string[];
  errorSignals: string[];
}

export interface Observation {
  observationId: string;
  timestamp: string;
  url: string;
  title: string;
  readiness: boolean;
  screenshotPath: string;
  elementInventory: ElementRecord[];
  forms: FormMetadata[];
  accessibilityTree: A11yRecord[];
  frameInventory: FrameRecord[];
  visibleTextBlocks: string[];
  errorSignals: string[];
  metadata: PageMetadata;
}
