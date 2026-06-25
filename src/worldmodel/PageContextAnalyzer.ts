import { PageState } from './types';

export interface PageContext {
  pageType: string;
  domain: string;
  framework: string;
  language: string;
  authenticated: boolean;
  dialogs: string[];
  documents: string[];
  forms: string[];
  media: string[];
  navigation: string[];
}

export class PageContextAnalyzer {
  analyze(pageState: PageState): PageContext {
    const url = new URL(pageState.url);
    const domain = url.hostname;
    
    // Heuristic Classification
    let pageType = 'Document';
    if (domain.includes('github.com')) {
      pageType = 'GitHub Repository';
      if (url.pathname.includes('/issues')) pageType = 'GitHub Issues';
      if (url.pathname.includes('/pulls')) pageType = 'GitHub PRs';
    } else if (domain.includes('youtube.com')) {
      pageType = 'YouTube Video';
    } else if (pageState.elements.some(e => e.elementType === 'VIDEO')) {
      pageType = 'Video Platform';
    } else if (pageState.elements.some(e => e.elementType === 'TEXTBOX') && pageState.elements.length < 20) {
      pageType = 'Form/Login';
    }

    return {
      pageType,
      domain,
      framework: 'Unknown',
      language: 'en',
      authenticated: pageState.elements.some(e => e.text?.toLowerCase().includes('sign out') || e.text?.toLowerCase().includes('logout')),
      dialogs: pageState.openDialogs,
      documents: pageState.elements.filter(e => e.elementType === 'ARTICLE').map(e => e.id),
      forms: pageState.sections.filter(s => s.type === 'form').map(s => s.id),
      media: pageState.elements.filter(e => e.elementType === 'VIDEO').map(e => e.id),
      navigation: pageState.sections.filter(s => s.type === 'header' || s.type === 'sidebar').map(s => s.id)
    };
  }
}
