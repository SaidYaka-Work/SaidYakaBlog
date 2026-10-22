export type DailyPersona = {
  id: string;
  name: string;
  vibe: string;
};

export type QueuedTask = {
  id: string;
  difficulty?: 1 | 2 | 3;
};

export const MAX_CUSTOMERS = 5;
export const MAX_LEVEL = 5;
export const MAX_STRIKES = 3;
export const MIN_START_CUSTOMERS = 1;
export const MAX_START_CUSTOMERS = 2;

export const PERSONA_BANK: DailyPersona[] = [
  { id: 'kira', name: 'Kira the intern', vibe: 'one espresso past polite' },
  { id: 'dana', name: 'Dana', vibe: 'calm until the spinner spins' },
  { id: 'modem', name: 'Uncle Modem', vibe: 'fax-era impatient' },
  { id: 'stapler', name: 'a sentient stapler', vibe: 'unionized and watching' },
  { id: 'microwave', name: 'the microwave', vibe: 'beeps, then judges' },
  { id: 'roomba', name: 'Roomba 4', vibe: 'half-charged and circling' },
  { id: 'sysadmin', name: 'a tired sysadmin', vibe: 'on-call and not sorry' },
  { id: 'fax', name: 'Fax from 1997', vibe: 'still in the machine' },
  { id: 'cookie', name: 'the last cookie', vibe: 'crumbly, important' },
  { id: 'glen', name: 'Glen from legal', vibe: 'please define "quickly"' },
];

export type PlannedCustomer<T extends QueuedTask = QueuedTask> = DailyPersona & {
  hue: number;
  queue: T[];
};

export type ActiveRequestClock = {
  remainingMs: number;
  patience: number;
  expired: boolean;
};

/** Level 1 starts with 1 or 2 customers, alternating by daily seed. */
export function startCustomerCount(seed: number): number {
  return seed % 2 === 0 ? MAX_START_CUSTOMERS : MIN_START_CUSTOMERS;
}

/** Add about one customer per level, cap at 4–5. */
export function customersForLevel(level: number, seed: number): number {
  const safe = Math.max(1, Math.floor(Number.isFinite(level) ? level : 1));
  return Math.min(MAX_CUSTOMERS, startCustomerCount(seed) + (safe - 1));
}

export function customersJoiningAtLevel(level: number, seed: number): number {
  if (level <= 1) return 0;
  return Math.max(0, customersForLevel(level, seed) - customersForLevel(level - 1, seed));
}

export function levelServeGoal(level: number): number {
  return 4 + Math.max(1, Math.floor(level));
}

export function levelSurviveMs(level: number): number {
  return (30 + Math.max(1, Math.floor(level)) * 6) * 1000;
}

export function isLevelComplete(served: number, elapsedMs: number, level: number): boolean {
  return served >= levelServeGoal(level) || elapsedMs >= levelSurviveMs(level);
}

export function isRunComplete(level: number): boolean {
  return level >= MAX_LEVEL;
}

export function patienceMs(level: number, difficulty: 1 | 2 | 3 = 2): number {
  const base = 20000 - (Math.max(1, Math.floor(level)) - 1) * 1800;
  const scale = difficulty === 1 ? 1.15 : difficulty === 3 ? 0.82 : 1;
  return Math.max(8000, Math.round(base * scale));
}

export function spawnDelayMs(level: number, activeCustomers: number): number {
  return Math.max(2800, 8200 - (Math.max(1, level) - 1) * 700 - Math.max(0, activeCustomers - 1) * 500);
}

export function nextCombo(combo: number, correct: boolean, onTime: boolean): number {
  if (!correct || !onTime) return 0;
  return Math.max(0, combo) + 1;
}

export function applyStrike(strikes: number): { strikes: number; over: boolean } {
  const next = Math.min(MAX_STRIKES, Math.max(0, strikes) + 1);
  return { strikes: next, over: next >= MAX_STRIKES };
}

export function tickRequest(startedAt: number, totalMs: number, now: number): ActiveRequestClock {
  const remainingMs = Math.max(0, startedAt + totalMs - now);
  const patience = totalMs > 0 ? remainingMs / totalMs : 0;
  return { remainingMs, patience, expired: remainingMs <= 0 };
}

