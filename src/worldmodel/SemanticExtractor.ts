import { PageState } from './types';
import { PageContext } from './PageContextAnalyzer';

export interface SemanticObject {
  id: string;
  type: string;
  description: string;
  children: string[];
}

export class SemanticExtractor {
  extract(pageState: PageState, context: PageContext): SemanticObject[] {
    const objects: SemanticObject[] = [];
    
    // Domain specific extractors
    if (context.domain.includes('github.com')) {
      objects.push({
        id: 'repo_header',
        type: 'RepositoryHeader',
        description: 'Repository navigation and actions',
        children: []
      });
      
      const readmeEl = pageState.elements.find(e => e.text?.toLowerCase().includes('readme.md'));
      if (readmeEl || context.pageType === 'GitHub Repository') {
        objects.push({
          id: 'readme',
          type: 'README',
          description: 'Project README document',
          children: []
        });
      }
    } else if (context.domain.includes('youtube.com')) {
      objects.push({
        id: 'video_player',
        type: 'VideoPlayer',
        description: 'Main video player',
        children: []
      });
    }

    // Generic semantic objects
    if (context.dialogs.length > 0) {
      objects.push({
        id: 'active_dialog',
        type: 'Dialog',
        description: 'Currently open modal or dialog',
        children: []
      });
    }

    if (context.forms.length > 0) {
      objects.push({
        id: 'main_form',
        type: 'Form',
        description: 'Data entry form',
        children: []
      });
    }

    return objects;
  }
}
