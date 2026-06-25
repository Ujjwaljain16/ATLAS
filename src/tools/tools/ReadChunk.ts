import { z } from 'zod';
import { ATLASTool, ToolResult } from '../types';
import { BrowserController } from '../../browser/BrowserController';
import { v4 as uuid } from 'uuid';

export const ReadChunkInputSchema = z.object({
  chunkId: z.string(),
});
export type ReadChunkInput = z.infer<typeof ReadChunkInputSchema>;

export class ReadChunkTool implements ATLASTool<ReadChunkInput, string> {
  name = 'read_chunk';
  description = 'Retrieves the full text of a document chunk (e.g. chunk_1) that was identified in the DocumentIndex.';
  inputSchema = ReadChunkInputSchema;
  timeoutMs = 5000;
  maxRetries = 1;
  metadata = {
    arguments: { chunkId: 'string (required)' },
    preconditions: 'The page must have a DocumentIndex with chunks available.',
    postconditions: 'Returns the exact text of the requested chunk.',
    sideEffects: 'None',
    cost: 1,
    verifiable: true,
    supportsRetry: true,
    supportsRecovery: false,
    failureModes: ['ChunkNotFound']
  };

  async execute(input: ReadChunkInput, browser: BrowserController): Promise<ToolResult<string>> {
    const start = Date.now();
    try {
      const page = browser.getPage();
      
      // In a real KnowledgeRetriever, we'd cache the chunks.
      // For now, we quickly re-evaluate or use a cached global.
      // Better: we extract exactly the chunk by its index.
      
      const chunkText = await page.evaluate((id) => {
        // Simple DOM extraction assuming ID maps to the Nth matched element
        const index = parseInt(id.split('_')[1], 10) - 1;
        const elements = document.querySelectorAll('h1, h2, h3, h4, h5, h6, p, table, ul, ol, pre, code');
        
        let matchIndex = 0;
        for (let i = 0; i < elements.length; i++) {
          const text = elements[i].textContent?.trim() || '';
          if (text.length > 0) {
            if (matchIndex === index) return text;
            matchIndex++;
          }
        }
        return null;
      }, input.chunkId);

      if (!chunkText) {
        throw new Error(`Chunk ${input.chunkId} not found.`);
      }

      const url = page.url();
      const artifact = {
        id: uuid(),
        type: 'Chunk',
        source: url,
        content: chunkText,
        metadata: { chunkId: input.chunkId },
        confidence: 1.0
      };

      return {
        success: true,
        data: chunkText,
        artifacts: [artifact],
        error: null,
        timing: { startedAt: new Date(start).toISOString(), endedAt: new Date().toISOString(), durationMs: Date.now() - start },
        actionLogEntry: { actionId: 'read_chunk', name: 'read_chunk', params: input, status: 'success', timestamp: new Date().toISOString() }
      };
    } catch (e) {
      return {
        success: false,
        data: null,
        error: { code: 'READ_FAILED', message: (e as Error).message, severity: 'RECOVERABLE', source: 'SYSTEM' },
        timing: { startedAt: new Date(start).toISOString(), endedAt: new Date().toISOString(), durationMs: Date.now() - start },
        actionLogEntry: { actionId: 'read_chunk', name: 'read_chunk', params: input, status: 'failure', timestamp: new Date().toISOString() }
      };
    }
  }
}
