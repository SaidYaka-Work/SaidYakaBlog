import { utcDate } from '../../../workers/fakegpt/src/schema';
import { buildDailySet } from './daily';
import type { DailySet } from './types';

export function fetchDailySet(date = utcDate()): DailySet {
  return buildDailySet(date);
}
