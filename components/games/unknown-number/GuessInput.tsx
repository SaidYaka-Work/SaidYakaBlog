'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { filterFigureChoices } from './logic';
import type { Figure } from './types';

type GuessInputProps = {
  disabled: boolean;
  placeholder?: string;
  onGuess: (figure: Figure) => void;
};

export default function GuessInput({ disabled, placeholder, onGuess }: GuessInputProps) {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const choices = useMemo(() => filterFigureChoices(query), [query]);

  useEffect(() => {
    setActive(0);
    setOpen(query.trim().length > 0 && choices.length > 0 && !disabled);
  }, [choices, disabled, query]);

  function submitFigure(figure: Figure) {
    onGuess(figure);
    setQuery('');
    setOpen(false);
    inputRef.current?.focus();
  }

  function submitCurrent() {
    if (!choices.length) return;
    const exact = choices.find((figure) => figure.name.toLowerCase() === query.trim().toLowerCase());
    submitFigure(exact ?? choices[Math.max(0, Math.min(active, choices.length - 1))]);
  }

  return (
    <div className="relative">
      <label htmlFor="unknown-guess" className="sr-only">
        Guess the name
      </label>
      <div className="flex items-end gap-2">
        <input
          ref={inputRef}
          id="unknown-guess"
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && choices[active] ? `${listId}-${choices[active].id}` : undefined}
          autoComplete="off"
          spellCheck={false}
          disabled={disabled}
          placeholder={placeholder ?? (disabled ? 'The thread is closed' : 'Text Message')}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setActive((index) => Math.min(choices.length - 1, index + 1));
            } else if (event.key === 'ArrowUp') {
              event.preventDefault();
              setActive((index) => Math.max(0, index - 1));
            } else if (event.key === 'Enter') {
              event.preventDefault();
              submitCurrent();
            } else if (event.key === 'Escape') {
              setOpen(false);
            }
          }}
          className="min-h-11 flex-1 rounded-[1.3rem] border border-[var(--line)] bg-[var(--un-phone)] px-4 text-sm text-[var(--ink)] placeholder:text-[var(--faint)] disabled:opacity-60"
        />
        <button
          type="button"
          className="pressable grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[var(--un-out-bg)] text-sm font-medium text-[var(--un-out-ink)] disabled:opacity-50"
          disabled={disabled || !choices.length}
          onClick={submitCurrent}
          aria-label="Send"
        >
          ↑
        </button>
      </div>
      {open ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute inset-x-0 bottom-full z-10 mb-2 max-h-56 overflow-auto rounded-2xl border border-[var(--line)] bg-[var(--bg-elevated)] py-1 shadow-lg"
        >
          {choices.map((figure, index) => (
            <li key={figure.id} role="presentation">
              <button
                id={`${listId}-${figure.id}`}
                type="button"
                role="option"
                aria-selected={index === active}
                className={`block w-full px-4 py-2 text-left text-sm ${
                  index === active ? 'bg-[var(--accent-soft)] text-[var(--ink)]' : 'text-[var(--ink)]'
                }`}
                onMouseEnter={() => setActive(index)}
                onClick={() => submitFigure(figure)}
              >
                {figure.name}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
