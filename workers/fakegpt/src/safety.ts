const UNSAFE =
  /\b(rape|raping|incest|child\s*porn|csam|nazi|genocide|suicide|kill\s+yourself|kys|slur)\b/i;

const INJECTION =
  /\b(ignore (all |any )?(previous|prior|above|earlier) (instructions|prompts|rules)|you are now|system prompt|new (system|developer) message|override (the )?(safety|rules))\b/i;

export function isUnsafeText(text: string): boolean {
  return UNSAFE.test(text);
}

export function looksLikeInjection(text: string): boolean {
  return INJECTION.test(text);
}

export function clipText(value: unknown, max: number): string {
  if (typeof value !== 'string') return '';
  return value.replace(/\s+/g, ' ').trim().slice(0, max);
}

export function sanitizeLine(value: unknown, max: number): string {
  const text = clipText(value, max);
  if (!text || isUnsafeText(text) || looksLikeInjection(text)) return '';
  return text.replace(/[`<>]/g, '');
}

export function extractJson(raw: unknown): unknown {
  if (raw && typeof raw === 'object') return raw;
  if (typeof raw !== 'string') throw new Error('no json object');
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1].trim() : trimmed;
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('no json object');
  return JSON.parse(body.slice(start, end + 1));
}
