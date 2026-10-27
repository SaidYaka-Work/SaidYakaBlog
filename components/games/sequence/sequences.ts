import type { SequenceSpec } from './types';

const MAX_SAFE = Number.MAX_SAFE_INTEGER;

function requireInteger(value: number, label: string): number {
  if (!Number.isInteger(value) || !Number.isSafeInteger(value)) {
    throw new Error(`Sequence: ${label} is not a safe integer (${value})`);
  }
  return value;
}

function take(count: number, generate: (n: number) => number): number[] {
  const out: number[] = [];
  for (let n = 1; n <= count; n += 1) {
    out.push(requireInteger(generate(n), `term ${n}`));
  }
  return out;
}

function recurrence(count: number, seed: number[], next: (prev: number[]) => number): number[] {
  const out = [...seed];
  while (out.length < count) {
    const value = next(out);
    out.push(requireInteger(value, `recurrence term ${out.length}`));
  }
  return out.slice(0, count);
}

function isPrime(n: number): boolean {
  if (n < 2 || !Number.isInteger(n)) return false;
  if (n % 2 === 0) return n === 2;
  if (n % 3 === 0) return n === 3;
  for (let i = 5; i * i <= n; i += 6) {
    if (n % i === 0 || n % (i + 2) === 0) return false;
  }
  return true;
}

function firstPrimes(count: number): number[] {
  const primes: number[] = [];
  for (let n = 2; primes.length < count; n += 1) {
    if (isPrime(n)) primes.push(n);
  }
  return primes;
}

function factorial(n: number): number {
  let value = 1;
  for (let i = 2; i <= n; i += 1) {
    value = requireInteger(value * i, `${n}!`);
  }
  return value;
}

function binomial(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  const kk = Math.min(k, n - k);
  let value = 1;
  for (let i = 1; i <= kk; i += 1) {
    value = requireInteger((value * (n - kk + i)) / i, `C(${n},${k})`);
  }
  return value;
}

function lookAndSay(term: string): string {
  let out = '';
  let i = 0;
  while (i < term.length) {
    let j = i;
    while (j < term.length && term[j] === term[i]) j += 1;
    out += String(j - i) + term[i];
    i = j;
  }
  return out;
}

function happyStep(n: number): number {
  let sum = 0;
  let value = n;
  while (value > 0) {
    const digit = value % 10;
    sum += digit * digit;
    value = Math.floor(value / 10);
  }
  return sum;
}

function isHappy(n: number): boolean {
  const seen = new Set<number>();
  let value = n;
  while (value !== 1 && !seen.has(value)) {
    seen.add(value);
    value = happyStep(value);
  }
  return value === 1;
}

function divisorCount(n: number): number {
  let count = 0;
  for (let i = 1; i * i <= n; i += 1) {
    if (n % i !== 0) continue;
    count += i * i === n ? 1 : 2;
  }
  return count;
}

function primeOmega(n: number): number {
  let remaining = n;
  let factors = 0;
  for (let p = 2; p * p <= remaining; p += 1) {
    while (remaining % p === 0) {
      factors += 1;
      remaining = Math.floor(remaining / p);
    }
  }
  if (remaining > 1) factors += 1;
  return factors;
}

function isAutomorphic(n: number): boolean {
  const square = n * n;
  if (square > MAX_SAFE) return false;
  const mod = 10 ** String(n).length;
  return square % mod === n;
}

function luckyNumbers(count: number): number[] {
  const span = Math.max(200, count * 40);
  let list: number[] = [];
  for (let n = 1; n <= span; n += 2) list.push(n);
  for (let i = 1; i < list.length; i += 1) {
    const strike = list[i];
    if (strike > list.length) break;
    list = list.filter((_, index) => (index + 1) % strike !== 0);
  }
  if (list.length < count) {
    throw new Error(`Sequence: lucky sieve only produced ${list.length} terms`);
  }
  return list.slice(0, count);
}

function highlyComposite(count: number): number[] {
  const out: number[] = [];
  let record = 0;
  for (let n = 1; out.length < count; n += 1) {
    const divisors = divisorCount(n);
    if (divisors > record) {
      out.push(n);
      record = divisors;
    }
  }
  return out;
}

function hammingNumbers(count: number): number[] {
  const out = [1];
  let i2 = 0;
  let i3 = 0;
  let i5 = 0;
  while (out.length < count) {
    const next = Math.min(out[i2] * 2, out[i3] * 3, out[i5] * 5);
    out.push(next);
    if (next === out[i2] * 2) i2 += 1;
    if (next === out[i3] * 3) i3 += 1;
    if (next === out[i5] * 5) i5 += 1;
  }
  return out;
}

function partitionNumbers(count: number): number[] {
  const p = [1];
  for (let n = 1; n < count; n += 1) {
    let sum = 0;
    for (let k = 1; ; k += 1) {
      const g1 = (k * (3 * k - 1)) / 2;
      const g2 = (k * (3 * k + 1)) / 2;
      if (g1 > n && g2 > n) break;
      const sign = k % 2 === 1 ? 1 : -1;
      if (g1 <= n) sum += sign * p[n - g1];
      if (g2 <= n) sum += sign * p[n - g2];
    }
    p.push(requireInteger(sum, `p(${n})`));
  }
  return p;
}

function bellNumbers(count: number): number[] {
  const out = [1];
  if (count <= 1) return out.slice(0, count);
  let prev = [1];
  out.push(1);
  while (out.length < count) {
    const row = [prev[prev.length - 1]];
    for (let i = 0; i < prev.length; i += 1) {
      row.push(row[i] + prev[i]);
    }
    prev = row;
    out.push(requireInteger(row[row.length - 1], `Bell ${out.length}`));
  }
  return out;
}

function catalanNumbers(count: number): number[] {
  const out = [1];
  for (let n = 1; n < count; n += 1) {
    const next = (out[n - 1] * 2 * (2 * n - 1)) / (n + 1);
    out.push(requireInteger(next, `Catalan ${n}`));
  }
  return out;
}

function motzkinNumbers(count: number): number[] {
  const out = [1, 1];
  for (let n = 2; n < count; n += 1) {
    const next = ((2 * n + 1) * out[n - 1] + (3 * n - 3) * out[n - 2]) / (n + 2);
    out.push(requireInteger(next, `Motzkin ${n}`));
  }
  return out.slice(0, count);
}

function derangements(count: number): number[] {
  const out = [1, 0];
  for (let n = 2; n < count; n += 1) {
    out.push(requireInteger((n - 1) * (out[n - 1] + out[n - 2]), `!${n}`));
  }
  return out.slice(0, count);
}

function golomb(count: number): number[] {
  const a = [0, 1];
  for (let n = 2; n <= count; n += 1) {
    a.push(1 + a[n - a[a[n - 1]]]);
  }
  return a.slice(1);
}

function kolakoski(count: number): number[] {
  const out = [1, 2, 2];
  let i = 2;
  while (out.length < count) {
    const next = out[out.length - 1] === 1 ? 2 : 1;
    const times = out[i];
    for (let k = 0; k < times && out.length < count; k += 1) {
      out.push(next);
    }
    i += 1;
  }
  return out.slice(0, count);
}

function recaman(count: number): number[] {
  const out = [0];
  const seen = new Set([0]);
  for (let n = 1; n < count; n += 1) {
    const back = out[n - 1] - n;
    const next = back > 0 && !seen.has(back) ? back : out[n - 1] + n;
    out.push(next);
    seen.add(next);
  }
  return out;
}

function lookAndSayNumbers(count: number): number[] {
  const out: number[] = [];
  let term = '1';
  for (let i = 0; i < count; i += 1) {
    const value = Number(term);
    out.push(requireInteger(value, `look-and-say ${i}`));
    term = lookAndSay(term);
  }
  return out;
}

