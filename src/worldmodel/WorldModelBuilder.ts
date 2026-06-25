import { v4 as uuid } from 'uuid';
import { Observation } from '../perception/types';
import { PageState, Section } from './types';
import { PageContextAnalyzer } from './PageContextAnalyzer';
import { SemanticExtractor } from './SemanticExtractor';

export class WorldModelBuilder {
  private contextAnalyzer = new PageContextAnalyzer();
  private semanticExtractor = new SemanticExtractor();

  build(observation: Observation, navigationHistory: string[] = []): PageState {
    const pageState: PageState = {
      pageId: `state_${Date.now()}`,
      timestamp: observation.timestamp,
      url: observation.url,
      title: observation.title,
      ready: observation.readiness,
      
      sections: [], // Can be populated with heuristics later
      elements: observation.elementInventory,
      focusId: null, // Active element ID (can be extracted via DOM extraction)
      openDialogs: [], // Dialog IDs
      navigationHistory,
      
      errorSignals: observation.errorSignals,
      pageMetadata: observation.metadata,
      semanticObjects: [], // Will be populated immediately below
      
      classification: observation.classification,
      environment: observation.environment,
    };

    const context = this.contextAnalyzer.analyze(pageState);
    pageState.semanticObjects = this.semanticExtractor.extract(pageState, context);

    return pageState;
  }
}
