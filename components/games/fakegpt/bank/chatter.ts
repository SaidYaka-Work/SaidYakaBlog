import { firstName } from '../lanes';
import { mulberry32, shuffle } from '../logic';

export const PRAISE = [
  'ok wait, {name} is screenshotting the void. that slaps.',
  '{name} will think about this in the shower.',
  'the board of imaginary users voted yes. {name} is pleased.',
  'this is the good kind of right. {name} is printing a mug.',
  '{name} does not understand how you knew that and that is why it works.',
  'gold star, plastic trophy, {name} is filing you under "keep".',
  '{name} just unclenched. continue existing.',
  'unexpectedly competent. {name} has updated the spreadsheet.',
  '{name} showed this to a houseplant. the houseplant nodded.',
  'latency: forgiven. accuracy: filed. {name} is sipping politely.',
  '{name} was ready to rage-quit and then you did a fact. rude, in a good way.',
  'the intern in {name} just high-fived the microwave.',
  '{name} will tell legal you defined "quickly" correctly.',
  'context window: soothed. {name} can wait one more request.',
  '{name} has marked this "do not hallucinate again, you already didn\'t".',
  'this is fridge-worthy. {name} is hunting a magnet.',
  '{name} whispered "finally" like a fax finding a dial tone.',
  'the stapler union has no notes. {name} is clocking you as employed.',
  '{name} is less on-call about this than they were ten seconds ago.',
  'correct, fast, faintly smug. {name} respects the bit.',
  '{name} will reuse this answer at a pub quiz and not credit you.',
  'the last cookie would have given you a crumb. {name} gives a thumbs-up.',
  '{name} just cancelled the backup model. you may stay.',
  'this slaps in a cubicle way. {name} is humming.',
  '{name} has moved you from "spinner" to "person who knows things".',
];

export const ROASTS = [
  "that's a hallucination, buddy. {name} asked a fact and got a vibe.",
  'wrong. confidently wrong. {name} considers this a model crime.',
  '{name} fact-checked you against a cereal box. the cereal box won.',
  '{name} requested wonder and received a shrug.',
  'this is giving first draft of a first draft. {name} will not hang it up.',
  'technically a tap. spiritually a shrug. {name} wanted the other one.',
  '{name} showed this to a houseplant. the houseplant looked away.',
  '{name} has already asked another model, mostly out of spite.',
  'the microwave beeped in disappointment. {name} agrees.',
  '{name} is one espresso past polite and you just added foam.',
  'unionized stapler says no. {name} is writing you up.',
  '{name} will define "quickly" as "not that".',
  'context window: bored. {name} is opening a ticket.',
  '{name} has moved you back to autocomplete intern.',
  'that option was a trap and you walked in. {name} left a cone.',
  '{name} is faxing this mistake to 1997 so history can laugh.',
  'the Roomba circled your answer and left. {name} took notes.',
  '{name} was calm until the spinner spun. it is spinning again.',
  'legal would like a word, {name} already used three.',
  '{name} is filing this under "creative nonfiction".',
  'wrong button, friend. {name} watched you do it in slow motion.',
  '{name} will remember this the next time someone says you are AI.',
  'the last cookie crumbled in solidarity with {name}.',
  '{name} needed a language, a number, or a day. you offered jazz.',
  'that was a choice. {name} is not required to like it.',
];

export const EMPTY_LINES = [
  '{name} asked for a tap and you handed them a vacuum.',
  'silence. elegant. useless. {name} is sending you to the model garden.',
  'this is the loading state of art. {name} is unsubscribing.',
  '{name} can wait, but not for a blank reply.',
];

export const LATE_LINES = [
  'you finished after the deadline. {name} says even the microwave is faster.',
  'the answer arrived like a fax from 1997. {name} already left.',
  'good attempt, terrible latency. {name} has asked another model.',
  '{name} watched the patience bar die and then you answered. bold.',
];

export const NUDGES = [
  'hello??',
  'are you still generating?',
  'my context window is getting bored',
  'any day now',
  '{name} is watching the spinner',
  'the stapler is tapping its foot',
  'please define "quickly"',
  'still here. still waiting.',
  'did you fall into a loading state?',
  'beep. that was {name}.',
];

export const JOIN_VIBES = [
  'one espresso past polite',
  'calm until the spinner spins',
  'fax-era impatient',
  'unionized and watching',
  'beeps, then judges',
  'half-charged and circling',
  'on-call and not sorry',
  'still in the machine',
  'crumbly, important',
  'please define "quickly"',
];

export function fillLine(template: string, name: string): string {
  return template.replace(/\{name\}/g, firstName(name));
}

export function pickChatter(pool: readonly string[], seed: number, name: string): string {
  const random = mulberry32(seed >>> 0);
  const line = shuffle(pool, random)[0] ?? pool[0];
  return fillLine(line, name);
}

export function dailyNudges(seed: number, name: string): string[] {
  const random = mulberry32((seed ^ 0x11d) >>> 0);
  return shuffle(NUDGES, random)
    .slice(0, 3)
    .map((line) => fillLine(line, name));
}