function fibonacciFrom(count: number, a: number, b: number): number[] {
  return recurrence(count, [a, b], (prev) => prev[prev.length - 1] + prev[prev.length - 2]);
}

function pell(count: number): number[] {
  return recurrence(count, [0, 1], (prev) => 2 * prev[prev.length - 1] + prev[prev.length - 2]);
}

function padovan(count: number): number[] {
  return recurrence(count, [1, 1, 1], (prev) => prev[prev.length - 2] + prev[prev.length - 3]);
}

function perrin(count: number): number[] {
  return recurrence(count, [3, 0, 2], (prev) => prev[prev.length - 2] + prev[prev.length - 3]);
}

function narayanaCows(count: number): number[] {
  return recurrence(count, [1, 1, 1], (prev) => prev[prev.length - 1] + prev[prev.length - 3]);
}

function tribonacci(count: number): number[] {
  return recurrence(count, [1, 1, 1], (prev) => prev[prev.length - 1] + prev[prev.length - 2] + prev[prev.length - 3]);
}

function sylvester(count: number): number[] {
  return recurrence(count, [2], (prev) => {
    const last = prev[prev.length - 1];
    return last * (last - 1) + 1;
  });
}

function collatz(start: number, count: number): number[] {
  const out = [start];
  while (out.length < count) {
    const last = out[out.length - 1];
    out.push(last % 2 === 0 ? last / 2 : 3 * last + 1);
  }
  return out;
}

function filterNaturals(count: number, predicate: (n: number) => boolean): number[] {
  const out: number[] = [];
  for (let n = 1; out.length < count; n += 1) {
    if (predicate(n)) out.push(n);
  }
  return out;
}

/**
 * Curated famous integer sequences. `expected` is the shown prefix plus the answer,
 * checked against `generate` at import time.
 */
