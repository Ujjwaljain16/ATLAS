import { VerificationRegistry } from './VerificationRegistry';
import { TypeVerifier } from './verifiers/TypeVerifier';
import { ClickVerifier } from './verifiers/ClickVerifier';
import { WaitVerifier } from './verifiers/WaitVerifier';
import { ScrollVerifier } from './verifiers/ScrollVerifier';
import { ClipboardVerifier } from './verifiers/ClipboardVerifier';
import { NavigationVerifier } from './verifiers/NavigationVerifier';
import { ReadVerifier } from './verifiers/ReadVerifier';
import { GenericLLMVerifier } from './verifiers/GenericLLMVerifier';
import { VerificationContext, VerificationResult } from './types';

export class ActionVerificationEngine {
  private registry: VerificationRegistry;

  constructor(apiKey: string, modelName: string = 'gemini-2.5-flash') {
    this.registry = new VerificationRegistry();
    
    // Register deterministic verifiers
    this.registry.register('type', new TypeVerifier());
    this.registry.register('fill_form', new TypeVerifier());
    this.registry.register('click', new ClickVerifier());
    this.registry.register('wait_until', new WaitVerifier());
    this.registry.register('scroll', new ScrollVerifier());
    this.registry.register('copy', new ClipboardVerifier());
    this.registry.register('navigate', new NavigationVerifier());
    this.registry.register('extract_text', new ReadVerifier());
    
    // Fallback verifier
    this.registry.setFallback(new GenericLLMVerifier(apiKey, modelName));
  }

  async verify(context: VerificationContext): Promise<VerificationResult> {
    return this.registry.verify(context);
  }
}
