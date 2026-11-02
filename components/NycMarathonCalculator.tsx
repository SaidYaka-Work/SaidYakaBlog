'use client';

import { useId, useMemo, useState } from 'react';
import {
  DEFAULT_COURSE,
  DEFAULT_RIEGEL_EXPONENT,
  DISTANCE_PRESETS_KM,
  buildSplits,
  estimateFinish,
  formatHms,
  formatPace,
  kmFromMiles,
  milesFromKm,
  parseHms,
  type CourseFlags,
  type Crowding,
  type DistancePreset,
  type EffortPlan,
  type SplitMode,
  type Training,
  type Unit,
  type Weather,
} from '@/lib/nyc-marathon';

const PRESETS: { id: DistancePreset; label: string }[] = [
  { id: '5k', label: '5K' },
  { id: '10k', label: '10K' },
  { id: 'half', label: 'Half' },
  { id: 'custom', label: 'Custom' },
];

const COURSE_TOGGLES: { id: keyof CourseFlags; label: string }[] = [
  { id: 'bridges', label: 'Bridges' },
  { id: 'firstAve', label: 'First Ave' },
  { id: 'fifthAve', label: 'Fifth Ave' },
  { id: 'centralPark', label: 'Central Park' },
];

const CROWDING: { id: Crowding; label: string }[] = [
  { id: 'open', label: 'Open' },
  { id: 'typical', label: 'Typical' },
  { id: 'dense', label: 'Dense' },
];

const WEATHER: { id: Weather; label: string }[] = [
  { id: 'cool', label: 'Cool' },
  { id: 'mild', label: 'Mild' },
  { id: 'warm', label: 'Warm' },
  { id: 'hot', label: 'Hot' },
];

const TRAINING: { id: Training; label: string }[] = [
  { id: 'strong', label: 'Strong' },
  { id: 'consistent', label: 'Consistent' },
  { id: 'thin', label: 'Thin' },
];

const inputClass =
  'min-h-12 w-full rounded-2xl border border-[var(--line)] bg-[var(--bg)] px-3 font-serif text-xl tabular-nums tracking-tight text-[var(--ink)] outline-none focus-visible:border-[var(--accent)]';

