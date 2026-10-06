export interface OpportunityInputs {
  impact: number;
  commercialIntent: number;
  competitiveGap: number;
  confidence: number;
  effort: number;
}

const clamp = (value: number) => Math.max(0, Math.min(1, value));

export function calculateOpportunityScore(input: OpportunityInputs): number {
  const impact = clamp(input.impact);
  const commercialIntent = clamp(input.commercialIntent);
  const competitiveGap = clamp(input.competitiveGap);
  const confidence = clamp(input.confidence);
  const effort = Math.max(input.effort, 0.05);

  return Number(((impact * commercialIntent * competitiveGap * confidence) / effort).toFixed(4));
}

export const SCORING_VERSION = 'v1.0.0';
