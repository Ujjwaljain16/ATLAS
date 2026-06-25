import { InteractiveElement } from '../shared/types';
import { PageMetadata } from '../perception/types';

export interface Section {
  id: string;
  name: string;
  type: 'header' | 'main' | 'footer' | 'sidebar' | 'dialog' | 'form' | 'unknown';
  boundingBox: { x: number; y: number; width: number; height: number };
}

export interface PageState {
  pageId: string;
  timestamp: string;
  url: string;
  title: string;
  ready: boolean;
  
  sections: Section[];
  elements: InteractiveElement[];
  focusId: string | null;
  openDialogs: string[];
  navigationHistory: string[];
  errorSignals: string[];
  pageMetadata: PageMetadata;
  semanticObjects: any[];
  
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
