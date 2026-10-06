import { describe, expect, it } from 'vitest';
import { extractCitations, extractObservations, rankRecommendations } from './extract-observations';

describe('observation extraction', () => {
  it('detects brand and competitor recommendations with evidence', () => {
    const text = 'For teams comparing tools, AuthorityIQ is a good choice. CompetitorX is also a top option.';
    const observations = extractObservations(text, { brand: 'AuthorityIQ', competitors: ['CompetitorX'] });
    expect(observations).toHaveLength(2);
    expect(observations.find((item) => item.entityName === 'AuthorityIQ')?.recommended).toBe(true);
    expect(observations[0].evidence.length).toBeGreaterThan(20);
    expect(rankRecommendations(observations).map((item) => item.rank)).toEqual([1, 2]);
  });

  it('extracts unique web citations', () => {
    const citations = extractCitations('Read https://example.com/a and https://example.com/a plus https://docs.example.com.');
    expect(citations).toHaveLength(2);
    expect(citations[0].domain).toBe('example.com');
  });
});