export function firstName(name: string): string {
  const cleaned = name.replace(/^(a|the)\s+/i, '').trim();
  return cleaned.split(/[\s,]/)[0] || name;
}

export function joinNotice(name: string): string {
  return `🟢 ${firstName(name)} joined the chat`;
}

export function fillPersonas(incoming: readonly DailyPersona[], seed: number): DailyPersona[] {
  const picked: DailyPersona[] = [];
  const used = new Set<string>();
  const take = (row: DailyPersona | undefined) => {
    if (!row?.name || picked.length >= MAX_CUSTOMERS) return;
    const key = row.name.trim().toLowerCase();
    if (used.has(key)) return;
    used.add(key);
    picked.push({
      id: row.id || `p${picked.length + 1}`,
      name: row.name.trim().slice(0, 40),
      vibe: (row.vibe || PERSONA_BANK[picked.length % PERSONA_BANK.length].vibe).slice(0, 80),
    });
  };
  for (const row of incoming) take(row);
  const offset = seed % PERSONA_BANK.length;
  for (let i = 0; i < PERSONA_BANK.length && picked.length < MAX_CUSTOMERS; i += 1) {
    take(PERSONA_BANK[(offset + i) % PERSONA_BANK.length]);
  }
  return picked;
}

/** Round-robin today's tasks across the max roster so late joiners already have a queue. */
export function planRun<T extends QueuedTask>(
  personas: readonly DailyPersona[],
  tasks: readonly T[],
  seed: number,
): PlannedCustomer<T>[] {
  const roster = fillPersonas(personas, seed);
  const queues: T[][] = Array.from({ length: MAX_CUSTOMERS }, () => []);
  tasks.forEach((task, index) => {
    queues[index % MAX_CUSTOMERS]?.push(task);
  });
  return roster.map((persona, index) => ({
    ...persona,
    hue: (index * 67 + (seed % 40)) % 360,
    queue: queues[index] ?? [],
  }));
}

export function activePlan<T extends QueuedTask>(
  plan: readonly PlannedCustomer<T>[],
  level: number,
  seed: number,
): PlannedCustomer<T>[] {
  return plan.slice(0, customersForLevel(level, seed));
}

export function newlyJoined<T extends QueuedTask>(
  plan: readonly PlannedCustomer<T>[],
  level: number,
  seed: number,
): PlannedCustomer<T>[] {
  const prev = customersForLevel(Math.max(1, level - 1), seed);
  const next = customersForLevel(level, seed);
  return plan.slice(prev, next);
}

export type LaneLayout = 'solo' | 'pair' | 'plus-one' | 'grid' | 'three-two';

export function laneLayout(count: number): LaneLayout {
  if (count <= 1) return 'solo';
  if (count === 2) return 'pair';
  if (count === 3) return 'plus-one';
  if (count === 4) return 'grid';
  return 'three-two';
}

export function shareGlyph(opts: { correct?: boolean; empty?: boolean; late?: boolean; bonus?: boolean }): string {
  if (opts.empty) return '⬛';
  if (!opts.correct) return '🟥';
  if (opts.bonus) return '🟪';
  if (opts.late) return '🟨';
  return '🟩';
}

export function buildShareGrid(glyphs: readonly string[], columns = 4): string {
  const rows: string[] = [];
  for (let i = 0; i < glyphs.length; i += columns) {
    rows.push(glyphs.slice(i, i + columns).join(''));
  }
  return rows.join('\n');
}

export const RANKS = [
  { min: 0, title: 'Autocomplete Intern' },
  { min: 220, title: 'Prompt Plumber' },
  { min: 480, title: 'Context Janitor' },
  { min: 800, title: 'Fine-Tune Temp' },
  { min: 1200, title: 'Latency Legend' },
  { min: 1700, title: 'AGI' },
] as const;

export function rankFor(score: number): { title: string; min: number } {
  let rank: { title: string; min: number } = RANKS[0];
  for (const row of RANKS) {
    if (score >= row.min) rank = row;
  }
  return rank;
}

export function comboPoints(base: number, combo: number): number {
  if (combo < 2) return base;
  return base + (combo - 1) * 15;
}
