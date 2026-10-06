export interface ExtractionTarget {
  brand: string;
  competitors: string[];
}

export interface Observation {
  entityName: string;
  entityType: 'brand' | 'competitor' | 'other';
  recommended: boolean;
  rank?: number;
  confidence: number;
  evidence: string;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function extractObservations(text: string, target: ExtractionTarget): Observation[] {
  const names = [target.brand, ...target.competitors].filter(Boolean);
  return names.flatMap((name) => {
    const re = new RegExp(`\\b${escapeRegExp(name)}\\b`, 'gi');
    const match = re.exec(text);
    if (!match) return [];
    const start = Math.max(0, match.index - 180);
    const end = Math.min(text.length, match.index + name.length + 240);
    const evidence = text.slice(start, end).replace(/\s+/g, ' ').trim();
    const positive = /recommend|best|top|ideal|good choice|suggest/i.test(evidence);
    const entityType = name.toLowerCase() === target.brand.toLowerCase() ? 'brand' : 'competitor';
    return [{ entityName: name, entityType, recommended: positive, confidence: positive ? 0.82 : 0.68, evidence }];
  });
}

export function rankRecommendations(observations: Observation[]): Observation[] {
  return observations
    .filter((o) => o.recommended)
    .map((o, index) => ({ ...o, rank: index + 1 }));
}
