import { v4 as uuid } from 'uuid';
import { Action, ToolResult } from '../tools/types';

export type EdgeType = 'PLANNED' | 'RECOVERY' | 'EXPLORATION';
export type TerminalStatus = 'SUCCESS' | 'FAILURE' | 'PARTIAL' | 'UNKNOWN';

export interface WorldStateSummary {
  url: string;
  title: string;
  classification: string;
  goalProgress: string; // e.g. "2/5 steps"
  errorSignals: string[];
}

export interface StateNode {
  nodeId: string;
  stepNumber: number;
  worldStateSummary: WorldStateSummary;
  screenshotPath?: string;
  timestamp: string;
}

export interface ActionEdge {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  action: Action;
  toolResult: { success: boolean; errorCode?: string };
  actionVerification?: any;
  thought?: string;
  confidence?: number;
  edgeType: EdgeType;
}

export class ExecutionGraph {
  private nodes: Map<string, StateNode> = new Map();
  private edges: ActionEdge[] = [];
  private _rootNodeId?: string;
  private _terminalNodeId?: string;
  private _terminalStatus: TerminalStatus = 'UNKNOWN';

  get rootNodeId() { return this._rootNodeId; }

  addNode(stepNumber: number, summary: WorldStateSummary, screenshotPath?: string): string {
    const nodeId = uuid();
    const node: StateNode = {
      nodeId,
      stepNumber,
      worldStateSummary: summary,
      screenshotPath,
      timestamp: new Date().toISOString()
    };
    this.nodes.set(nodeId, node);
    if (!this._rootNodeId) this._rootNodeId = nodeId;
    return nodeId;
  }

  addEdge(
    fromNodeId: string,
    toNodeId: string,
    action: Action,
    toolResult: Pick<ToolResult<any>, 'success' | 'error'>,
    thought: string,
    confidence: number,
    edgeType: EdgeType = 'PLANNED'
  ): string {
    const edgeId = uuid();
    this.edges.push({
      id: edgeId,
      fromNodeId,
      toNodeId,
      action,
      toolResult: { success: toolResult.success, errorCode: toolResult.error?.code },
      actionVerification: (toolResult as any).actionVerification,
      thought,
      confidence,
      edgeType
    });
    return edgeId;
  }

  updateLastEdgeVerification(verification: any): void {
    if (this.edges.length > 0) {
      (this.edges[this.edges.length - 1] as any).actionVerification = verification;
    }
  }

  setTerminal(nodeId: string, status: TerminalStatus): void {
    this._terminalNodeId = nodeId;
    this._terminalStatus = status;
  }

  serialize(): object {
    return {
      rootNodeId: this._rootNodeId,
      terminalNodeId: this._terminalNodeId,
      terminalStatus: this._terminalStatus,
      nodeCount: this.nodes.size,
      edgeCount: this.edges.length,
      nodes: Array.from(this.nodes.values()),
      edges: this.edges
    };
  }

  /**
   * Outputs a Mermaid flowchart string for visual demo purposes.
   * Paste into https://mermaid.live to render.
   */
  toMermaid(): string {
    const lines: string[] = ['flowchart TD'];

    for (const [id, node] of this.nodes.entries()) {
      const shortId = id.slice(0, 6);
      const label = `${node.stepNumber}: ${node.worldStateSummary.classification}\\n${node.worldStateSummary.url.slice(0, 40)}`;
      const isTerminal = id === this._terminalNodeId;
      lines.push(`  ${shortId}["${label}"]${isTerminal ? ':::terminal' : ''}`);
    }

    const seenEdges = new Set<string>();

    for (const edge of this.edges) {
      const fromNode = this.nodes.get(edge.fromNodeId);
      const toNode = this.nodes.get(edge.toNodeId);
      const fromShort = edge.fromNodeId.slice(0, 6);
      const toShort = edge.toNodeId.slice(0, 6);
      
      let execMark = edge.toolResult.success ? '✓' : '✗';
      let verMark = (edge as any).actionVerification ? ((edge as any).actionVerification.success ? ' [Ver ✓]' : ' [Ver ✗]') : '';
      let actionLabel = `${edge.action.name} ${execMark}${verMark}`;
      
      // Loop detection: same URL + same action name + same target params
      const sig = `${fromNode?.worldStateSummary.url}::${edge.action.name}::${JSON.stringify(edge.action.params)}`;
      let style = edge.edgeType === 'RECOVERY' ? '-. RECOVERY .->': '-->';
      
      if (seenEdges.has(sig) && edge.edgeType !== 'RECOVERY') {
        style = '== LOOP ==>';
        actionLabel = 'LOOP DETECTED';
        lines.push(`  style ${fromShort} fill:#f87171,stroke:#b91c1c,color:#fff`);
        lines.push(`  style ${toShort} fill:#f87171,stroke:#b91c1c,color:#fff`);
      }
      seenEdges.add(sig);

      lines.push(`  ${fromShort} ${style}|"${actionLabel}"| ${toShort}`);
    }

    if (this._terminalStatus === 'SUCCESS') {
      lines.push('  classDef terminal fill:#22c55e,color:#fff');
    } else if (this._terminalStatus === 'FAILURE') {
      lines.push('  classDef terminal fill:#ef4444,color:#fff');
    }

    return lines.join('\n');
  }
}
