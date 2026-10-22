# FakeGPT question bank

Static multiple-choice jobs for the daily shift. No Worker, no live model.

## File format

Add questions as JSON arrays in `data/<kind>.json`. Each object:

```json
{
  "id": "trivia-cap-france",
  "kind": "translate|trivia|math|unit|weekday|spell|unscramble|order|tone|fill",
  "category": "geography",
  "difficulty": 1,
  "text": "what is the capital of France?",
  "options": ["Paris", "Lyon", "Marseille", "Nice"],
  "answer": "Paris"
}
```

Rules the validator enforces:

- `id` is unique kebab-case with a kind-style prefix (`trivia-cap-france`)
- exactly four options, no duplicates after normalize
- exactly one option matches `answer`
- the prompt does not contain the answer (so the line cannot give the key away)
- no option is a longer/shorter copy of the answer
- `fill` questions include a `___` blank
- family-friendly wording

`kind` values:

| kind | meaning |
| --- | --- |
| translate | name the language |
| trivia | evergreen fact |
| math | arithmetic |
| unit | unit conversion |
| weekday | calendar arithmetic |
| spell | pick the real spelling |
| unscramble | unjumble a word |
| order | pick the correct sequence |
| tone | pick the better reply |
| fill | fill the blank |

Skip time-sensitive facts (current officeholders, live records, changing moon counts).

## Regenerating from fact tables

```bash
node --import ./workers/fakegpt/node_modules/tsx/dist/loader.mjs scripts/fakegpt-build-bank.ts
```

That writes `data/*.json` from authored lists in the script. Review the diff, then run the checker.

## Checking a PR that adds questions

```bash
node --import ./workers/fakegpt/node_modules/tsx/dist/loader.mjs scripts/fakegpt-check.ts
npm --prefix workers/fakegpt test
```

A daily or weekly job can append verified objects to the matching `data/*.json` file and open a PR. The checker will reject leaked keys, duplicate ids, and bad option sets.

Code-generated puzzles (math, units, weekday, spelling, unscramble, order) live in `puzzles.ts` and are mixed into each daily set so the board does not run out when the rolling 60-day window has used a bank id.
