import { InteractiveElement, FormMetadata } from '../shared/types';
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
  scrollX: number;
  scrollY: number;
  documentIndex?: {
    headings: number;
    paragraphs: number;
    tables: number;
    lists: number;
    codeBlocks: number;
  };
}

export interface Observation {
  observationId: string;
  timestamp: string;
  url: string;
  title: string;
  readiness: boolean;
  screenshotPath: string;
  elementInventory: InteractiveElement[];
  forms: FormMetadata[];
  accessibilityTree: A11yRecord[];
  frameInventory: FrameRecord[];
  visibleTextBlocks: string[];
  errorSignals: string[];
  metadata: PageMetadata;
  
  // V2 properties
  classification: 'SERP' | 'VIDEO_PLATFORM' | 'FORM_PAGE' | 'ARTICLE' | 'DASHBOARD' | 'AUTH_PAGE' | 'LIST_PAGE' | 'ERROR_PAGE' | 'EMPTY_PAGE' | 'OTHER';
  environment: {
    lastConsoleError: string | null;
    activeDialog: { type: string, message: string } | null;
    openTabsCount: number;
    canGoBack: boolean;
    canGoForward: boolean;
  };
}