export const SPECS: SequenceSpec[] = [
  {
    id: 'fibonacci',
    name: 'Fibonacci numbers',
    category: 'recursive',
    shownCount: 6,
    generate: (count) => fibonacciFrom(count, 1, 1),
    expected: [1, 1, 2, 3, 5, 8, 13],
    rule: 'Each term is the sum of the two before it.',
    blurb:
      'Leonardo of Pisa described the sequence in Liber Abaci (1202) while counting rabbits. It is older than that name: Pingala’s Sanskrit prosody already used the same recurrence, and the ratio of neighbors approaches the golden ratio.',
    source: 'OEIS A000045 / Liber Abaci',
    categoryHint: 'A recurrence: later terms are built from earlier ones.',
    giveaway: 'Add the last two terms to get the next.',
  },
  {
    id: 'lucas',
    name: 'Lucas numbers',
    category: 'recursive',
    shownCount: 6,
    generate: (count) => fibonacciFrom(count, 2, 1),
    expected: [2, 1, 3, 4, 7, 11, 18],
    rule: 'Same recurrence as Fibonacci, but the sequence starts 2, 1 instead of 1, 1.',
    blurb:
      'Édouard Lucas studied this companion sequence in the 1870s while proving properties of Fibonacci numbers. Every other Lucas number is a Fibonacci number plus or minus another Fibonacci number, and L_n / F_n tends to √5.',
    source: 'OEIS A000032 / Lucas',
    categoryHint: 'A recurrence: later terms are built from earlier ones.',
    giveaway: 'Add the last two terms, as in Fibonacci, but the opening pair is 2, 1.',
  },
  {
    id: 'pell',
    name: 'Pell numbers',
    category: 'recursive',
    shownCount: 6,
    generate: (count) => pell(count + 1).slice(1),
    expected: [1, 2, 5, 12, 29, 70, 169],
    rule: 'Each term is twice the previous term plus the one before that.',
    blurb:
      'Pell numbers solve x² − 2y² = ±1, the Pell equation named after John Pell though the Indian mathematician Brahmagupta treated it centuries earlier. They give the best rational approximations to √2, the same way Fibonacci numbers approximate the golden ratio.',
    source: 'OEIS A000129 / Pell equation',
    categoryHint: 'A recurrence: later terms are built from earlier ones.',
    giveaway: 'The rule is a_{n} = 2a_{n-1} + a_{n-2}.',
  },
  {
    id: 'tribonacci',
    name: 'Tribonacci numbers',
    category: 'recursive',
    shownCount: 7,
    generate: tribonacci,
    expected: [1, 1, 1, 3, 5, 9, 17, 31],
    rule: 'Each term is the sum of the three before it.',
    blurb:
      'The three-term cousin of Fibonacci appears in tiling problems: the number of ways to tile a board with tiles of length 1, 2, and 3. Agronomist Mark Feinberg named it in 1963; the limiting ratio is the real root of x³ = x² + x + 1.',
    source: 'OEIS A000073 / Feinberg 1963',
    categoryHint: 'A recurrence: later terms are built from earlier ones.',
    giveaway: 'Add the last three terms to get the next.',
  },
  {
    id: 'padovan',
    name: 'Padovan numbers',
    category: 'recursive',
    shownCount: 8,
    generate: padovan,
    expected: [1, 1, 1, 2, 2, 3, 4, 5, 7],
    rule: 'Each term is the sum of the term two back and the term three back: a_n = a_{n-2} + a_{n-3}.',
    blurb:
      'Architect Richard Padovan studied this sequence while writing about the plastic number, a three-dimensional analogue of the golden ratio. Spirals of equilateral triangles whose side lengths are Padovan numbers close almost as neatly as the Fibonacci spiral of squares.',
    source: 'OEIS A000931 / Padovan',
    categoryHint: 'A recurrence: later terms are built from earlier ones.',
    giveaway: 'Skip the immediate predecessor: add the terms two and three places back.',
  },
  {
    id: 'jacobsthal',
    name: 'Jacobsthal numbers',
    category: 'recursive',
    shownCount: 6,
    generate: (count) => take(count, (n) => (2 ** n - (-1) ** n) / 3),
    expected: [1, 1, 3, 5, 11, 21, 43],
    rule: 'Each term is the previous term plus twice the one before that, or (2^{n-1} − (−1)^{n-1}) / 3.',
    blurb:
      'Ernst Jacobsthal introduced the sequence in 1919. It counts alternating-sign tilings and appears in the closed form of the number of ways to tile a 3 × (n−1) board with 1 × 1 and 2 × 2 tiles. The companion Jacobsthal–Lucas numbers play the same role Lucas numbers play for Fibonacci.',
    source: 'OEIS A001045 / Jacobsthal',
    categoryHint: 'A recurrence: later terms are built from earlier ones.',
    giveaway: 'The recurrence is a_n = a_{n-1} + 2 a_{n-2}.',
  },
  {
    id: 'perrin',
    name: 'Perrin numbers',
    category: 'recursive',
    shownCount: 8,
    generate: perrin,
    expected: [3, 0, 2, 3, 2, 5, 5, 7, 10],
    rule: 'Each term is the sum of the terms two and three places back, starting from 3, 0, 2.',
    blurb:
      'R. Perrin published the sequence in 1899. If n divides the n-th Perrin number, n is usually prime — a cheap probable-prime test that still lets a few composites (the Perrin pseudoprimes) slip through. The same recurrence with a different start is the Padovan sequence.',
    source: 'OEIS A001608 / Perrin 1899',
    categoryHint: 'A recurrence: later terms are built from earlier ones.',
    giveaway: 'Add the terms two back and three back; the opening triple is 3, 0, 2.',
  },
  {
    id: 'narayana-cows',
    name: 'Narayana’s cows',
    category: 'recursive',
    shownCount: 7,
    generate: narayanaCows,
    expected: [1, 1, 1, 2, 3, 4, 6, 9],
    rule: 'Each term is the previous term plus the term three places back: a cow has a calf every year, and each calf starts producing in its third year.',
    blurb:
      'The 14th-century Indian mathematician Narayana Pandita posed a cow-herd problem in the Gaṇita Kaumudī, three generations after Fibonacci’s rabbits. The sequence counts a herd that grows more slowly than Fibonacci because newborns wait two years before they calve.',
    source: 'OEIS A000930 / Narayana Pandita',
    categoryHint: 'A recurrence: later terms are built from earlier ones.',
    giveaway: 'Add the last term to the term three places back.',
  },
  {
    id: 'triangular',
    name: 'Triangular numbers',
    category: 'figurate',
    shownCount: 6,
    generate: (count) => take(count, (n) => (n * (n + 1)) / 2),
    expected: [1, 3, 6, 10, 15, 21, 28],
    rule: 'The n-th term is n(n + 1)/2, the number of dots in a triangle with n rows.',
    blurb:
      'These are the handshake numbers and the 1 + 2 + … + n sums Gauss is said to have computed as a schoolboy. Pythagoreans arranged pebbles into triangles; the same formula later counts combinations of n + 1 things taken two at a time.',
    source: 'OEIS A000217 / figurate numbers',
    categoryHint: 'Figurate numbers — counts of dots in a growing polygon or solid.',
    giveaway: 'The n-th term is the sum 1 + 2 + … + n.',
  },
  {
    id: 'squares',
    name: 'Square numbers',
    category: 'figurate',
    shownCount: 6,
    generate: (count) => take(count, (n) => n * n),
    expected: [1, 4, 9, 16, 25, 36, 49],
    rule: 'The n-th term is n².',
    blurb:
      'Squares are the oldest figurate numbers: a square of side n holds n² pebbles. Odd numbers pile up to make them — 1, 1+3, 1+3+5 — which is why the first differences here are the odd numbers. They sit at the center of Pythagoras, Diophantus, and every pixel grid.',
    source: 'OEIS A000290',
    categoryHint: 'Figurate numbers — counts of dots in a growing polygon or solid.',
    giveaway: 'These are 1², 2², 3², 4², …',
  },
  {
    id: 'cubes',
    name: 'Cube numbers',
    category: 'power',
    shownCount: 5,
    generate: (count) => take(count, (n) => n * n * n),
    expected: [1, 8, 27, 64, 125, 216],
    rule: 'The n-th term is n³.',
    blurb:
      'Nicomachus already listed cubes. A curious identity, known to the Pythagoreans and later to Nicomachus, says the n-th cube is a block of n consecutive odd numbers. Taxicab numbers, including Hardy and Ramanujan’s 1729, are sums of two cubes in more than one way.',
    source: 'OEIS A000578',
    categoryHint: 'Powers, or a simple closed form in n.',
    giveaway: 'These are 1³, 2³, 3³, 4³, …',
  },
  {
    id: 'pentagonal',
    name: 'Pentagonal numbers',
    category: 'figurate',
    shownCount: 6,
    generate: (count) => take(count, (n) => (n * (3 * n - 1)) / 2),
    expected: [1, 5, 12, 22, 35, 51, 70],
    rule: 'The n-th term is n(3n − 1)/2, the dots in a pentagon with n nested layers.',
    blurb:
      'Euler’s pentagonal-number theorem turns these into a generating function for integer partitions — the same numbers that appear with alternating signs in the recurrence for p(n). The generalized pentagonals 1, 2, 5, 7, 12, 15 are the indices where that recurrence looks.',
    source: 'OEIS A000326 / Euler',
    categoryHint: 'Figurate numbers — counts of dots in a growing polygon or solid.',
    giveaway: 'A pentagon of pebbles: n(3n − 1)/2.',
  },
  {
    id: 'hexagonal',
    name: 'Hexagonal numbers',
    category: 'figurate',
    shownCount: 5,
    generate: (count) => take(count, (n) => n * (2 * n - 1)),
    expected: [1, 6, 15, 28, 45, 66],
    rule: 'The n-th term is n(2n − 1). Every hexagonal number is also triangular.',
    blurb:
      'Hexagonal numbers sit on the triangular list: they are exactly the triangular numbers T_{2n−1}. Honeycomb packing and centered hexes are cousins, not the same sequence. The first few already include two perfect numbers, 6 and 28.',
    source: 'OEIS A000384',
    categoryHint: 'Figurate numbers — counts of dots in a growing polygon or solid.',
    giveaway: 'Closed form n(2n − 1); they are every other triangular number.',
  },
  {
    id: 'heptagonal',
    name: 'Heptagonal numbers',
    category: 'figurate',
    shownCount: 5,
    generate: (count) => take(count, (n) => (n * (5 * n - 3)) / 2),
    expected: [1, 7, 18, 34, 55, 81],
    rule: 'The n-th term is n(5n − 3)/2, the dots in a heptagon with n layers.',
    blurb:
      'Figurate numbers for seven-sided polygons appear in the same Diophantine family as triangular and pentagonal numbers. The general polygonal formula is n((s − 2)n − (s − 4))/2; for s = 7 that is n(5n − 3)/2.',
    source: 'OEIS A000566',
    categoryHint: 'Figurate numbers — counts of dots in a growing polygon or solid.',
    giveaway: 'A seven-sided figurate: n(5n − 3)/2.',
  },
  {
    id: 'octagonal',
    name: 'Octagonal numbers',
    category: 'figurate',
    shownCount: 5,
    generate: (count) => take(count, (n) => n * (3 * n - 2)),
    expected: [1, 8, 21, 40, 65, 96],
    rule: 'The n-th term is n(3n − 2), the dots in an octagon with n layers.',
    blurb:
      'Octagonal numbers are the s = 8 case of polygonal numbers. They grow a little faster than hexagonals and include 8, 21, and 40 — numbers that also show up independently as binomial coefficients and as Fibonacci neighbors.',
    source: 'OEIS A000567',
    categoryHint: 'Figurate numbers — counts of dots in a growing polygon or solid.',
    giveaway: 'An eight-sided figurate: n(3n − 2).',
  },
  {
    id: 'tetrahedral',
    name: 'Tetrahedral numbers',
    category: 'figurate',
    shownCount: 5,
    generate: (count) => take(count, (n) => (n * (n + 1) * (n + 2)) / 6),
    expected: [1, 4, 10, 20, 35, 56],
    rule: 'The n-th term is C(n + 2, 3) = n(n + 1)(n + 2)/6, a triangular pyramid of stacked triangular numbers.',
    blurb:
      'Cannonballs stacked in a tetrahedron produce these counts. They are binomial coefficients C(n+2, 3) and the partial sums of triangular numbers. The cannonball problem asks when a tetrahedral number is also square; the only solutions are 1 and 4900.',
    source: 'OEIS A000292',
    categoryHint: 'Figurate numbers — counts of dots in a growing polygon or solid.',
    giveaway: 'Partial sums of triangular numbers, or C(n + 2, 3).',
  },
  {
    id: 'pentatope',
    name: 'Pentatope numbers',
    category: 'figurate',
    shownCount: 5,
    generate: (count) => take(count, (n) => (n * (n + 1) * (n + 2) * (n + 3)) / 24),
    expected: [1, 5, 15, 35, 70, 126],
    rule: 'The n-th term is C(n + 3, 4), the 4-simplex numbers — tetrahedral numbers stacked into a pentachoron.',
    blurb:
      'These are the next dimension up from tetrahedral numbers, the binomial coefficients that sit on the fourth diagonal of Pascal’s triangle. They count 4-combinations and the number of terms in a degree-4 monomial of n + 1 variables.',
    source: 'OEIS A000332',
    categoryHint: 'Figurate numbers — counts of dots in a growing polygon or solid.',
    giveaway: 'Binomial coefficients C(n + 3, 4), one dimension above tetrahedral numbers.',
  },
  {
    id: 'centered-hex',
    name: 'Centered hexagonal numbers',
    category: 'figurate',
    shownCount: 5,
    generate: (count) => take(count, (n) => 3 * n * (n - 1) + 1),
    expected: [1, 7, 19, 37, 61, 91],
    rule: 'The n-th term is 3n(n − 1) + 1, a hexagon of rings around a single center dot.',
    blurb:
      'A honeycomb cell plus n − 1 hexagonal rings. They are also 6 T_{n−1} + 1, so every centered hex is one more than six times a triangular number. Hex grids in games and crystal lattices use the same count.',
    source: 'OEIS A003215',
    categoryHint: 'Figurate numbers — counts of dots in a growing polygon or solid.',
    giveaway: 'A point plus hexagonal rings: 3n(n − 1) + 1.',
  },
  {
    id: 'centered-square',
    name: 'Centered square numbers',
    category: 'figurate',
    shownCount: 5,
    generate: (count) => take(count, (n) => n * n + (n - 1) * (n - 1)),
    expected: [1, 5, 13, 25, 41, 61],
    rule: 'The n-th term is n² + (n − 1)², a square diamond around a center cell.',
    blurb:
      'These count squares rotated 45 degrees on a grid, or the taxicab disk of radius n − 1. They are one less than twice a triangular number of even index, and they appear as the number of points in the von Neumann neighborhood grown n − 1 steps.',
    source: 'OEIS A001844',
    categoryHint: 'Figurate numbers — counts of dots in a growing polygon or solid.',
    giveaway: 'Sum of two consecutive squares: n² + (n − 1)².',
  },
  {
    id: 'star',
    name: 'Star numbers',
    category: 'figurate',
    shownCount: 5,
    generate: (count) => take(count, (n) => 6 * n * (n - 1) + 1),
    expected: [1, 13, 37, 73, 121, 181],
    rule: 'The n-th term is 6n(n − 1) + 1, a hexagram built from a centered hexagon plus six triangular points.',
    blurb:
      'Star numbers are centered hexagrams: take a centered hexagon and attach a triangle to each side. Chinese checkers uses a hexagram board whose cell counts belong to this family. They grow twice as fast as centered hexagons.',
    source: 'OEIS A003154',
    categoryHint: 'Figurate numbers — counts of dots in a growing polygon or solid.',
    giveaway: 'A hexagram of cells: 6n(n − 1) + 1.',
  },
  {
    id: 'pronic',
    name: 'Pronic numbers',
    category: 'figurate',
    shownCount: 5,
    generate: (count) => take(count, (n) => n * (n + 1)),
    expected: [2, 6, 12, 20, 30, 42],
    rule: 'The n-th term is n(n + 1), the product of two consecutive integers — twice a triangular number.',
    blurb:
      'Also called oblong or rectangular numbers: they count the dots in an n-by-(n+1) rectangle. Because n and n+1 are coprime, a pronic number’s prime factors split cleanly between the two sides. They are the only numbers that are both figurate and “exactly twice triangular.”',
    source: 'OEIS A002378',
    categoryHint: 'Figurate numbers — counts of dots in a growing polygon or solid.',
    giveaway: 'Products of consecutive integers: 1×2, 2×3, 3×4, …',
  },
  {
    id: 'octahedral',
    name: 'Octahedral numbers',
    category: 'figurate',
    shownCount: 5,
    generate: (count) => take(count, (n) => (n * (2 * n * n + 1)) / 3),
    expected: [1, 6, 19, 44, 85, 146],
    rule: 'The n-th term is n(2n² + 1)/3, two square pyramids glued at the base — the octahedron.',
    blurb:
      'An octahedron of cannonballs is two square pyramids sharing a square. The formula also counts the number of planes that cut a 3-cube into n + 1 pieces along each axis in a related family of 3-d figurates. Closely related square-pyramidal numbers are 1, 5, 14, 30, 55.',
    source: 'OEIS A005900',
    categoryHint: 'Figurate numbers — counts of dots in a growing polygon or solid.',
    giveaway: 'Two square pyramids making an octahedron: n(2n² + 1)/3.',
  },
  {
    id: 'powers-of-two',
    name: 'Powers of two',
    category: 'power',
    shownCount: 6,
    generate: (count) => take(count, (n) => 2 ** (n - 1)),
    expected: [1, 2, 4, 8, 16, 32, 64],
    rule: 'Each term is twice the one before it: 2^{n−1}.',
    blurb:
      'The binary backbone of computing, wheat-and-chessboard fables, and the number of subsets of an n-element set. Euclid already used powers of two to build even perfect numbers: every known perfect number is 2^{p−1}(2^p − 1).',
    source: 'OEIS A000079',
    categoryHint: 'Powers, or a simple closed form in n.',
    giveaway: 'Keep doubling.',
  },
  {
    id: 'powers-of-three',
    name: 'Powers of three',
    category: 'power',
    shownCount: 5,
    generate: (count) => take(count, (n) => 3 ** (n - 1)),
    expected: [1, 3, 9, 27, 81, 243],
    rule: 'Each term is three times the one before it: 3^{n−1}.',
    blurb:
      'Powers of three index the balanced ternary system, where every integer has a unique representation with digits −1, 0, 1. They also count the nodes at a given depth of a complete ternary tree and the pieces of the Cantor set after n cuts.',
    source: 'OEIS A000244',
    categoryHint: 'Powers, or a simple closed form in n.',
    giveaway: 'Keep tripling.',
  },
  {
    id: 'powers-of-eleven',
    name: 'Powers of eleven',
    category: 'power',
    shownCount: 4,
    generate: (count) => take(count, (n) => 11 ** (n - 1)),
    expected: [1, 11, 121, 1331, 14641],
    rule: 'Each term is eleven times the one before it: 11^{n−1}.',
    blurb:
      'The first few powers of 11 reprint rows of Pascal’s triangle: 11² = 121, 11³ = 1331, 11⁴ = 14641. After that, carrying hides the pattern (11⁵ = 161051). The same binomial expansion is why (1 + 1)^{n} is less interesting than (10 + 1)^{n}.',
    source: 'OEIS A001020',
    categoryHint: 'Powers, or a simple closed form in n.',
    giveaway: 'Multiply by 11 each time; the early terms look like Pascal rows.',
  },
  {
    id: 'mersenne',
    name: 'Mersenne numbers',
    category: 'power',
    shownCount: 6,
    generate: (count) => take(count, (n) => 2 ** n - 1),
    expected: [1, 3, 7, 15, 31, 63, 127],
    rule: 'The n-th term is 2^n − 1, a string of n ones in binary.',
    blurb:
      'Marin Mersenne catalogued which of these can be prime. A Mersenne number 2^p − 1 can be prime only when p is prime, and those primes still generate the largest known primes and the even perfect numbers. Not every term here is prime — 15, 63, and friends are composite.',
    source: 'OEIS A000225 / Mersenne',
    categoryHint: 'Powers, or a simple closed form in n.',
    giveaway: 'One less than a power of two: 2^n − 1.',
  },
  {
    id: 'fermat',
    name: 'Fermat numbers',
    category: 'power',
    shownCount: 4,
    generate: (count) => take(count, (n) => 2 ** 2 ** (n - 1) + 1),
    expected: [3, 5, 17, 257, 65537],
    rule: 'The n-th term is 2^{2^{n−1}} + 1.',
    blurb:
      'Pierre de Fermat guessed that every number of this form is prime. The first five are — 3, 5, 17, 257, 65537 — and then F₅ = 2^{32} + 1 is divisible by 641, as Euler showed. Gauss proved a regular n-gon is constructible with compass and straightedge exactly when n is a product of a power of two and distinct Fermat primes.',
    source: 'OEIS A000215 / Fermat',
    categoryHint: 'Powers, or a simple closed form in n.',
    giveaway: 'Fermat’s 2^{2^k} + 1, starting at k = 0.',
  },
  {
    id: 'cullen',
    name: 'Cullen numbers',
    category: 'power',
    shownCount: 5,
    generate: (count) => take(count, (n) => (n - 1) * 2 ** (n - 1) + 1),
    expected: [1, 3, 9, 25, 65, 161],
    rule: 'The n-th term, indexing from 0, is n · 2^n + 1.',
    blurb:
      'James Cullen studied these in 1905. Almost all of them are composite; the first Cullen prime is 141 · 2^{141} + 1, far beyond this list. They sit next to the Woodall numbers n · 2^n − 1, the same shape with the opposite constant.',
    source: 'OEIS A002064 / Cullen 1905',
    categoryHint: 'Powers, or a simple closed form in n.',
    giveaway: 'The form is n · 2^n + 1, starting at n = 0.',
  },
  {
    id: 'woodall',
    name: 'Woodall numbers',
    category: 'power',
    shownCount: 4,
    generate: (count) => take(count, (n) => n * 2 ** n - 1),
    expected: [1, 7, 23, 63, 159],
    rule: 'The n-th term is n · 2^n − 1.',
    blurb:
      'A. J. C. Cunningham and H. J. Woodall studied n · 2^n − 1 in 1917. A few are prime (n = 2, 3, 6, 30, …). They pair with Cullen numbers the way Mersenne numbers pair with 2^n + 1.',
    source: 'OEIS A003261 / Woodall',
    categoryHint: 'Powers, or a simple closed form in n.',
    giveaway: 'The form is n · 2^n − 1, starting at n = 1.',
  },
  {
    id: 'thabit',
    name: 'Thabit numbers',
    category: 'power',
    shownCount: 5,
    generate: (count) => take(count, (n) => 3 * 2 ** (n - 1) - 1),
    expected: [2, 5, 11, 23, 47, 95],
    rule: 'The n-th term is 3 · 2^{n−1} − 1.',
    blurb:
      'Thābit ibn Qurra, writing in 9th-century Baghdad, used these numbers to construct amicable pairs: if p = 3 · 2^{n−1} − 1, q = 3 · 2^n − 1, and r = 9 · 2^{2n−1} − 1 are all prime, then 2^n pq and 2^n r are amicable. The rule still produces new pairs when the primality luck holds.',
    source: 'OEIS A055010 / Thābit ibn Qurra',
    categoryHint: 'Powers, or a simple closed form in n.',
    giveaway: 'Closed form 3 · 2^{n−1} − 1.',
  },
  {
    id: 'carol',
    name: 'Carol numbers',
    category: 'power',
    shownCount: 3,
    generate: (count) => take(count, (n) => (2 ** (n + 1) - 1) ** 2 - 2),
    expected: [7, 47, 223, 959],
    rule: 'The n-th term is (2^{n+1} − 1)² − 2, equivalently 2^{2n+2} − 2^{n+2} − 1.',
    blurb:
      'Carol numbers are a thin family of nearly Mersenne squares. A few are prime (7, 47, and then much larger ones). They are one of several 20th-century named variants on 2^a − 2^b − 1, sitting beside Cullen and Woodall numbers.',
    source: 'OEIS A093112',
    categoryHint: 'Powers, or a simple closed form in n.',
    giveaway: 'Square a Mersenne number 2^{n+1} − 1, then subtract 2.',
  },
  {
    id: 'factorials',
    name: 'Factorials',
    category: 'combinatorial',
    shownCount: 5,
    generate: (count) => take(count, (n) => factorial(n)),
    expected: [1, 2, 6, 24, 120, 720],
    rule: 'The n-th term is n!, the product 1 × 2 × … × n.',
    blurb:
      'Factorials count permutations: the ways to line up n distinct objects. Stirling and de Moivre extracted the n! ~ √(2πn) (n/e)^n approximation; the same sequence is the denominator of the exponential series and the reason 0! is defined to be 1.',
    source: 'OEIS A000142',
    categoryHint: 'These count discrete structures — arrangements, trees, partitions, paths.',
    giveaway: 'Multiply by the next integer each time: n!.',
  },
  {
    id: 'catalan',
    name: 'Catalan numbers',
    category: 'combinatorial',
    shownCount: 5,
    generate: (count) => catalanNumbers(count + 1).slice(1),
    expected: [1, 2, 5, 14, 42, 132],
    rule: 'The n-th Catalan number is C_n = (1/(n+1)) · C(2n, n). Shown here from C_1.',
    blurb:
      'Eugène Catalan studied them in 1838; Minggantu in 18th-century China and Segner a few years before Catalan already had the recurrence. They count correctly matched parentheses, binary trees, monotonic lattice paths that do not rise above the diagonal, and triangulations of a polygon.',
    source: 'OEIS A000108 / Catalan',
    categoryHint: 'These count discrete structures — arrangements, trees, partitions, paths.',
    giveaway: 'Catalan numbers C_n = C(2n, n)/(n+1), starting at C_1 = 1.',
  },
  {
    id: 'bell',
    name: 'Bell numbers',
    category: 'combinatorial',
    shownCount: 5,
    generate: (count) => bellNumbers(count + 1).slice(1),
    expected: [1, 2, 5, 15, 52, 203],
    rule: 'The n-th Bell number counts the partitions of an n-element set. B_{n} = Σ C(n−1, k) B_k.',
    blurb:
      'Eric Temple Bell studied them; the numbers themselves are older. B_n is the number of equivalence relations on n points and the coefficients of e^{e^x − 1}. The Bell triangle (Aitken’s array) builds each term by a simple “last entry becomes the next row’s start” rule.',
    source: 'OEIS A000110 / Bell',
    categoryHint: 'These count discrete structures — arrangements, trees, partitions, paths.',
    giveaway: 'Set partitions: the Bell numbers B_1, B_2, B_3, …',
  },
  {
    id: 'motzkin',
    name: 'Motzkin numbers',
    category: 'combinatorial',
    shownCount: 6,
    generate: (count) => motzkinNumbers(count + 1).slice(1),
    expected: [1, 2, 4, 9, 21, 51, 127],
    rule: 'Motzkin number M_n counts paths from (0,0) to (n,0) with steps (1,1), (1,−1), and (1,0) that never go below the axis. Shown from M_1.',
    blurb:
      'Theodore Motzkin introduced them in 1948. They sit between Catalan numbers (no level steps) and larger Schröder numbers (allowed long level steps). A useful recurrence is (n+2) M_n = (2n+1) M_{n−1} + (3n−3) M_{n−2}.',
    source: 'OEIS A001006 / Motzkin',
    categoryHint: 'These count discrete structures — arrangements, trees, partitions, paths.',
    giveaway: 'Motzkin numbers: lattice paths with up, down, and level steps.',
  },
  {
    id: 'central-binomial',
    name: 'Central binomial coefficients',
    category: 'combinatorial',
    shownCount: 5,
    generate: (count) => take(count, (n) => binomial(2 * n, n)),
    expected: [2, 6, 20, 70, 252, 924],
    rule: 'The n-th term is C(2n, n), the middle entry of the even rows of Pascal’s triangle. Shown from n = 1.',
    blurb:
      'Central binomials count shortest lattice paths on a square grid and appear in the generating function 1/√(1−4x). Catalan numbers are these divided by n+1. They also give the probability of a tie in 2n fair coin flips, up to a power of two.',
    source: 'OEIS A000984',
    categoryHint: 'These count discrete structures — arrangements, trees, partitions, paths.',
    giveaway: 'The middle binomial coefficients C(2n, n), starting at n = 1.',
  },
  {
    id: 'partition',
    name: 'Partition numbers',
    category: 'combinatorial',
    shownCount: 6,
    generate: (count) => partitionNumbers(count + 1).slice(1),
    expected: [1, 2, 3, 5, 7, 11, 15],
    rule: 'The n-th term is p(n), the number of ways to write n as a sum of positive integers ignoring order.',
    blurb:
      'Hardy and Ramanujan found the astonishing asymptotic for p(n); Rademacher later turned it into an exact series. Euler’s pentagonal-number theorem gives the recurrence used to compute these values. p(5) = 7 is small enough to list: 5, 4+1, 3+2, 3+1+1, 2+2+1, 2+1+1+1, 1+1+1+1+1.',
    source: 'OEIS A000041 / Euler, Hardy–Ramanujan',
    categoryHint: 'These count discrete structures — arrangements, trees, partitions, paths.',
    giveaway: 'Integer partitions p(n): how many unordered sums make n.',
  },
  {
    id: 'derangements',
    name: 'Derangements',
    category: 'combinatorial',
    shownCount: 4,
    generate: (count) => derangements(count + 2).slice(2),
    expected: [1, 2, 9, 44, 265],
    rule: 'The n-th term is !n, the number of permutations of n items with no fixed points. Shown from !2.',
    blurb:
      'The chapeau (hat-check) problem: n people check n hats, and none gets their own back. The count is the nearest integer to n!/e, which is why the probability tends to 1/e. Subfactorial notation !n is Pierre Montmort’s, from 1708.',
    source: 'OEIS A000166 / Montmort',
    categoryHint: 'These count discrete structures — arrangements, trees, partitions, paths.',
    giveaway: 'Subfactorials !n, permutations with no point left in place, starting at !2 = 1.',
  },
  {
    id: 'lazy-caterer',
    name: 'Lazy caterer’s sequence',
    category: 'combinatorial',
    shownCount: 6,
    generate: (count) => take(count, (n) => (n * (n - 1)) / 2 + 1),
    expected: [1, 2, 4, 7, 11, 16, 22],
    rule: 'The n-th term is n(n − 1)/2 + 1, the maximum pieces of a pancake (or pizza) with n − 1 cuts.',
    blurb:
      'Each new cut can cross every previous cut and so can add as many new pieces as there are cuts so far. The closed form is a triangular number plus one. The three-dimensional analogue is the cake numbers, which grow like n³/6.',
    source: 'OEIS A000124',
    categoryHint: 'These count discrete structures — arrangements, trees, partitions, paths.',
    giveaway: 'Maximum pieces with n − 1 cuts of a pancake: T_{n−1} + 1.',
  },
  {
    id: 'cake',
    name: 'Cake numbers',
    category: 'combinatorial',
    shownCount: 6,
    generate: (count) =>
      take(count, (n) => binomial(n - 1, 3) + binomial(n - 1, 2) + binomial(n - 1, 1) + 1),
    expected: [1, 2, 4, 8, 15, 26, 42],
    rule: 'The maximum pieces of a cake with n − 1 plane cuts is C(n−1, 3) + C(n−1, 2) + C(n−1, 1) + 1.',
    blurb:
      'A new plane can slice every previous plane in a fresh line and so cut every existing piece it meets. The formula is the 3-d cousin of the lazy caterer. After a handful of cuts the numbers already outrun naive doubling — the fifth cut makes 15 pieces, not 16.',
    source: 'OEIS A000125',
    categoryHint: 'These count discrete structures — arrangements, trees, partitions, paths.',
    giveaway: 'Maximum cake pieces by plane cuts: C(k,3)+C(k,2)+C(k,1)+1 with k cuts so far.',
  },
  {
    id: 'primorials',
    name: 'Primorials',
    category: 'prime',
    shownCount: 4,
    generate: (count) => {
      const primes = firstPrimes(count);
      const out: number[] = [];
      let acc = 1;
      for (const prime of primes) {
        acc = requireInteger(acc * prime, `primorial through ${prime}`);
        out.push(acc);
      }
      return out;
    },
    expected: [2, 6, 30, 210, 2310],
    rule: 'The n-th primorial n# is the product of the first n primes.',
    blurb:
      'Primorials are the factorial’s prime-only sibling. Euclid’s proof that there are infinitely many primes multiplies the first n primes and adds one; the primorial is that product. They also appear as the least common multiple of 1, 2, …, p_n and as the denominators of the first n terms of the Euler product for 1/ζ(s).',
    source: 'OEIS A002110',
    categoryHint: 'These are primes, or they are built from primes.',
    giveaway: 'Multiply the first n primes: 2, 2×3, 2×3×5, …',
  },
  {
    id: 'primes',
    name: 'Prime numbers',
    category: 'prime',
    shownCount: 6,
    generate: (count) => firstPrimes(count),
    expected: [2, 3, 5, 7, 11, 13, 17],
    rule: 'The primes: integers greater than 1 whose only positive divisors are 1 and themselves.',
    blurb:
      'Euclid proved there is no last prime; Euler’s zeta-function proof and Eratosthenes’ sieve are the other two classical doors into the same list. The gaps wander, the twins may or may not be infinite, and every integer greater than 1 factors uniquely into these.',
    source: 'OEIS A000040 / Euclid',
    categoryHint: 'These are primes, or they are built from primes.',
    giveaway: 'Ordinary primes, in order.',
  },
  {
    id: 'perfect',
    name: 'Perfect numbers',
    category: 'special',
    shownCount: 3,
    generate: (count) => {
      const out: number[] = [];
      for (let p = 2; out.length < count; p += 1) {
        if (!isPrime(p)) continue;
        const mersenne = 2 ** p - 1;
        if (!isPrime(mersenne)) continue;
        out.push(requireInteger(2 ** (p - 1) * mersenne, `perfect from p=${p}`));
      }
      return out;
    },
    expected: [6, 28, 496, 8128],
    rule: 'A perfect number equals the sum of its proper divisors. Even perfect numbers are 2^{p−1}(2^p − 1) for Mersenne primes p.',
    blurb:
      'The Pythagoreans prized 6 and 28. Euclid proved the even construction; Euler proved those are all the even perfect numbers. No odd perfect number is known, and if one exists it has at least 1,500 digits. Nicomachus listed the first four — exactly the terms of this puzzle.',
    source: 'OEIS A000396 / Euclid–Euler',
    categoryHint: 'A classical named family with a number-theoretic definition.',
    giveaway: 'Each equals the sum of its proper divisors: the even perfect numbers.',
  },
  {
    id: 'sophie-germain',
    name: 'Sophie Germain primes',
    category: 'prime',
    shownCount: 6,
    generate: (count) => filterNaturals(count, (n) => isPrime(n) && isPrime(2 * n + 1)),
    expected: [2, 3, 5, 11, 23, 29, 41],
    rule: 'A prime p such that 2p + 1 is also prime.',
    blurb:
      'Sophie Germain proved a special case of Fermat’s Last Theorem for these primes around 1823: if p is Sophie Germain, x^p + y^p = z^p has no solutions that avoid p. Safeprimes are the matching 2p + 1. They are also the primes for which you can run a step of the Sophie Germain descent on the class group.',
    source: 'OEIS A005384 / Germain',
    categoryHint: 'These are primes, or they are built from primes.',
    giveaway: 'Primes p for which 2p + 1 is also prime.',
  },
  {
    id: 'twin-primes',
    name: 'Lesser twin primes',
    category: 'prime',
    shownCount: 6,
    generate: (count) => filterNaturals(count, (n) => isPrime(n) && isPrime(n + 2)),
    expected: [3, 5, 11, 17, 29, 41, 59],
    rule: 'The smaller prime of each twin-prime pair (p, p + 2).',
    blurb:
      'Twin primes are pairs two apart: (3, 5), (5, 7), (11, 13), …. Euclid’s proof does not settle whether infinitely many remain; Zhang’s 2013 bounded-gap theorem and the Polymath follow-ups showed that some prime pairs stay within 246 forever, still short of 2. The first of each pair is this list.',
    source: 'OEIS A001359',
    categoryHint: 'These are primes, or they are built from primes.',
    giveaway: 'The first prime in each pair of primes that differ by 2.',
  },
  {
    id: 'semiprimes',
    name: 'Semiprimes',
    category: 'prime',
    shownCount: 7,
    generate: (count) => filterNaturals(count, (n) => primeOmega(n) === 2),
    expected: [4, 6, 9, 10, 14, 15, 21, 22],
    rule: 'Products of exactly two primes, not necessarily distinct — 4 = 2×2 counts.',
    blurb:
      'RSA moduli are huge semiprimes, chosen so that factoring them is hard. The sequence itself is just the integers with exactly two prime factors counted with multiplicity. Squares of primes (4, 9, 25) sit on the list beside 6, 10, and 15.',
    source: 'OEIS A001358',
    categoryHint: 'These are primes, or they are built from primes.',
    giveaway: 'Exactly two prime factors, counting repeats: 4, 6, 9, 10, …',
  },
  {
    id: 'squares-of-primes',
    name: 'Squares of primes',
    category: 'prime',
    shownCount: 5,
    generate: (count) => firstPrimes(count).map((p) => p * p),
    expected: [4, 9, 25, 49, 121, 169],
    rule: 'The square of the n-th prime.',
    blurb:
      'These are the only squares that are not divisible by a smaller square other than 1. They appear as the smallest numbers with an odd number of divisors that are not themselves squares of composites, and as the points where the step function of the prime-power lattice jumps on the diagonal.',
    source: 'OEIS A001248',
    categoryHint: 'These are primes, or they are built from primes.',
    giveaway: 'Square each prime: 2², 3², 5², 7², …',
  },
  {
    id: 'highly-composite',
    name: 'Highly composite numbers',
    category: 'special',
    shownCount: 8,
    generate: highlyComposite,
    expected: [1, 2, 4, 6, 12, 24, 36, 48, 60],
    rule: 'Each term has strictly more divisors than any smaller positive integer.',
    blurb:
      'Ramanujan defined highly composite numbers in 1915 and mailed the paper from India to Hardy. They are the record-setters for the divisor function d(n): 60 has twelve divisors, more than anything before it, which is one reason we inherited 60-minute hours from Babylonian counting.',
    source: 'OEIS A002182 / Ramanujan 1915',
    categoryHint: 'A classical named family with a number-theoretic definition.',
    giveaway: 'Record-setters for the number of divisors: Ramanujan’s highly composite numbers.',
  },
  {
    id: 'lucky',
    name: 'Lucky numbers',
    category: 'sieve',
    shownCount: 7,
    generate: luckyNumbers,
    expected: [1, 3, 7, 9, 13, 15, 21, 25],
    rule: 'Start with the odds. The next surviving number tells you the strike count; strike every that-th remaining entry, and repeat.',
    blurb:
      'Stanisław Ulam named them in the mid-1950s because a sieve like Eratosthenes, but driven by the survivors themselves, produces a prime-like sequence. Lucky numbers have their own twin pairs and a prime-number-theorem analogue. 1 is lucky; 5 is not, because the strike of 3 removed it.',
    source: 'OEIS A000959 / Ulam',
    categoryHint: 'A sieving process leaves these standing.',
    giveaway: 'Ulam’s lucky-number sieve: survivors name the next strike interval.',
    openingHint: 'A sieve, cousin to Eratosthenes, but the strike counts are the survivors themselves.',
  },
  {
    id: 'look-and-say',
    name: 'Look-and-say sequence',
    category: 'digital',
    shownCount: 5,
    generate: lookAndSayNumbers,
    expected: [1, 11, 21, 1211, 111221, 312211],
    rule: 'Read the previous term aloud by runs of digits: “one 1” becomes 11, “two 1s” becomes 21, “one 2, one 1” becomes 1211.',
    blurb:
      'John Conway analyzed the sequence in 1986 and found that its length grows by a constant λ ≈ 1.303577, the root of a degree-71 polynomial. He split every term into 92 “atoms” named after chemical elements — the cosmological theorem. The sequence never contains a digit larger than 3 if it starts at 1.',
    source: 'OEIS A005150 / Conway',
    categoryHint: 'The rule talks about digits, not algebraic growth.',
    giveaway: 'Say the digits in runs: how many of this digit, then how many of the next.',
    openingHint: 'Do not subtract neighbors. Read each term as a description of the one before it.',
  },
  {
    id: 'happy',
    name: 'Happy numbers',
    category: 'digital',
    shownCount: 6,
    generate: (count) => filterNaturals(count, isHappy),
    expected: [1, 7, 10, 13, 19, 23, 28],
    rule: 'Replace a number by the sum of the squares of its digits and repeat; the happy numbers are those that reach 1 rather than the 4–16–37 cycle.',
    blurb:
      'The name is recreational, but the dichotomy is rigid: every positive integer either falls to 1 or into the unique 4 → 16 → 37 → 58 → 89 → 145 → 42 → 20 → 4 loop. 7 is the smallest happy number after 1; 2 through 6 are all unhappy.',
    source: 'OEIS A007770',
    categoryHint: 'The rule talks about digits, not algebraic growth.',
    giveaway: 'Iterate the sum of squared digits; the ones that reach 1 are happy.',
    openingHint: 'First differences wander. The next term is decided by a digit game, not a gap.',
  },
  {
    id: 'automorphic',
    name: 'Automorphic numbers',
    category: 'digital',
    shownCount: 5,
    generate: (count) => filterNaturals(count, isAutomorphic),
    expected: [1, 5, 6, 25, 76, 376],
    rule: 'n² ends with the digits of n itself: 25² = 625, 76² = 5776, 376² = 141376.',
    blurb:
      'Automorphic (or curious) numbers are the integers that are their own last digits under squaring. In each number of digits there are at most two besides the trivial 0 and 1, coming from the idempotents of the ring of 10^k-adics: they solve n² ≡ n (mod 10^k). 625 and 376 are the five-digit pair.',
    source: 'OEIS A003226',
    categoryHint: 'The rule talks about digits, not algebraic growth.',
    giveaway: 'n squared ends with n: 5² = 25, 6² = 36, 25² = 625.',
    openingHint: 'Look at the last digits of the squares, not at the gaps.',
  },
  {
    id: 'recaman',
    name: 'Recamán’s sequence',
    category: 'special',
    shownCount: 7,
    generate: recaman,
    expected: [0, 1, 3, 6, 2, 7, 13, 20],
    rule: 'Start at 0. At step n, subtract n if that lands on a fresh positive integer; otherwise add n.',
    blurb:
      'Bernardo Recamán Santos defined the sequence; it became famous after Neil Sloane added it to the OEIS and after a Numberphile video set it to music. It is not known whether every nonnegative integer appears. The early backtrack from 6 to 2 is the signature that this is not a triangular list.',
    source: 'OEIS A005132 / Recamán',
    categoryHint: 'A classical named family with a number-theoretic definition.',
    giveaway: 'From a(n−1), try a(n−1) − n if that is new and positive; else add n.',
    openingHint: 'The sequence jumps backward once it can. The third gap is negative.',
  },
  {
    id: 'sylvester',
    name: 'Sylvester’s sequence',
    category: 'recursive',
    shownCount: 4,
    generate: sylvester,
    expected: [2, 3, 7, 43, 1807],
    rule: 'Each term is the product of all previous terms, plus one: equivalently a_{n+1} = a_n(a_n − 1) + 1, starting at 2.',
    blurb:
      'J. J. Sylvester used the sequence in 1880 to show that the greedy Egyptian-fraction expansion of 1 is infinite. The reciprocals satisfy 1/2 + 1/3 + 1/7 + 1/43 + 1/1807 + … = 1, a rapid series that proves the greedy unit-fraction algorithm does not always terminate in few terms.',
    source: 'OEIS A000058 / Sylvester 1880',
    categoryHint: 'A recurrence: later terms are built from earlier ones.',
    giveaway: 'Multiply all previous terms and add 1, or a(a − 1) + 1.',
  },
  {
    id: 'golomb',
    name: 'Golomb’s self-describing sequence',
    category: 'special',
    shownCount: 8,
    generate: golomb,
    expected: [1, 2, 2, 3, 3, 4, 4, 4, 5],
    rule: 'a(n) is the number of times n appears in the sequence. It is the unique nondecreasing sequence of positive integers with a(1) = 1 that describes its own run lengths this way.',
    blurb:
      'Solomon Golomb’s sequence (sometimes called Silverman’s) is a fixed point of a counting map: the value n occurs exactly a(n) times. A closed form uses the inverse of n ↦ n a(n). It grows like φ^{2−φ} n^{φ−1} where φ is the golden ratio.',
    source: 'OEIS A001462 / Golomb',
    categoryHint: 'A classical named family with a number-theoretic definition.',
    giveaway: 'n appears a(n) times. After two 2s come two 3s, then three 4s, …',
    openingHint: 'Runs get longer in a self-describing way: the value n tells you how often n occurs.',
  },
  {
    id: 'kolakoski',
    name: 'Kolakoski sequence',
    category: 'special',
    shownCount: 10,
    generate: kolakoski,
    expected: [1, 2, 2, 1, 1, 2, 1, 2, 2, 1, 2],
    rule: 'An infinite sequence of 1s and 2s whose run lengths are the sequence itself.',
    blurb:
      'William Kolakoski discussed it in 1965; Rufus Oldenburger had defined it in 1939. Whether the density of 1s tends to 1/2 is a famous open question. The sequence is one of the simplest finite automata that still resists a proof of equidistribution.',
    source: 'OEIS A000002 / Kolakoski',
    categoryHint: 'A classical named family with a number-theoretic definition.',
    giveaway: 'Only 1s and 2s; the run lengths replay the sequence: one 1, two 2s, two 1s, one 2, …',
    openingHint: 'You are looking at a sequence of 1s and 2s that describes its own run lengths.',
  },
  {
    id: 'collatz-seven',
    name: 'Collatz hailstone from 7',
    category: 'special',
    shownCount: 5,
    generate: (count) => collatz(7, count),
    expected: [7, 22, 11, 34, 17, 52],
    rule: 'If a term is even, halve it; if odd, replace it by 3n + 1. This is the orbit of 7.',
    blurb:
      'The Collatz (or 3n+1) conjecture says every positive integer eventually reaches 1 under this map. It is checked into the quintillions and still unproved. Hailstone sequences rise and fall; 27 is the famous long starter, but 7 already shows the odd-to-3n+1, even-to-half rhythm in a handful of terms.',
    source: 'OEIS A006370 / Collatz',
    categoryHint: 'A classical named family with a number-theoretic definition.',
    giveaway: 'The 3n+1 hailstone rule, starting at 7.',
    openingHint: 'Odds jump up, evens are halved. This is an orbit, not a closed form.',
  },
  {
    id: 'beatty-pi',
    name: 'Beatty sequence for π',
    category: 'special',
    shownCount: 7,
    generate: (count) => take(count, (n) => Math.floor(n * Math.PI)),
    expected: [3, 6, 9, 12, 15, 18, 21, 25],
    rule: 'The n-th term is floor(nπ). After a run that looks like multiples of 3, the fractional part of π finally carries over.',
    blurb:
      'Beatty’s theorem — posed as a problem by Samuel Beatty in 1926, and stated earlier by Rayleigh — says that if α and β are irrational and 1/α + 1/β = 1, the sequences ⌊nα⌋ and ⌊nβ⌋ partition the positive integers. Here α = π, so the complementary sequence is ⌊n π/(π−1)⌋. The eighth term is the first that is not 3n.',
    source: 'OEIS A022844 / Beatty',
    categoryHint: 'A classical named family with a number-theoretic definition.',
    giveaway: 'Floor of n times π. The first seven terms pretend to be 3, 6, 9, …',
    openingHint: 'The first differences are 3, 3, 3, 3, 3, 3 — and then they are not.',
  },
  {
    id: 'hamming',
    name: 'Hamming numbers',
    category: 'special',
    shownCount: 10,
    generate: hammingNumbers,
    expected: [1, 2, 3, 4, 5, 6, 8, 9, 10, 12, 15],
    rule: 'The 5-smooth numbers: positive integers of the form 2^a 3^b 5^c, in order.',
    blurb:
      'Dijkstra popularized them as a programming exercise under Hamming’s name: generate the numbers whose prime factors all lie in {2, 3, 5}. Regular numbers in Babylonian mathematics are the same family, because sexagesimal 60 = 2²·3·5 makes them the fractions with terminating sexagesimal expansions.',
    source: 'OEIS A051037 / Hamming, Dijkstra',
    categoryHint: 'A classical named family with a number-theoretic definition.',
    giveaway: '5-smooth numbers — only primes 2, 3, and 5 are allowed.',
    openingHint: 'Every integer is here until 7 is skipped; 11 and 13 never appear.',
  },
  {
    id: 'odd-squares',
    name: 'Odd squares',
    category: 'power',
    shownCount: 5,
    generate: (count) => take(count, (n) => (2 * n - 1) ** 2),
    expected: [1, 9, 25, 49, 81, 121],
    rule: 'The n-th term is (2n − 1)², the squares of the odd numbers.',
    blurb:
      'Odd squares are 1 mod 8, and they are the only squares that can be congruent to 1 mod 8. The gaps grow by 8 each time (8, 16, 24, 32, …), twice the even numbers, because (2k+1)² − (2k−1)² = 8k. They are also the centered octagonal numbers.',
    source: 'OEIS A016754',
    categoryHint: 'Powers, or a simple closed form in n.',
    giveaway: 'Squares of 1, 3, 5, 7, 9, …',
  },
  {
    id: 'alternating-factorial',
    name: 'Alternating factorials',
    category: 'combinatorial',
    shownCount: 5,
    generate: (count) =>
      take(count, (n) => {
        let sum = 0;
        let sign = 1;
        for (let k = n; k >= 1; k -= 1) {
          sum += sign * factorial(k);
          sign *= -1;
        }
        return sum;
      }),
    expected: [1, 1, 5, 19, 101, 619],
    rule: 'The n-th term is n! − (n−1)! + (n−2)! − ⋯ ± 1!.',
    blurb:
      'Alternating factorials grow almost as fast as n! and are prime for several small n (n = 3, 4, 5, 6, 7, 8, 10, 12). After that they are typically composite. They also count a signed permutation statistic and appear as the numerators when you write e as a rapidly alternating series of unit fractions of factorials.',
    source: 'OEIS A005165',
    categoryHint: 'These count discrete structures — arrangements, trees, partitions, paths.',
    giveaway: 'n! − (n−1)! + (n−2)! − … ± 1, starting at n = 1.',
  },
];
