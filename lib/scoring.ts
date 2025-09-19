import { normalize } from "./phonetics";

export function requiredTokens(expected: string): string[] {
  const normalized = normalize(expected);
  if (!normalized) return [];
  const unique = new Set(normalized.split(" "));
  return Array.from(unique);
}

export function scoreTokens(expected: string[], said: string) {
  const normalized = normalize(said);
  const saidTokens = new Set(normalized ? normalized.split(" ") : []);
  let hit = 0;
  const misses: string[] = [];

  for (const token of expected) {
    if (saidTokens.has(token)) {
      hit += 1;
    } else {
      misses.push(token);
    }
  }

  const total = expected.length;
  const pct = total === 0 ? 1 : hit / total;

  return { hit, total, pct, misses };
}
