import { v4 as uuid } from 'uuid';
import { InteractiveElement, FormMetadata } from '../shared/types';
import { A11yRecord, Observation, PageMetadata } from './types';
import { A11yObserver } from './A11yObserver';

export class ObservationAssembler {
  private a11yObserver = new A11yObserver();

  assemble(
    domElements:  InteractiveElement[],
    forms:        FormMetadata[],
    a11yRecords:  A11yRecord[],
    screenshotPath: string,
    readiness:    boolean,
    meta:         PageMetadata,
    classification: 'SERP' | 'VIDEO_PLATFORM' | 'FORM_PAGE' | 'ARTICLE' | 'DASHBOARD' | 'AUTH_PAGE' | 'LIST_PAGE' | 'ERROR_PAGE' | 'EMPTY_PAGE' | 'OTHER',
    environment: {
      lastConsoleError: string | null;
      activeDialog: { type: string, message: string } | null;
      openTabsCount: number;
      canGoBack: boolean;
      canGoForward: boolean;
    }
  ): Observation {
    const confirmedNames = this.a11yObserver.buildConfirmedNameSet(a11yRecords);
    
    const mergedElements = domElements.map(el => ({
      ...el,
      // +0.08 confidence bonus when DOM label is corroborated by the ARIA tree
      confirmedByA11y: confirmedNames.has(
        (el.label ?? el.ariaLabel ?? '').toLowerCase().trim()
      ),
    }));
    
    return {
      observationId:    uuid(),
      timestamp:        new Date().toISOString(),
      url:              meta.url,
      title:            meta.title,
      readiness,
      screenshotPath,
      elementInventory: mergedElements,
      forms,
      accessibilityTree: a11yRecords,
      frameInventory:   meta.frameInventory,
      visibleTextBlocks: meta.visibleTextBlocks,
      errorSignals:     meta.errorSignals,
      metadata:         meta,
      classification,
      environment
    };
  }
}
