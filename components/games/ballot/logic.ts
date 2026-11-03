import { HOWTO_RACE, RACES } from './races';
import type { Attempt, BallotGroup, Candidate, Grade, LessonStep, Mode, Pattern, Puzzle, Result, Round } from './types';

export const MAX_TRIES = 4;
export const MAX_SCORE = 100;
export const MAX_HINTS = 3;
export const LAUNCH_DATE = '2026-11-03';
export const ROTATION_SEED = 0xba1107;

const GRADE_LABEL: Record<Grade, string> = {
  first: 'First count',
  second: 'Second try',
  third: 'Third try',
  fourth: 'Last try',
  miss: 'The runoff held',
};

const GRADE_EMOJI: Record<Grade, string> = {
  first: '🎯',
  second: '✨',
  third: '🟢',
  fourth: '🟠',
  miss: '🔴',
};

const dailyCache = new Map<string, Puzzle>();

export function utcDate(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function dateSeed(date: string): number {
  const [year, month, day] = date.split('-').map(Number);
  return ((year * 10000 + month * 100 + day) ^ ROTATION_SEED) >>> 0;
}

export function mulberry32(seed: number) {
  return () => {
    let next = (seed += 0x6d2b79f5);
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

export function calendarDayIndex(date: string, launch = LAUNCH_DATE): number {
  const current = Date.parse(`${date}T00:00:00Z`);
  const origin = Date.parse(`${launch}T00:00:00Z`);
  return Math.floor((current - origin) / 86_400_000);
}

export function puzzleNumberForDate(date: string): number {
  return Math.max(1, calendarDayIndex(date) + 1);
}

export function addUtcDays(date: string, days: number): string {
  const next = new Date(`${date}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

export function isWeekend(date: string): boolean {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return day === 0 || day === 6;
}

export function voteWord(count: number) {
  return count === 1 ? 'vote' : 'votes';
}

export function ballotWord(count: number) {
  return count === 1 ? 'ballot' : 'ballots';
}

export function tryWord(count: number) {
  return count === 1 ? 'try' : 'tries';
}

export function candidateName(candidates: readonly Candidate[], id: string): string {
  return candidates.find((candidate) => candidate.id === id)?.name ?? id;
}

export function joinNames(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
}

export function formatRanking(candidates: readonly Candidate[], ranking: readonly string[]): string {
  return ranking.map((id) => candidateName(candidates, id)).join(' → ');
}

export function firstPlaceCounts(
  remaining: readonly string[],
  ballots: readonly BallotGroup[],
): Record<string, number> {
  const live = new Set(remaining);
  const counts: Record<string, number> = {};
  for (const id of remaining) counts[id] = 0;
  for (const group of ballots) {
    const pick = group.ranking.find((id) => live.has(id));
    if (pick) counts[pick] = (counts[pick] ?? 0) + group.count;
  }
  return counts;
}

export function totalVoters(ballots: readonly BallotGroup[]): number {
  return ballots.reduce((sum, group) => sum + group.count, 0);
}

export function normalizeBallots(ballots: readonly BallotGroup[]): BallotGroup[] {
  const merged = new Map<string, BallotGroup>();
  for (const group of ballots) {
    if (group.count <= 0) continue;
    const key = group.ranking.join('>');
    const current = merged.get(key);
    if (current) merged.set(key, { ranking: current.ranking, count: current.count + group.count });
    else merged.set(key, { ranking: [...group.ranking], count: group.count });
  }
  return Array.from(merged.values()).sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return a.ranking.join('>').localeCompare(b.ranking.join('>'));
  });
}

export function runInstantRunoff(
  candidateIds: readonly string[],
  ballots: readonly BallotGroup[],
): { rounds: Round[]; winner: string | null; clean: boolean } {
  let remaining = [...candidateIds];
  const rounds: Round[] = [];

  while (remaining.length > 0) {
    const counts = firstPlaceCounts(remaining, ballots);
    const total = remaining.reduce((sum, id) => sum + (counts[id] ?? 0), 0);
    const majority = Math.floor(total / 2) + 1;
    const ordered = [...remaining].sort((a, b) => {
      const diff = (counts[b] ?? 0) - (counts[a] ?? 0);
      if (diff !== 0) return diff;
      return a.localeCompare(b);
    });
    const top = ordered[0];
    const bottom = ordered[ordered.length - 1];
    const topVotes = counts[top] ?? 0;
    const bottomVotes = counts[bottom] ?? 0;
    const leaders = remaining.filter((id) => (counts[id] ?? 0) === topVotes);
    const trailers = remaining.filter((id) => (counts[id] ?? 0) === bottomVotes);
    const uniqueLeader = leaders.length === 1;
    const uniqueLast = trailers.length === 1;

    if (uniqueLeader && topVotes >= majority) {
      rounds.push({
        remaining: [...remaining],
        counts,
        total,
        majority,
        leader: top,
        eliminated: null,
        winner: top,
      });
      return { rounds, winner: top, clean: true };
    }

    if (remaining.length <= 2) {
      rounds.push({
        remaining: [...remaining],
        counts,
        total,
        majority,
        leader: uniqueLeader ? top : null,
        eliminated: null,
        winner: uniqueLeader ? top : null,
      });
      return { rounds, winner: uniqueLeader ? top : null, clean: uniqueLeader };
    }

    rounds.push({
      remaining: [...remaining],
      counts,
      total,
      majority,
      leader: uniqueLeader ? top : null,
      eliminated: uniqueLast ? bottom : null,
      winner: null,
    });
    if (!uniqueLast) return { rounds, winner: null, clean: false };
    remaining = remaining.filter((id) => id !== bottom);
  }

  return { rounds, winner: null, clean: false };
}

export function pluralityWinner(candidateIds: readonly string[], ballots: readonly BallotGroup[]): string | null {
  const counts = firstPlaceCounts(candidateIds, ballots);
  const top = Math.max(...candidateIds.map((id) => counts[id] ?? 0));
  const leaders = candidateIds.filter((id) => (counts[id] ?? 0) === top);
  return leaders.length === 1 ? leaders[0] : null;
}

export function pairwisePreference(a: string, b: string, ballots: readonly BallotGroup[]): number {
  let aOverB = 0;
  let bOverA = 0;
  for (const group of ballots) {
    const ia = group.ranking.indexOf(a);
    const ib = group.ranking.indexOf(b);
    if (ia < 0 || ib < 0) continue;
    if (ia < ib) aOverB += group.count;
    else if (ib < ia) bOverA += group.count;
  }
  return aOverB - bOverA;
}

export function condorcetWinner(candidateIds: readonly string[], ballots: readonly BallotGroup[]): string | null {
  for (const a of candidateIds) {
    if (candidateIds.every((b) => a === b || pairwisePreference(a, b, ballots) > 0)) return a;
  }
  return null;
}

export function classifyPattern(irv: string, plurality: string, condorcet: string | null): Pattern {
  if (condorcet && condorcet !== irv) return 'center-squeeze';
  if (irv !== plurality) return 'spoiler';
  return 'agree';
}

export function completeRankings(ballots: readonly BallotGroup[], candidateIds: readonly string[]): boolean {
  return ballots.every(
    (group) =>
      group.ranking.length === candidateIds.length &&
      candidateIds.every((id) => group.ranking.includes(id)) &&
      new Set(group.ranking).size === group.ranking.length,
  );
}

function firstRoundMajority(rounds: readonly Round[]): boolean {
  const first = rounds[0];
  if (!first) return false;
  return first.winner !== null && rounds.length === 1;
}

export function evaluateElection(
  candidates: readonly Candidate[],
  ballots: readonly BallotGroup[],
): Omit<Puzzle, 'id' | 'raceId' | 'title' | 'setting' | 'office' | 'hints' | 'blurb' | 'lesson'> | null {
  const ids = candidates.map((candidate) => candidate.id);
  const normalized = normalizeBallots(ballots);
  if (!normalized.length) return null;
  const voters = totalVoters(normalized);
  if (voters < 8 || voters > 12) return null;
  if (normalized.length > 10) return null;
  if (!completeRankings(normalized, ids)) return null;

  const runoff = runInstantRunoff(ids, normalized);
  const plurality = pluralityWinner(ids, normalized);
  if (!runoff.clean || !runoff.winner || !plurality) return null;
  if (firstRoundMajority(runoff.rounds)) return null;
  if (runoff.rounds.length < 2) return null;
  if (runoff.rounds.some((round) => round.eliminated === null && round.winner === null)) return null;

  const condorcet = condorcetWinner(ids, normalized);
  return {
    candidates,
    ballots: normalized,
    voters,
    rounds: runoff.rounds,
    irvWinner: runoff.winner,
    pluralityWinner: plurality,
    condorcetWinner: condorcet,
    pattern: classifyPattern(runoff.winner, plurality, condorcet),
  };
}

function namesOf(candidates: readonly Candidate[], ids: readonly string[]): string[] {
  return ids.map((id) => candidateName(candidates, id));
}

function hintsFor(
  candidates: readonly Candidate[],
  rounds: readonly Round[],
  irv: string,
  plurality: string,
): string[] {
  const first = rounds[0];
  const last = rounds[rounds.length - 1];
  const dropped = rounds.map((round) => round.eliminated).filter((id): id is string => Boolean(id));
  const firstOut = dropped[0];
  const firstOutVotes = firstOut ? (first.counts[firstOut] ?? 0) : 0;
  const hint1 = firstOut
    ? `${candidateName(candidates, firstOut)} finished last on the first count — ${firstOutVotes} first-choice ${voteWord(firstOutVotes)}.`
    : 'Look at who has the fewest first-choice marks.';

  const finalists = last?.remaining ?? [];
  const hint2 =
    dropped.length >= 2
      ? `Next out: ${candidateName(candidates, dropped[1])}.`
      : firstOut
        ? `After ${candidateName(candidates, firstOut)} drops, the runoff is ${joinNames(namesOf(candidates, finalists))}.`
        : `The final two are ${joinNames(namesOf(candidates, finalists))}.`;

  const hint3 =
    irv !== plurality
      ? `${candidateName(candidates, plurality)} led on first choices, but that is not who instant runoff elects.`
      : firstOut
        ? `Watch where ${candidateName(candidates, firstOut)}’s ballots go next — that transfer decides it.`
        : `The final two are ${joinNames(namesOf(candidates, finalists))}.`;

  return [hint1, hint2, hint3];
}

function lessonFor(
  candidates: readonly Candidate[],
  ballots: readonly BallotGroup[],
  rounds: readonly Round[],
  voters: number,
  irv: string,
  plurality: string,
  condorcet: string | null,
  pattern: Pattern,
): LessonStep[] {
  const irvName = candidateName(candidates, irv);
  const plurName = candidateName(candidates, plurality);
  const first = rounds[0];
  const majority = first?.majority ?? Math.floor(voters / 2) + 1;
  const firstOut = first?.eliminated;
  const firstOutName = firstOut ? candidateName(candidates, firstOut) : 'the last-place name';
  const firstOutVotes = firstOut ? (first.counts[firstOut] ?? 0) : 0;
  const transferLine = firstOut
    ? `${firstOutName} had ${firstOutVotes} first-choice ${voteWord(firstOutVotes)} and dropped first.`
    : 'Last place dropped first.';

  const steps: LessonStep[] = [
    {
      title: 'Instant runoff, in one breath',
      text: `Count first choices. A majority of ${voters} is ${majority}. Nobody had it. ${transferLine} Those ballots move to their next remaining pick, and you count again until someone does.`,
    },
  ];

  if (pattern === 'spoiler') {
    steps.push({
      title: 'Why plurality picked someone else',
      text: `${plurName} led on first choices, so a single-mark ballot would have elected ${plurName}. Instant runoff kept counting. When ${firstOutName} dropped, those next picks overtook ${plurName}. ${irvName} was sitting under a split that plurality never healed.`,
    });
    steps.push({
      title: 'The spoiler, in plain language',
      text: `A spoiler is a name that cannot win but peels first-choice marks off a similar rival. Under plurality, ${firstOutName} “spoiled” ${irvName} by splitting that side, and ${plurName} slipped through. Instant runoff lets those voters name a second choice, so the split closes.`,
    });
  } else if (pattern === 'center-squeeze') {
    const centerName = condorcet ? candidateName(candidates, condorcet) : firstOutName;
    steps.push({
      title: 'A Condorcet winner, dropped early',
      text: `${centerName} would have beaten every other candidate head-to-head — the person more voters prefer to each rival. Instant runoff never asked that pairwise question. ${centerName} had too few firsts and was eliminated, so a more polarizing name won.`,
    });
    steps.push({
      title: 'Center squeeze',
      text: `When two loud sides each have more firsts than a broadly liked middle, instant runoff can squeeze the middle out first. Plurality does the same. Pairwise counting would have kept ${centerName}. Different rules, different winners — none is the one fair answer, only a different question.`,
    });
  } else {
    steps.push({
      title: 'Same winner, longer path',
      text: `${plurName} led the first count and still won after transfers. Instant runoff and plurality asked different questions and happened to agree today. That is common — and not guaranteed.`,
    });
    steps.push({
      title: 'When they disagree',
      text: `Watch for a popular-enough third name whose second choices all lean one way. Plurality stops at first marks and can elect a leader who would lose a runoff. Instant runoff keeps going. A related failure, center squeeze, drops a broadly liked middle because they were nobody’s first.`,
    });
  }

  const pairNote =
    condorcet && condorcet !== irv
      ? ` Head-to-head, ${candidateName(candidates, condorcet)} beats every rival, including ${irvName}.`
      : condorcet === irv
        ? ` Head-to-head, ${irvName} also beats every rival — the Condorcet winner and the runoff winner match.`
        : ` These ballots have no Condorcet winner: every name loses at least one pairwise race.`;

  const path = rounds
    .map((round, index) => {
      const tally = round.remaining
        .slice()
        .sort((a, b) => (round.counts[b] ?? 0) - (round.counts[a] ?? 0))
        .map((id) => `${candidateName(candidates, id)} ${round.counts[id] ?? 0}`)
        .join(', ');
      if (round.winner) return `Round ${index + 1}: ${tally}. ${candidateName(candidates, round.winner)} has a majority.`;
      if (round.eliminated) {
        return `Round ${index + 1}: ${tally}. ${candidateName(candidates, round.eliminated)} is last and is dropped.`;
      }
      return `Round ${index + 1}: ${tally}.`;
    })
    .join(' ');

  steps.push({
    title: `This election’s count · ${rounds.length} ${rounds.length === 1 ? 'round' : 'rounds'}`,
    text: `${path}${pairNote} ${ballots.length} distinct rankings, ${voters} ${ballotWord(voters)}.`,
  });

  return steps;
}

function blurbFor(
  candidates: readonly Candidate[],
  irv: string,
  plurality: string,
  condorcet: string | null,
  pattern: Pattern,
): string {
  const irvName = candidateName(candidates, irv);
  const plurName = candidateName(candidates, plurality);
  if (pattern === 'spoiler') {
    return `${irvName} wins the runoff. ${plurName} had the most first-choice marks, so a plurality vote would have gone the other way — a classic spoiler split.`;
  }
  if (pattern === 'center-squeeze') {
    const center = condorcet ? candidateName(candidates, condorcet) : 'the squeezed name';
    return `${irvName} wins instant runoff, but ${center} would have beaten every rival head-to-head. The broadly liked name was nobody’s first and got squeezed out.`;
  }
  return `${irvName} led the first count and still won after transfers. Instant runoff and plurality asked different questions and agreed today.`;
}

function buildPuzzle(
  id: string,
  raceId: string,
  title: string,
  setting: string,
  office: string,
  evaluated: NonNullable<ReturnType<typeof evaluateElection>>,
): Puzzle {
  return {
    id,
    raceId,
    title,
    setting,
    office,
    ...evaluated,
    hints: hintsFor(evaluated.candidates, evaluated.rounds, evaluated.irvWinner, evaluated.pluralityWinner),
    blurb: blurbFor(
      evaluated.candidates,
      evaluated.irvWinner,
      evaluated.pluralityWinner,
      evaluated.condorcetWinner,
      evaluated.pattern,
    ),
    lesson: lessonFor(
      evaluated.candidates,
      evaluated.ballots,
      evaluated.rounds,
      evaluated.voters,
      evaluated.irvWinner,
      evaluated.pluralityWinner,
      evaluated.condorcetWinner,
      evaluated.pattern,
    ),
  };
}

function permutations<T>(items: readonly T[]): T[][] {
  if (items.length <= 1) return [items.slice()];
  const out: T[][] = [];
  items.forEach((item, index) => {
    const rest = items.filter((_, i) => i !== index);
    for (const tail of permutations(rest)) out.push([item, ...tail]);
  });
  return out;
}

function randomCounts(parts: number, total: number, random: () => number): number[] {
  const weights = Array.from({ length: parts }, () => random() + 0.12);
  const sum = weights.reduce((acc, value) => acc + value, 0);
  const floored = weights.map((weight) => Math.floor((weight / sum) * total));
  let left = total - floored.reduce((acc, value) => acc + value, 0);
  const order = shuffle(
    floored.map((_, index) => index),
    random,
  );
  let index = 0;
  while (left > 0) {
    floored[order[index % parts]] += 1;
    left -= 1;
    index += 1;
  }
  return floored;
}

function restOf(ids: readonly string[], used: readonly string[], random: () => number): string[] {
  return shuffle(
    ids.filter((id) => !used.includes(id)),
    random,
  );
}

function rankingOf(first: string, second: string, ids: readonly string[], random: () => number): string[] {
  return [first, second, ...restOf(ids, [first, second], random)];
}

function splitLeadStack(group: BallotGroup, alt: readonly string[], random: () => number): BallotGroup[] {
  if (group.count < 3 || random() < 0.45) return [group];
  const moved = 1 + Math.floor(random() * Math.min(2, group.count - 1));
  return [
    { ranking: group.ranking, count: group.count - moved },
    { ranking: alt, count: moved },
  ];
}

function firstsThree(voters: number, kind: Pattern): { lead: number; rival: number; third: number } | null {
  const majority = Math.floor(voters / 2) + 1;
  for (let lead = majority - 1; lead >= 3; lead -= 1) {
    for (let third = 1; third <= lead - 2; third += 1) {
      const rival = voters - lead - third;
      if (rival >= lead || rival <= third) continue;
      if (kind === 'spoiler' && rival + third <= lead) continue;
      if (kind !== 'spoiler' && lead + third <= rival) continue;
      return { lead, rival, third };
    }
  }
  return null;
}

function firstsFour(voters: number): { a: number; b: number; c: number; d: number } | null {
  const majority = Math.floor(voters / 2) + 1;
  const options = [
    { a: 4, b: 3, c: 3, d: 1 },
    { a: 5, b: 3, c: 2, d: 1 },
    { a: 4, b: 3, c: 2, d: 2 },
    { a: 5, b: 4, c: 2, d: 1 },
    { a: 4, b: 4, c: 3, d: 1 },
    { a: 5, b: 3, c: 3, d: 1 },
    { a: 4, b: 3, c: 3, d: 2 },
    { a: 6, b: 3, c: 2, d: 1 },
  ].filter((row) => row.a + row.b + row.c + row.d === voters && row.a < majority && row.d >= 1 && row.d < row.c);
  return options[0] ?? null;
}

function constructThree(
  candidates: readonly Candidate[],
  kind: Pattern,
  voters: number,
  random: () => number,
): BallotGroup[] | null {
  if (candidates.length !== 3) return null;
  const counts = firstsThree(voters, kind);
  if (!counts) return null;
  const [lead, rival, third] = shuffle(
    candidates.map((candidate) => candidate.id),
    random,
  );
  const ids = [lead, rival, third];

  if (kind === 'spoiler') {
    return normalizeBallots([
      ...splitLeadStack(
        { ranking: rankingOf(lead, rival, ids, random), count: counts.lead },
        rankingOf(lead, third, ids, random),
        random,
      ),
      { ranking: rankingOf(rival, third, ids, random), count: counts.rival },
      { ranking: rankingOf(third, rival, ids, random), count: counts.third },
    ]);
  }

  if (kind === 'center-squeeze') {
    return normalizeBallots([
      { ranking: rankingOf(lead, third, ids, random), count: counts.lead },
      { ranking: rankingOf(rival, third, ids, random), count: counts.rival },
      { ranking: rankingOf(third, lead, ids, random), count: counts.third },
    ]);
  }

  const rivalToLead = Math.max(1, Math.min(counts.rival - 1, 1 + Math.floor(random() * (counts.rival - 1))));
  return normalizeBallots([
    ...splitLeadStack(
      { ranking: rankingOf(lead, third, ids, random), count: counts.lead },
      rankingOf(lead, rival, ids, random),
      random,
    ),
    { ranking: rankingOf(rival, lead, ids, random), count: rivalToLead },
    { ranking: rankingOf(rival, third, ids, random), count: counts.rival - rivalToLead },
    { ranking: rankingOf(third, lead, ids, random), count: counts.third },
  ]);
}

function constructFour(
  candidates: readonly Candidate[],
  kind: Pattern,
  voters: number,
  random: () => number,
): BallotGroup[] | null {
  if (candidates.length !== 4) return null;
  const counts = firstsFour(voters);
  if (!counts) return null;
  const [lead, rival, third, fourth] = shuffle(
    candidates.map((candidate) => candidate.id),
    random,
  );
  const ids = [lead, rival, third, fourth];

  if (kind === 'spoiler') {
    return normalizeBallots([
      { ranking: rankingOf(lead, third, ids, random), count: counts.a },
      { ranking: rankingOf(rival, third, ids, random), count: counts.b },
      { ranking: rankingOf(third, rival, ids, random), count: counts.c },
      { ranking: rankingOf(fourth, third, ids, random), count: counts.d },
    ]);
  }

  if (kind === 'center-squeeze') {
    return normalizeBallots([
      { ranking: rankingOf(lead, third, ids, random), count: counts.a },
      { ranking: rankingOf(rival, third, ids, random), count: counts.b },
      { ranking: rankingOf(third, lead, ids, random), count: counts.c },
      { ranking: rankingOf(fourth, third, ids, random), count: counts.d },
    ]);
  }

  return normalizeBallots([
    { ranking: rankingOf(lead, rival, ids, random), count: counts.a },
    { ranking: rankingOf(rival, lead, ids, random), count: counts.b },
    { ranking: rankingOf(third, lead, ids, random), count: counts.c },
    { ranking: rankingOf(fourth, lead, ids, random), count: counts.d },
  ]);
}

function randomBallots(ids: readonly string[], voters: number, random: () => number): BallotGroup[] {
  const perms = permutations(ids);
  const take =
    ids.length === 3 ? perms : shuffle(perms, random).slice(0, 5 + Math.floor(random() * 4));
  const counts = randomCounts(take.length, voters, random);
  return normalizeBallots(take.map((ranking, index) => ({ ranking, count: counts[index] ?? 0 })));
}

function pickVoters(four: boolean, random: () => number): number {
  const pool = four ? [11, 12, 9] : [9, 11, 12];
  return pool[Math.floor(random() * pool.length)] ?? 9;
}

function pickKind(random: () => number, prefer?: Pattern): Pattern {
  if (prefer) return prefer;
  const roll = random();
  if (roll < 0.5) return 'spoiler';
  if (roll < 0.78) return 'center-squeeze';
  return 'agree';
}

function tryBuild(
  id: string,
  raceId: string,
  title: string,
  setting: string,
  office: string,
  candidates: readonly Candidate[],
  ballots: BallotGroup[] | null,
  want?: Pattern,
): Puzzle | null {
  if (!ballots) return null;
  const evaluated = evaluateElection(candidates, ballots);
  if (!evaluated) return null;
  if (want && evaluated.pattern !== want) return null;
  return buildPuzzle(id, raceId, title, setting, office, evaluated);
}

export function generatePuzzle(seed: number, four: boolean, id: string, prefer?: Pattern): Puzzle {
  const random = mulberry32(seed);
  const race = RACES[Math.floor(random() * RACES.length)] ?? RACES[0];
  const kind = pickKind(random, prefer);

  for (let attempt = 0; attempt < 48; attempt += 1) {
    const count = four ? 4 : 3;
    const candidates = shuffle(race.candidates, random).slice(0, count);
    const voters = pickVoters(four, random);
    const constructed = four
      ? constructFour(candidates, kind, voters, random)
      : constructThree(candidates, kind, voters, random);
    const built = tryBuild(id, race.id, race.title, race.setting, race.office, candidates, constructed, attempt < 12 ? kind : undefined);
    if (built) return built;
  }

  for (let attempt = 0; attempt < 80; attempt += 1) {
    const count = four ? 4 : 3;
    const candidates = shuffle(race.candidates, random).slice(0, count);
    const voters = pickVoters(four, random);
    const ballots = randomBallots(
      candidates.map((candidate) => candidate.id),
      voters,
      random,
    );
    const built = tryBuild(id, race.id, race.title, race.setting, race.office, candidates, ballots);
    if (built) return built;
  }

  return { ...FALLBACK_PUZZLE, id };
}

export const HOWTO_BALLOTS: BallotGroup[] = [
  { ranking: ['oak', 'ash', 'ivy'], count: 4 },
  { ranking: ['ivy', 'ash', 'oak'], count: 3 },
  { ranking: ['ash', 'ivy', 'oak'], count: 2 },
];

export const HOWTO_PUZZLE: Puzzle = (() => {
  const evaluated = evaluateElection(HOWTO_RACE.candidates, HOWTO_BALLOTS);
  if (!evaluated) throw new Error('Ballot: how-to Oak / Ivy / Ash must run a clean runoff');
  return buildPuzzle('ballot-how-to', HOWTO_RACE.id, HOWTO_RACE.title, HOWTO_RACE.setting, HOWTO_RACE.office, evaluated);
})();

const FALLBACK_FOUR_BALLOTS: BallotGroup[] = [
  { ranking: ['wren', 'maple', 'otter', 'comet'], count: 4 },
  { ranking: ['otter', 'maple', 'wren', 'comet'], count: 3 },
  { ranking: ['maple', 'otter', 'wren', 'comet'], count: 3 },
  { ranking: ['comet', 'maple', 'otter', 'wren'], count: 1 },
];

export const FALLBACK_PUZZLE: Puzzle = (() => {
  const race = RACES.find((item) => item.id === 'mascot') ?? RACES[0];
  const candidates = race.candidates;
  const evaluated = evaluateElection(candidates, FALLBACK_FOUR_BALLOTS);
  if (!evaluated) throw new Error('Ballot: fallback mascot election must run a clean runoff');
  return buildPuzzle('ballot-fallback', race.id, race.title, race.setting, race.office, evaluated);
})();

export function dailyPuzzle(date = utcDate()): Puzzle {
  const cached = dailyCache.get(date);
  if (cached) return cached;
  const puzzle = generatePuzzle(dateSeed(date), isWeekend(date), `ballot-${date}`);
  dailyCache.set(date, puzzle);
  return puzzle;
}

export function practicePuzzle(seed = Math.floor(Math.random() * 1_000_000_000), date = utcDate()): Puzzle {
  const today = dailyPuzzle(date);
  const four = seed % 5 === 0;
  const puzzle = generatePuzzle((seed ^ 0x9e3779b9) >>> 0, four, `ballot-practice-${seed >>> 0}`);
  if (fingerprint(puzzle) === fingerprint(today)) {
    return generatePuzzle((seed + 29) >>> 0, !four, `ballot-practice-${seed >>> 0}`);
  }
  return puzzle;
}

export function scoreAttempt(tries: number, solved: boolean): number {
  if (!solved) return 0;
  if (tries <= 1) return 100;
  if (tries === 2) return 80;
  if (tries === 3) return 55;
  return 30;
}

export function gradeFor(tries: number, solved: boolean): Grade {
  if (!solved) return 'miss';
  if (tries <= 1) return 'first';
  if (tries === 2) return 'second';
  if (tries === 3) return 'third';
  return 'fourth';
}

export function makeResult(puzzle: Puzzle, attempts: Attempt[], solved: boolean): Result {
  const tries = attempts.length;
  return {
    puzzle,
    attempts,
    solved,
    tries,
    points: scoreAttempt(tries, solved),
    grade: gradeFor(tries, solved),
  };
}

export function gradeLabel(grade: Grade) {
  return GRADE_LABEL[grade];
}

export function gradeEmoji(grade: Grade) {
  return GRADE_EMOJI[grade];
}

export function toneEmoji(hit: boolean) {
  return hit ? '🟩' : '⬛';
}

export function shareGrid(attempts: readonly Attempt[]): string {
  return attempts.map((attempt) => toneEmoji(attempt.hit)).join('');
}

export function shareLines(result: Result, mode: Mode, date: string): string[] {
  const title = mode === 'daily' ? `Ballot #${puzzleNumberForDate(date)}` : 'Ballot · practice';
  const winner = candidateName(result.puzzle.candidates, result.puzzle.irvWinner);
  const tries = result.solved ? `${result.tries}/${MAX_TRIES}` : `X/${MAX_TRIES}`;
  return [title, `🗳️ ${winner}`, shareGrid(result.attempts), `${tries} · ${result.points}/${MAX_SCORE}`];
}

export function unlockedHintCount(misses: number): number {
  return Math.min(MAX_HINTS, Math.max(0, misses));
}

export function parseGuess(raw: string, candidates: readonly Candidate[]): Candidate | null {
  const query = raw.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!query) return null;
  const exact = candidates.find((candidate) => candidate.name.toLowerCase() === query || candidate.id === query);
  if (exact) return exact;
  const starts = candidates.filter(
    (candidate) =>
      candidate.name.toLowerCase().startsWith(query) ||
      candidate.name.toLowerCase().split(/\s+/).some((part) => part.startsWith(query)),
  );
  if (starts.length === 1) return starts[0];
  return null;
}

export function fingerprint(puzzle: Puzzle): string {
  const rankings = puzzle.ballots.map((group) => `${group.count}:${group.ranking.join('>')}`).join(';');
  return `${puzzle.raceId}|${puzzle.candidates.map((candidate) => candidate.id).join(',')}|${puzzle.irvWinner}|${puzzle.pluralityWinner}|${rankings}`;
}

export function orderedRemaining(round: Round): string[] {
  return [...round.remaining].sort((a, b) => {
    const diff = (round.counts[b] ?? 0) - (round.counts[a] ?? 0);
    if (diff !== 0) return diff;
    return a.localeCompare(b);
  });
}

export { RACES, HOWTO_RACE };
