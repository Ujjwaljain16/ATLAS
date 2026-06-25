import { ToolError } from '../tools/types';
import { PageState } from '../worldmodel/types';

export interface ClassificationResult {
  classification: 'COVERED' | 'DETACHED' | 'INVISIBLE' | 'ANIMATING' | 'NAVIGATION' | 'UNKNOWN';
  confidence: number;
  severity: 'FATAL' | 'RECOVERABLE' | 'TRANSIENT';
}

export class FailureClassifier {
  classifyEnvDiff(preState: PageState, postState: PageState, targetSelector: string, error?: ToolError): ClassificationResult {
    const preEl = preState.elements.find(e => e.selector === targetSelector || e.id === targetSelector);
    const postEl = postState.elements.find(e => e.selector === targetSelector || e.id === targetSelector);

    if (!postEl) {
      if (preState.url !== postState.url) {
        return { classification: 'NAVIGATION', confidence: 1.0, severity: 'RECOVERABLE' };
      }
      return { classification: 'DETACHED', confidence: 0.9, severity: 'RECOVERABLE' };
    }

    if (preEl?.visible && !postEl.visible) {
      return { classification: 'INVISIBLE', confidence: 0.9, severity: 'RECOVERABLE' };
    }

    if (error?.message?.toLowerCase().includes('obscured')) {
      return { classification: 'COVERED', confidence: 0.8, severity: 'RECOVERABLE' };
    }

    if (error?.message?.toLowerCase().includes('timeout') || error?.code === 'TOOL_TIMEOUT') {
      return { classification: 'UNKNOWN', confidence: 0.5, severity: 'TRANSIENT' };
    }

    return { classification: 'UNKNOWN', confidence: 0.1, severity: 'RECOVERABLE' };
  }
}
