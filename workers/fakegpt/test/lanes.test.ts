import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  MAX_CUSTOMERS,
  MAX_LEVEL,
  MAX_STRIKES,
  applyStrike,
  buildShareGrid,
  customersForLevel,
  customersJoiningAtLevel,
  fillPersonas,
  isLevelComplete,
  isRunComplete,
  customerPanelId,
  customerTabId,
  joinNotice,
  laneLayout,
  leaveNotice,
  levelServeGoal,
  levelSurviveMs,
  newlyJoined,
  nextCombo,
  nextTabIndex,
  patienceMs,
  planRun,
  rankFor,
  shareGlyph,
  spawnDelayMs,
  startCustomerCount,
  tabCycleDelta,
  tabShortcutIndex,
  tabTone,
  tickRequest,
} from '../../../components/games/fakegpt/lanes.ts';

const evenSeed = 2;
const oddSeed = 3;

test('level 1 starts with 1 or 2 customers from the daily seed', () => {
  assert.equal(startCustomerCount(evenSeed), 2);
  assert.equal(startCustomerCount(oddSeed), 1);
  assert.equal(customersForLevel(1, evenSeed), 2);
  assert.equal(customersForLevel(1, oddSeed), 1);
});

test('another customer joins every level until 4–5', () => {
  assert.deepEqual(
    [1, 2, 3, 4, 5, 6].map((level) => customersForLevel(level, oddSeed)),
    [1, 2, 3, 4, 5, 5],
  );
  assert.deepEqual(
    [1, 2, 3, 4, 5].map((level) => customersForLevel(level, evenSeed)),
    [2, 3, 4, 5, 5],
  );
  assert.equal(customersForLevel(1, oddSeed), 1);
  assert.ok(customersForLevel(MAX_LEVEL, oddSeed) >= 4);
  assert.equal(customersForLevel(99, evenSeed), MAX_CUSTOMERS);
  assert.equal(customersJoiningAtLevel(1, oddSeed), 0);
  assert.equal(customersJoiningAtLevel(2, oddSeed), 1);
  assert.equal(customersJoiningAtLevel(5, evenSeed), 0);
});

test('short levels complete by serving N or surviving the clock', () => {
  assert.equal(levelServeGoal(1), 5);
  assert.equal(levelServeGoal(3), 7);
  assert.ok(levelSurviveMs(2) > levelSurviveMs(1));
  assert.equal(isLevelComplete(0, 0, 1), false);
  assert.equal(isLevelComplete(5, 1000, 1), true);
  assert.equal(isLevelComplete(1, levelSurviveMs(1), 1), true);
  assert.equal(isRunComplete(4), false);
  assert.equal(isRunComplete(5), true);
});

test('patience and spawn rate tighten as more customers stack', () => {
  assert.ok(patienceMs(3) < patienceMs(1));
  assert.ok(patienceMs(1, 1) > patienceMs(1, 3));
  assert.ok(spawnDelayMs(4, 5) < spawnDelayMs(1, 1));
  const clock = tickRequest(1000, 10_000, 6000);
  assert.equal(clock.remainingMs, 5000);
  assert.equal(clock.patience, 0.5);
  assert.equal(clock.expired, false);
  assert.equal(tickRequest(1000, 10_000, 12_000).expired, true);
});

test('planRun deals a queue to every future customer and names joiners', () => {
  const tasks = Array.from({ length: 20 }, (_, index) => ({ id: `t${index}`, difficulty: 1 as const }));
  const plan = planRun([], tasks, oddSeed);
  assert.equal(plan.length, MAX_CUSTOMERS);
  assert.ok(plan.every((customer) => customer.queue.length >= 3));
  const ids = plan.flatMap((customer) => customer.queue.map((task) => task.id)).sort();
  assert.equal(new Set(ids).size, 20);
  const joiners = newlyJoined(plan, 2, oddSeed);
  assert.equal(joiners.length, 1);
  assert.equal(joinNotice('Dana'), '🟢 Dana joined the chat');
  assert.equal(joinNotice('the microwave'), '🟢 microwave joined the chat');
  assert.equal(leaveNotice('Dana'), '🔴 Dana left the chat');
  assert.equal(fillPersonas([], 1).length, MAX_CUSTOMERS);
});