export default function NycMarathonCalculator() {
  const uid = useId();
  const [units, setUnits] = useState<Unit>('mi');
  const [preset, setPreset] = useState<DistancePreset>('half');
  const [customKm, setCustomKm] = useState(25);
  const [hours, setHours] = useState(1);
  const [minutes, setMinutes] = useState(45);
  const [seconds, setSeconds] = useState(0);
  const [exponent, setExponent] = useState(DEFAULT_RIEGEL_EXPONENT);
  const [course, setCourse] = useState<CourseFlags>({ ...DEFAULT_COURSE });
  const [crowding, setCrowding] = useState<Crowding>('typical');
  const [weather, setWeather] = useState<Weather>('cool');
  const [training, setTraining] = useState<Training>('consistent');
  const [splitMode, setSplitMode] = useState<SplitMode>('5k');
  const [plan, setPlan] = useState<EffortPlan>('even-effort');

  const distanceKm =
    preset === 'custom' ? customKm : DISTANCE_PRESETS_KM[preset];
  const timeSeconds = parseHms(hours, minutes, seconds);
  const customDisplay =
    units === 'mi' ? roundDisplay(milesFromKm(customKm), 2) : roundDisplay(customKm, 2);

  const result = useMemo(
    () =>
      estimateFinish({
        distanceKm,
        timeSeconds,
        exponent,
        course,
        crowding,
        weather,
        training,
      }),
    [course, crowding, distanceKm, exponent, timeSeconds, training, weather]
  );

  const splits = useMemo(
    () => (result ? buildSplits(result.nycSeconds, splitMode, plan) : []),
    [plan, result, splitMode]
  );

  function handleCustomDistance(value: string) {
    const next = Number(value);
    if (!Number.isFinite(next) || next < 0) return;
    setCustomKm(units === 'mi' ? kmFromMiles(next) : next);
  }

  return (
    <section
      data-reveal
      aria-label="NYC Marathon finish-time calculator"
      className="not-prose my-10 overflow-hidden rounded-[1.6rem] border border-[var(--line)] bg-[var(--bg-elevated)]"
    >
      <div className="flex flex-col gap-4 border-b border-[var(--line)] px-4 py-5 sm:flex-row sm:items-start sm:justify-between sm:px-6">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-[var(--accent)]">Calculator</p>
          <h2 className="mt-2 font-serif text-3xl tracking-tight text-[var(--ink)]">
            NYC finish time
          </h2>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-[var(--muted)]">
            Same napkin as the post. A recent race, then New York and the training you actually did.
          </p>
        </div>
        <Segmented
          label="Units"
          value={units}
          options={[
            { id: 'mi', label: 'Miles' },
            { id: 'km', label: 'Km' },
          ]}
          onChange={setUnits}
        />
      </div>

      <div className="grid gap-6 px-4 py-5 sm:px-6">
        <fieldset>
          <legend className="text-xs uppercase tracking-[0.12em] text-[var(--faint)]">
            Recent race
          </legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {PRESETS.map((item) => (
              <Chip
                key={item.id}
                pressed={preset === item.id}
                onClick={() => setPreset(item.id)}
              >
                {item.label}
              </Chip>
            ))}
          </div>
          {preset === 'custom' && (
            <div className="mt-3 max-w-[11rem]">
              <label htmlFor={`${uid}-distance`} className="text-xs text-[var(--faint)]">
                Distance ({units})
              </label>
              <input
                id={`${uid}-distance`}
                type="number"
                inputMode="decimal"
                min={0.1}
                step={0.1}
                value={customDisplay}
                onChange={(event) => handleCustomDistance(event.target.value)}
                className={`${inputClass} mt-1.5`}
              />
            </div>
          )}
        </fieldset>

        <fieldset>
          <legend className="text-xs uppercase tracking-[0.12em] text-[var(--faint)]">
            Finish time
          </legend>
          <div className="mt-2 grid grid-cols-3 gap-2 sm:max-w-sm">
            <TimeField id={`${uid}-h`} label="Hours" value={hours} max={12} onChange={setHours} />
            <TimeField id={`${uid}-m`} label="Minutes" value={minutes} max={59} onChange={setMinutes} />
            <TimeField id={`${uid}-s`} label="Seconds" value={seconds} max={59} onChange={setSeconds} />
          </div>
        </fieldset>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor={`${uid}-exp`} className="text-xs uppercase tracking-[0.12em] text-[var(--faint)]">
              Riegel exponent
            </label>
            <div className="mt-2 flex items-center gap-3">
              <input
                id={`${uid}-exp`}
                type="range"
                min={1.04}
                max={1.12}
                step={0.01}
                value={exponent}
                onChange={(event) => setExponent(Number(event.target.value))}
                className="h-2 w-full accent-[var(--accent)]"
              />
              <span className="w-12 shrink-0 font-serif text-lg tabular-nums text-[var(--ink)]">
                {exponent.toFixed(2)}
              </span>
            </div>
            <p className="mt-1 text-xs text-[var(--faint)]">1.06 is the napkin. 1.08–1.10 is the cautious one.</p>
          </div>

          <fieldset>
            <legend className="text-xs uppercase tracking-[0.12em] text-[var(--faint)]">
              NYC course
            </legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {COURSE_TOGGLES.map((item) => (
                <Chip
                  key={item.id}
                  pressed={course[item.id]}
                  onClick={() => setCourse((current) => ({ ...current, [item.id]: !current[item.id] }))}
                >
                  {item.label}
                </Chip>
              ))}
            </div>
          </fieldset>
        </div>

        <div className="grid gap-5">
          <Segmented label="Crowding / corral" value={crowding} options={CROWDING} onChange={setCrowding} />
          <Segmented label="Weather" value={weather} options={WEATHER} onChange={setWeather} />
          <Segmented
            label="Long runs / weekly mileage"
            value={training}
            options={TRAINING}
            onChange={setTraining}
          />
        </div>
      </div>

      <div className="border-t border-[var(--line)] px-4 py-5 sm:px-6">
        {result ? (
          <>
            <div aria-live="polite" className="grid grid-cols-2 gap-3">
              <Stat label="Flat Riegel" value={formatHms(result.riegelSeconds)} />
              <Stat label={`VDOT ${result.vdot.toFixed(1)}`} value={formatHms(result.vdotSeconds)} />
              <div className="col-span-2 rounded-2xl border border-[var(--accent)]/30 bg-[var(--accent-soft)] px-4 py-3">
                <span className="block text-xs uppercase tracking-[0.12em] text-[var(--accent)]">
                  NYC goal
                </span>
                <strong
                  key={formatHms(result.nycSeconds)}
                  className="calc-tick mt-1 block font-serif text-3xl font-normal tabular-nums tracking-tight text-[var(--ink)] sm:text-4xl"
                >
                  {formatHms(result.nycSeconds)}
                </strong>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  <span className="tabular-nums">{formatPace(result.paceSecPerMile)}</span> / mi
                  <span aria-hidden="true"> · </span>
                  <span className="tabular-nums">{formatPace(result.paceSecPerKm)}</span> / km
                </p>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
              <Segmented
                label="Splits"
                value={splitMode}
                options={[
                  { id: '5k', label: '5K' },
                  { id: 'landmarks', label: 'Landmarks' },
                ]}
                onChange={setSplitMode}
              />
              <Segmented
                label="Plan"
                value={plan}
                options={[
                  { id: 'even-effort', label: 'Even effort' },
                  { id: 'even-clock', label: 'Even clock' },
                ]}
                onChange={setPlan}
              />
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[17.5rem] text-left text-sm">
                <caption className="sr-only">
                  {plan === 'even-effort'
                    ? 'Slightly positive-split plan by even effort'
                    : 'Even-pace clock splits'}
                </caption>
                <thead>
                  <tr className="text-xs uppercase tracking-[0.12em] text-[var(--faint)]">
                    <th scope="col" className="pb-2 pr-3 font-normal">
                      Mark
                    </th>
                    <th scope="col" className="pb-2 pr-3 text-right font-normal">
                      {units === 'mi' ? 'Mile' : 'Km'}
                    </th>
                    <th scope="col" className="pb-2 pr-3 text-right font-normal">
                      Split
                    </th>
                    <th scope="col" className="pb-2 text-right font-normal">
                      Elapsed
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {splits.map((row) => (
                    <tr key={row.id} className="border-t border-[var(--line)]">
                      <th scope="row" className="py-2.5 pr-3 font-normal text-[var(--ink)]">
                        {row.label}
                      </th>
                      <td className="py-2.5 pr-3 text-right tabular-nums text-[var(--muted)]">
                        {units === 'mi' ? row.miles.toFixed(1) : row.km.toFixed(1)}
                      </td>
                      <td className="py-2.5 pr-3 text-right tabular-nums text-[var(--muted)]">
                        {formatHms(row.splitSeconds)}
                      </td>
                      <td className="py-2.5 text-right font-serif tabular-nums text-[var(--ink)]">
                        {formatHms(row.elapsedSeconds)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-[var(--faint)]">
              Even effort runs the first half a touch slow and spends a little more on the late hills.
              Wrist-card the NYC goal, not the flat Riegel.
            </p>
          </>
        ) : (
          <p className="text-sm text-[var(--muted)]">Enter a race time to get a goal.</p>
        )}
      </div>
    </section>
  );
}

function TimeField({
  id,
  label,
  value,
  max,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="text-xs text-[var(--faint)]">
        {label}
      </label>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={0}
        max={max}
        step={1}
        value={Number.isFinite(value) ? value : 0}
        onChange={(event) => onChange(clampInt(event.target.value, 0, max))}
        className={`${inputClass} mt-1.5`}
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg)] px-4 py-3">
      <span className="block text-xs uppercase tracking-[0.12em] text-[var(--faint)]">{label}</span>
      <strong
        key={value}
        className="calc-tick mt-1 block font-serif text-xl font-normal tabular-nums text-[var(--ink)]"
      >
        {value}
      </strong>
    </div>
  );
}

function Chip({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={
        pressed
          ? 'pressable rounded-full bg-[var(--ink)] px-3 py-1.5 text-xs text-[var(--bg)]'
          : 'pressable rounded-full border border-[var(--line)] px-3 py-1.5 text-xs text-[var(--ink)]'
      }
    >
      {children}
    </button>
  );
}

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { id: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <fieldset>
      <legend className="text-xs uppercase tracking-[0.12em] text-[var(--faint)]">{label}</legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((option) => (
          <Chip key={option.id} pressed={value === option.id} onClick={() => onChange(option.id)}>
            {option.label}
          </Chip>
        ))}
      </div>
    </fieldset>
  );
}

function clampInt(raw: string, min: number, max: number): number {
  if (raw === '') return 0;
  const next = Number(raw);
  if (!Number.isFinite(next)) return 0;
  return Math.min(max, Math.max(min, Math.round(next)));
}

function roundDisplay(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
