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

export interface CitationObservation {
  url: string;
  domain: string;
  sourceType: 'web' | 'unknown';
  confidence: number;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function evidenceWindow(text: string, index: number, length: number) {
  const start = Math.max(0, index - 180);
  const end = Math.min(text.length, index + length + 240);
  return text.slice(start, end).replace(/\s+/g, ' ').trim();
}

export function extractObservations(text: string, target: ExtractionTarget): Observation[] {
  const names = [target.brand, ...target.competitors].filter(Boolean);
  return names.flatMap((name) => {
    const re = new RegExp(`\\b${escapeRegExp(name)}\\b`, 'gi');
    const match = re.exec(text);
    if (!match) return [];
    const evidence = evidenceWindow(text, match.index, name.length);
    const positive = /recommend|best|top|ideal|good choice|suggest|prefer|winner|leading/i.test(evidence);
    const negative = /not recommend|avoid|poor choice|weak|worse|disappoint/i.test(evidence);
    const entityType = name.toLowerCase() === target.brand.toLowerCase() ? 'brand' : 'competitor';
    const recommended = positive && !negative;
    return [{
      entityName: name,
      entityType,
      recommended,
      confidence: negative || positive ? 0.82 : 0.68,
      evidence,
    }];
  });
}

export function rankRecommendations(observations: Observation[]): Observation[] {
  return observations
    .filter((o) => o.recommended)
    .sort((a, b) => b.confidence - a.confidence)
    .map((o, index) => ({ ...o, rank: index + 1 }));
}

export function extractCitations(text: string): CitationObservation[] {
  const matches = text.match(/https?:\/\/[^\s)\]}>,]+/gi) ?? [];
  return [...new Set(matches)].slice(0, 50).map((url) => {
    let domain = 'unknown';
    try {
      domain = new URL(url).hostname.replace(/^www\./, '');
    } catch {
      // Keep malformed URLs as low-confidence observations rather than failing the run.
    }
    return { url, domain, sourceType: domain === 'unknown' ? 'unknown' : 'web', confidence: domain === 'unknown' ? 0.55 : 0.9 };
  });
}
