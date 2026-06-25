import { z } from 'zod';
import { ATLASTool, ToolResult } from '../types';
import { BrowserController } from '../../browser/BrowserController';

export const KeyChordInputSchema = z.object({
  chord: z.string(),
});
export type KeyChordInput = z.infer<typeof KeyChordInputSchema>;

export class KeyChordTool implements ATLASTool<KeyChordInput, any> {
  name = 'key_chord';
  description = 'Presses a combination of keys (e.g., Control+A, Shift+ArrowRight)';
  inputSchema = KeyChordInputSchema;
  timeoutMs = 5000;
  maxRetries = 1;
  
  async execute(input: KeyChordInput, browser: BrowserController): Promise<ToolResult<any>> {
    const start = Date.now();
    try {
      await browser.getPage().keyboard.press(input.chord);
      return {
        success: true,
        data: null,
        error: null,
        timing: { startedAt: new Date(start).toISOString(), endedAt: new Date().toISOString(), durationMs: Date.now() - start },
        actionLogEntry: { actionId: Math.random().toString(), name: this.name, params: input, status: 'success', timestamp: new Date().toISOString() },
      };
    } catch (err) {
      return {
        success: false,
        data: null,
        error: { code: 'KEY_CHORD_FAILED', message: (err as Error).message, severity: 'RECOVERABLE', source: 'ELEMENT' },
        timing: { startedAt: new Date(start).toISOString(), endedAt: new Date().toISOString(), durationMs: Date.now() - start },
        actionLogEntry: { actionId: Math.random().toString(), name: this.name, params: input, status: 'failure', timestamp: new Date().toISOString() },
      };
    }
  }
}
