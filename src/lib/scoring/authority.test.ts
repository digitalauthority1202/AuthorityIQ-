import { describe, expect, it } from 'vitest';
import { calculateAuthorityMetrics } from './authority';

describe('authority scoring', () => {
  it('produces bounded, versioned metrics', () => {
    const result = calculateAuthorityMetrics({
      targetRecommendations: 6,
      totalRecommendations: 10,
      targetMentions: 8,
      totalMentions: 10,
      targetCitations: 3,
      totalCitations: 5,
      competitorRecommendations: 4,
      observations: 10,
      averageConfidence: 0.8,
    });
    expect(result.recommendationShare).toBe(60);
    expect(result.citationShare).toBe(60);
    expect(result.competitiveScore).toBeCloseTo(60);
    expect(result.authorityScore).toBeGreaterThanOrEqual(0);
    expect(result.authorityScore).toBeLessThanOrEqual(100);
    expect(result.formulaVersion).toBe('v1.0');
  });
});
