export interface ScoreInput {
  targetRecommendations: number;
  totalRecommendations: number;
  targetMentions: number;
  totalMentions: number;
  targetCitations: number;
  totalCitations: number;
  competitorRecommendations: number;
  observations: number;
  averageConfidence: number;
}

export interface AuthorityMetrics {
  recommendationShare: number;
  visibilityScore: number;
  citationShare: number;
  competitiveScore: number;
  authorityScore: number;
  formulaVersion: string;
}

const VERSION = 'v1.0';
const clamp = (n: number) => Math.max(0, Math.min(100, n));

export function calculateAuthorityMetrics(input: ScoreInput): AuthorityMetrics {
  const recommendationShare = input.totalRecommendations ? input.targetRecommendations / input.totalRecommendations : 0;
  const mentionShare = input.totalMentions ? input.targetMentions / input.totalMentions : 0;
  const citationShare = input.totalCitations ? input.targetCitations / input.totalCitations : 0;
  const competitiveScore = input.targetRecommendations + input.competitorRecommendations > 0
    ? input.targetRecommendations / (input.targetRecommendations + input.competitorRecommendations)
    : 0;
  const visibilityScore = clamp((mentionShare * 60 + recommendationShare * 40) * 100);
  const authorityScore = clamp((recommendationShare * 35 + citationShare * 25 + competitiveScore * 25 + input.averageConfidence * 15) * 100);
  return {
    recommendationShare: recommendationShare * 100,
    visibilityScore,
    citationShare: citationShare * 100,
    competitiveScore: competitiveScore * 100,
    authorityScore,
    formulaVersion: VERSION,
  };
}
