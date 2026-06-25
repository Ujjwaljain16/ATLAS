import { CompletionContext, CompletionResult, CompletionRule } from '../CompletionTypes';

export class VideoCompletionRule implements CompletionRule {
  name = 'VideoCompletionRule';

  supports(context: CompletionContext): boolean {
    const isVideoGoal = context.goal.toLowerCase().includes('play') || context.goal.toLowerCase().includes('video');
    const isYouTube = context.url.includes('youtube.com');
    return isVideoGoal && isYouTube;
  }

  async evaluate(context: CompletionContext): Promise<CompletionResult> {
    const isWatchUrl = context.url.includes('/watch?v=');
    const hasPlayer = context.worldState.elements.some((e: any) => e.role === 'video' || e.tag === 'video' || e.id === 'movie_player');
    
    if (isWatchUrl && hasPlayer) {
      return {
        status: 'COMPLETE',
        confidence: 0.98,
        evidence: [
          'URL matched watch?v=',
          'Video Player Found'
        ]
      };
    }
    
    return {
      status: 'PENDING',
      confidence: 0.1,
      evidence: ['Not on a watch URL or no player found.']
    };
  }
}
