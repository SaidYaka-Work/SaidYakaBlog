export type MatchVerdict = 'correct' | 'ambiguous' | 'wrong' | 'empty';

export function normalizeAnswer(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[''`´.]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(a|an|the)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    let prev = i - 1;
    row[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const next = row[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + cost);
      prev = next;
    }
  }
  return row[b.length];
}

function typoBudget(length: number): number {
  if (length <= 3) return 0;
  if (length <= 7) return 1;
  return 2;
}

export function matchTypedAnswer(player: string, answer: string, aliases: readonly string[] = []): MatchVerdict {
  const got = normalizeAnswer(player);
  if (!got) return 'empty';
  const targets = [answer, ...aliases].map(normalizeAnswer).filter(Boolean);
  if (targets.includes(got)) return 'correct';

  let close = false;
  for (const target of targets) {
    const dist = levenshtein(got, target);
    const budget = typoBudget(target.length);
    const sameStart = got[0] === target[0];
    if (budget > 0 && dist <= budget && sameStart) return 'correct';
    const contained = got.length >= 4 && target.length >= 4 && (target.includes(got) || got.includes(target));
    if (contained || (sameStart && dist === budget + 1 && budget > 0)) close = true;
  }
  return close ? 'ambiguous' : 'wrong';
}

export function matchChoice(player: string, answer: string): boolean {
  return normalizeAnswer(player) === normalizeAnswer(answer) && Boolean(normalizeAnswer(player));
}
