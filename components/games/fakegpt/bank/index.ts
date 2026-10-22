import fill from './data/fill.json';
import math from './data/math.json';
import order from './data/order.json';
import spell from './data/spell.json';
import tone from './data/tone.json';
import translate from './data/translate.json';
import trivia from './data/trivia.json';
import unit from './data/unit.json';
import unscramble from './data/unscramble.json';
import weekday from './data/weekday.json';
import type { BankQuestion } from './types';

export const BANK: BankQuestion[] = [
  ...(trivia as BankQuestion[]),
  ...(translate as BankQuestion[]),
  ...(math as BankQuestion[]),
  ...(unit as BankQuestion[]),
  ...(weekday as BankQuestion[]),
  ...(spell as BankQuestion[]),
  ...(unscramble as BankQuestion[]),
  ...(order as BankQuestion[]),
  ...(tone as BankQuestion[]),
  ...(fill as BankQuestion[]),
];

export { BANK_KINDS, DAILY_ROUND_COUNT, WINDOW_DAYS, type BankKind, type BankQuestion } from './types';
