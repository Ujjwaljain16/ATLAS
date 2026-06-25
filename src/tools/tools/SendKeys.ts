import { z } from 'zod';
import { ATLASTool, ToolResult } from '../types';
import { BrowserController } from '../../browser/BrowserController';

export const SendKeysInputSchema = z.object({
  elementId: z.string(),
  text: z.string(),
  clearFirst: z.boolean().default(false),
  typeDelayMs: z.number().optional()
});
export type SendKeysInput = z.infer<typeof SendKeysInputSchema>;

export interface SendKeysData {
  charactersTyped: number;
  finalValue: string;
}

export class SendKeysTool implements ATLASTool<SendKeysInput, SendKeysData> {
  name = 'type';
  description = 'Sends keystrokes to an element identified by elementId';
  inputSchema = SendKeysInputSchema;
  timeoutMs = 15000;
  maxRetries = 2;
  requiredState = {
    editable: true,
    focused: true
  };

  metadata = {
    arguments: { elementId: 'string (required)', text: 'string (required)', submit: 'boolean (optional)' },
    preconditions: 'Element must be an input or textbox and be visible.',
    postconditions: 'Text is typed into the element.',
    sideEffects: 'Input values change. May trigger form submission if submit=true.',
    cost: 2,
    verifiable: true,
    supportsRetry: true,
    supportsRecovery: true,
    failureModes: ['ElementHidden', 'ElementDetached']
  };
  
  async execute(input: SendKeysInput, browser: BrowserController): Promise<ToolResult<SendKeysData>> {
    const start = Date.now();
    
    try {
      let locator;
      if (input.elementId === '__ACTIVE_ELEMENT__') {
        const page = browser.getPage();
        // Fallback to active element via a locator that resolves document.activeElement
        // In Playwright, page.locator('*:focus') gets the active element!
        locator = page.locator('*:focus');
      } else {
        locator = await browser.locateElement(input.elementId);
      }
      
      if (input.clearFirst) {
        await locator.clear();
      }
      
      // Strategy 1: Playwright fill() — best for React controlled inputs
      await locator.fill(input.text);
      
      // Verify the value registered in the DOM
      const finalValue = await locator.inputValue();
      
      // react-hook-form check: if fill() didn't register, try type() char-by-char
      if (finalValue !== input.text) {
        await locator.clear();
        // Use pressSequentially() — fires keyboard events one character at a time,
        // correctly triggering React synthetic event handlers (onChange, onInput).
        await locator.pressSequentially(input.text, { delay: input.typeDelayMs || 20 });
      }
      
      return {
        success: true,
        data: { 
          charactersTyped: input.text.length, 
          finalValue: await locator.inputValue() 
        },
        error: null,
        timing: this.buildTiming(start),
        actionLogEntry: this.buildActionLog(input, 'success'),
      };
      
    } catch (err) {
      return {
        success: false,
        data: null,
        error: {
          code: 'SEND_KEYS_FAILED',
          message: (err as Error).message,
          severity: 'RECOVERABLE',
          source: 'ELEMENT',
        },
        timing: this.buildTiming(start),
        actionLogEntry: this.buildActionLog(input, 'failure'),
      };
    }
  }

  private buildTiming(start: number) {
    return {
      startedAt: new Date(start).toISOString(),
      endedAt: new Date().toISOString(),
      durationMs: Date.now() - start
    };
  }

  private buildActionLog(input: SendKeysInput, status: 'success' | 'failure') {
    return {
      actionId: Math.random().toString(),
      name: this.name,
      params: input,
      status,
      timestamp: new Date().toISOString()
    };
  }
}
