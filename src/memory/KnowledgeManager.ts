import { v4 as uuid } from 'uuid';

export interface ObservationArtifact {
  id: string;
  type: string;
  source: string;
  content: string;
  metadata?: any;
  confidence: number;
}

export interface KnowledgeItem {
  id: string;
  type: string;
  source: string;
  content: string;
  summary: string;
  metadata?: any;
  confidence: number;
  createdAt: string;
  tags: string[];
}

export class KnowledgeManager {
  private items = new Map<string, KnowledgeItem>();

  add(artifact: ObservationArtifact): KnowledgeItem {
    const item: KnowledgeItem = {
      id: artifact.id || uuid(),
      type: artifact.type,
      source: artifact.source,
      content: artifact.content,
      summary: this.generateSummary(artifact.content),
      metadata: artifact.metadata,
      confidence: artifact.confidence,
      createdAt: new Date().toISOString(),
      tags: this.generateTags(artifact)
    };
    this.items.set(item.id, item);
    return item;
  }

  get(id: string): KnowledgeItem | undefined {
    return this.items.get(id);
  }

  getAll(): KnowledgeItem[] {
    return Array.from(this.items.values());
  }

  getSummary(): string {
    const items = this.getAll();
    if (items.length === 0) return 'No knowledge acquired yet.';
    return items.map(i => `[${i.type}] from ${i.source}: ${i.summary}`).join('\n');
  }

  private generateSummary(content: string): string {
    // In the future, this could be an LLM summarization call if content is huge.
    // For now, take the first 150 characters.
    if (content.length <= 150) return content;
    return content.substring(0, 150) + '...';
  }

  private generateTags(artifact: ObservationArtifact): string[] {
    const tags = [artifact.type];
    if (artifact.source.includes('github.com')) tags.push('GitHub');
    return tags;
  }
}
