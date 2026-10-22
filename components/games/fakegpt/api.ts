import { utcDate, type DailySet } from '../../../workers/fakegpt/src/schema';
import { buildDailySet } from './daily';

export function fetchDailySet(date = utcDate()): DailySet {
  return buildDailySet(date);
}
