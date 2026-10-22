import { normalizeAnswer } from '../match';
import { BANK_KINDS, OPTIONS_PER_QUESTION, type BankKind, type BankQuestion } from './types';

const ID_RE = /^[a-z][a-z0-9]+(?:-[a-z0-9]+)+$/;

const BLOCKLIST = [
  'kill yourself',
  'suicide',
  'nude',
  'porn',
  'sexual',
  'racist',
  'slur',
];

export type BankIssue = {
  id: string;
  reason: string;
};

export function tokens(value: string): string[] {
  return normalizeAnswer(value).split(' ').filter(Boolean);
}

export function optionKey(value: string): string {
  return normalizeAnswer(value);
}

export function answerLeakedInText(text: string, answer: string): boolean {
  const hay = ` ${normalizeAnswer(text)} `;
  const needle = normalizeAnswer(answer);
  if (!needle) return true;
  if (needle.length <= 2) {
    return hay.includes(` ${needle} `);
  }
  return hay.includes(needle);
}

export function optionsOverlap(answer: string, options: readonly string[]): boolean {
  const want = optionKey(answer);
  return options.some((option) => {
    const key = optionKey(option);
    if (key === want) return false;
    if (!key || !want) return true;
    if (key.length >= 4 && want.includes(key)) return true;
    if (want.length >= 4 && key.includes(want)) return true;
    return false;
  });
}

export function validateQuestion(raw: unknown): BankIssue[] {
  const question = raw as Partial<BankQuestion> | null;
  const id = typeof question?.id === 'string' ? question.id : '(missing-id)';
  const issues: BankIssue[] = [];
  const fail = (reason: string) => issues.push({ id, reason });

  if (!question || typeof question !== 'object') {
    fail('not an object');
    return issues;
  }
  if (!ID_RE.test(id)) fail('id must be kebab-case with a kind prefix');
  if (!BANK_KINDS.includes(question.kind as BankKind)) fail('unknown kind');
  if (typeof question.category !== 'string' || question.category.trim().length < 2) fail('category missing');
  if (question.difficulty !== 1 && question.difficulty !== 2 && question.difficulty !== 3) fail('difficulty must be 1-3');
  if (typeof question.text !== 'string' || question.text.trim().length < 8) fail('text too short');
  const answer = typeof question.answer === 'string' ? question.answer : '';
  if (!answer.trim()) fail('answer missing');
  if (!Array.isArray(question.options) || question.options.length !== OPTIONS_PER_QUESTION) {
    fail(`need exactly ${OPTIONS_PER_QUESTION} options`);
    return issues;
  }
  if (question.options.some((option) => typeof option !== 'string' || !option.trim())) fail('empty option');

  const keys = question.options.map(optionKey);
  if (keys.some((key) => !key)) fail('option normalizes empty');
  if (new Set(keys).size !== OPTIONS_PER_QUESTION) fail('duplicate options');

  const answerKey = optionKey(answer);
  const matches = question.options.filter((option) => optionKey(option) === answerKey);
  if (matches.length !== 1) fail('exactly one option must match the answer');

  if (typeof question.text === 'string' && answer && answerLeakedInText(question.text, answer)) {
    fail('answer leaked in the prompt');
  }
  if (answer && optionsOverlap(answer, question.options)) {
    fail('another option overlaps the answer');
  }
  if (question.kind === 'fill' && typeof question.text === 'string' && !/_{3,}/.test(question.text)) {
    fail('fill-in needs a ___ blank');
  }

  const blob = `${question.text} ${question.answer} ${question.options.join(' ')}`.toLowerCase();
  if (BLOCKLIST.some((word) => blob.includes(word))) fail('not family-friendly');

  return issues;
}

export function validateBank(questions: readonly unknown[]): { issues: BankIssue[]; byKind: Record<string, number> } {
  const issues: BankIssue[] = [];
  const seen = new Set<string>();
  const byKind: Record<string, number> = {};
  for (const raw of questions) {
    const row = raw as { id?: string; kind?: string };
    const id = typeof row.id === 'string' ? row.id : '';
    if (id) {
      if (seen.has(id)) issues.push({ id, reason: 'duplicate id' });
      seen.add(id);
    }
    if (typeof row.kind === 'string') byKind[row.kind] = (byKind[row.kind] ?? 0) + 1;
    issues.push(...validateQuestion(raw));
  }
  return { issues, byKind };
}
