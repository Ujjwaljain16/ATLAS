import { Page } from 'playwright';

export interface DocumentChunk {
  id: string;
  type: string;
  text: string;
  length: number;
}

export interface DocumentIndex {
  summary: {
    headings: number;
    paragraphs: number;
    tables: number;
    lists: number;
    codeBlocks: number;
  };
  chunks: DocumentChunk[];
}

export class DocumentObserver {
  async extract(page: Page): Promise<DocumentIndex> {
    return page.evaluate(() => {
      const chunks: DocumentChunk[] = [];
      const summary = {
        headings: 0,
        paragraphs: 0,
        tables: 0,
        lists: 0,
        codeBlocks: 0
      };

      const elements = document.querySelectorAll('h1, h2, h3, h4, h5, h6, p, table, ul, ol, pre, code');
      let idCounter = 1;

      elements.forEach(el => {
        const text = el.textContent?.trim() || '';
        if (text.length === 0) return;

        const tagName = el.tagName.toLowerCase();
        let type = 'Text';

        if (tagName.startsWith('h')) {
          summary.headings++;
          type = 'Heading';
        } else if (tagName === 'p') {
          summary.paragraphs++;
          type = 'Paragraph';
        } else if (tagName === 'table') {
          summary.tables++;
          type = 'Table';
        } else if (tagName === 'ul' || tagName === 'ol') {
          summary.lists++;
          type = 'List';
        } else if (tagName === 'pre' || tagName === 'code') {
          summary.codeBlocks++;
          type = 'CodeBlock';
        }

        chunks.push({
          id: `chunk_${idCounter++}`,
          type,
          text,
          length: text.length
        });
      });

      return { summary, chunks };
    });
  }
}
