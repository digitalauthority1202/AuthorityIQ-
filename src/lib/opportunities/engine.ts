export interface OpportunityInput {
  impact: number;
  commercialIntent: number;
  competitiveGap: number;
  confidence: number;
  effort: number;
}

export function opportunityScore(input: OpportunityInput): number {
  const effort = Math.max(input.effort, 0.1);
  return (input.impact * input.commercialIntent * input.competitiveGap * input.confidence) / effort;
}

export function buildOpportunity(input: OpportunityInput & { title: string; description: string }) {
  return {
    ...input,
    score: Number(opportunityScore(input).toFixed(4)),
    scoringVersion: 'v1.0',
    status: 'open' as const,
  };
}