test('tab shortcuts cycle, skip bare digits, and colour by patience', () => {
  assert.equal(nextTabIndex(0, 3, 1), 1);
  assert.equal(nextTabIndex(0, 3, -1), 2);
  assert.equal(nextTabIndex(4, 5, 1), 0);
  assert.equal(nextTabIndex(0, 0, 1), 0);
  assert.equal(tabShortcutIndex({ key: '2', altKey: true }, 4), 1);
  assert.equal(tabShortcutIndex({ key: '5', ctrlKey: true }, 5), 4);
  assert.equal(tabShortcutIndex({ key: '3', metaKey: true }, 2), null);
  assert.equal(tabShortcutIndex({ key: '2' }, 4), null);
  assert.equal(tabShortcutIndex({ key: '1', altKey: true }, 0), null);
  assert.equal(tabCycleDelta({ key: 'ArrowRight' }), 1);
  assert.equal(tabCycleDelta({ key: '[' }), -1);
  assert.equal(tabCycleDelta({ key: 'Tab', ctrlKey: true }), 1);
  assert.equal(tabCycleDelta({ key: 'Tab', ctrlKey: true, shiftKey: true }), -1);
  assert.equal(tabCycleDelta({ key: 'Tab' }), null);
  assert.equal(tabTone({ patience: 0.9, unread: 0 }), 'ok');
  assert.equal(tabTone({ patience: 0.4, unread: 0 }), 'warn');
  assert.equal(tabTone({ patience: 0.2, unread: 0 }), 'urgent');
  assert.equal(tabTone({ patience: 0.9, unread: 2 }), 'unread');
  assert.equal(tabTone({ patience: 0.2, unread: 2, left: true }), 'left');
  assert.equal(customerTabId('kira'), 'fgpt-tab-kira');
  assert.equal(customerPanelId('kira'), 'fgpt-panel-kira');
});

test('combo, strikes, ranks, share glyphs, and desktop layouts', () => {
  assert.equal(nextCombo(0, true, true), 1);
  assert.equal(nextCombo(3, true, true), 4);
  assert.equal(nextCombo(3, false, true), 0);
  assert.equal(nextCombo(3, true, false), 0);
  assert.deepEqual(applyStrike(2), { strikes: MAX_STRIKES, over: true });
  assert.equal(rankFor(0).title, 'Autocomplete Intern');
  assert.equal(rankFor(2000).title, 'AGI');
  assert.equal(shareGlyph({ correct: true }), '🟩');
  assert.equal(shareGlyph({ correct: true, late: true }), '🟨');
  assert.equal(shareGlyph({ empty: true }), '⬛');
  assert.equal(buildShareGrid(['🟩', '🟥', '🟨', '⬛', '🟪'], 4), '🟩🟥🟨⬛\n🟪');
  assert.equal(laneLayout(1), 'solo');
  assert.equal(laneLayout(2), 'pair');
  assert.equal(laneLayout(3), 'plus-one');
  assert.equal(laneLayout(4), 'grid');
  assert.equal(laneLayout(5), 'three-two');
});

test('desktop CSS keeps the tab bar and a single customer panel', () => {
  const css = readFileSync(new URL('../../../app/globals.css', import.meta.url), 'utf8');
  const desktop = css.split('@media (min-width: 860px)')[1] ?? '';
  assert.match(css, /\.fgpt-switcher\s*\{/);
  assert.equal(/\.fgpt-switcher\s*\{[^}]*display:\s*none/s.test(css), false);
  assert.equal(/\.fgpt-switcher\s*\{[^}]*display:\s*none/s.test(desktop), false);
  assert.equal(/\.fgpt-lanes\.is-pair\s*\{[^}]*grid-template-columns:\s*1fr 1fr/s.test(desktop), false);
  assert.match(desktop, /\.fgpt-lane:not\(\.is-focus\)\s*\{\s*display:\s*none/);
  assert.match(desktop, /\.fgpt-tab\s*\{[^}]*min-width:\s*11rem/s);
});
