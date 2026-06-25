import { PageState } from '../worldmodel/types';

export interface PageContext {
  pageType: string;
  confidence: number;
  language?: string;
  framework?: string;
}

export class PageContextAnalyzer {
  
  analyze(state: PageState): PageContext {
    const url = state.url.toLowerCase();
    
    // Probabilistic Classification Heuristics
    if (url.includes('youtube.com/watch')) {
      return { pageType: 'VideoPlayback', confidence: 0.98 };
    }
    if (url.includes('youtube.com/results')) {
      return { pageType: 'VideoSearch', confidence: 0.95 };
    }
    if (url.includes('google.com/search')) {
      return { pageType: 'WebSearch', confidence: 0.95 };
    }
    if (url.includes('checkout') || url.includes('cart')) {
      return { pageType: 'Checkout', confidence: 0.85 };
    }
    if (url.includes('login') || url.includes('signin')) {
      return { pageType: 'Authentication', confidence: 0.90 };
    }

    // Default
    return { pageType: 'GenericWebPage', confidence: 0.50 };
  }
}
