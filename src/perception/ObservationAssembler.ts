import { v4 as uuid } from 'uuid';
import { ElementRecord, FormMetadata } from '../shared/types';
import { A11yRecord, Observation, PageMetadata } from './types';
import { A11yObserver } from './A11yObserver';

export class ObservationAssembler {
  private a11yObserver = new A11yObserver();

  assemble(
    domElements:  ElementRecord[],
    forms:        FormMetadata[],
    a11yRecords:  A11yRecord[],
    screenshotPath: string,
    readiness:    boolean,
    meta:         PageMetadata,
  ): Observation {
    const confirmedNames = this.a11yObserver.buildConfirmedNameSet(a11yRecords);
    
    const mergedElements = domElements.map(el => ({
      ...el,
      // +0.08 confidence bonus when DOM label is corroborated by the ARIA tree
      confirmedByA11y: confirmedNames.has(
        (el.labelText ?? el.ariaLabel ?? '').toLowerCase().trim()
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
    };
  }
}
