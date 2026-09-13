import type { CSSProperties, KeyboardEvent, ReactElement } from 'react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';

/**
 * Choosing a bank out of several hundred, without scrolling to find it.
 *
 * Every bank picker in the app was a native `<select>`. That was a deliberate
 * choice and half of it was right: what someone types never matches what the
 * provider calls a bank — OPay is "OPay Digital Services Limited (OPay)" — so a
 * free text box produces names that cannot be linked to an account. Choosing
 * from the list means the bank *code* travels with the request and nothing has
 * to be guessed from a display name.
 *
 * The half that was wrong is that Nigeria's list runs to several hundred
 * entries, most of them microfinance banks with near-identical names, and a
 * native select gives you no way through it but your thumb. Reported from a
 * phone on 2026-09-13: nine consecutive microfinance banks on screen and no way
 * to type.
 *
 * So: type to narrow, but still *select* — the value this component reports is
 * always a code taken from the list it was given, never the text someone typed.
 * Clearing the box clears the selection, which matters more than it looks:
 * half-edited text that still carries the previously chosen code is how you
 * link an account to the wrong bank.
 */

export interface BankChoice {
  name: string;
  code: string;
}

export interface BankPickerProps {
  banks: BankChoice[];
  /** The selected bank code, or '' for none. */
  value: string;
  onChange: (bankCode: string) => void;
  /** Accessible name. Defaults to "Bank". */
  ariaLabel?: string;
  placeholder?: string;
  /** Shown in place of the placeholder while the list is still loading. */
  loading?: boolean;
  style?: CSSProperties;
  listStyle?: CSSProperties;
  optionStyle?: CSSProperties;
}

/** Case- and punctuation-insensitive, so "gtbank" finds "GTBank Plc". */
function normalise(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Banks matching what has been typed, by name or by code.
 *
 * Matching on the code too costs nothing and helps the people who know it —
 * and it is the same string the request will carry, so there is no way for a
 * code match to select something other than what was searched for.
 */
export function filterBanks(banks: BankChoice[], query: string): BankChoice[] {
  const q = normalise(query);
  if (q === '') return banks;
  return banks.filter(
    (bank) => normalise(bank.name).includes(q) || normalise(bank.code).includes(q),
  );
}

export function BankPicker({
  banks,
  value,
  onChange,
  ariaLabel = 'Bank',
  placeholder = 'Choose your bank',
  loading = false,
  style,
  listStyle,
  optionStyle,
}: BankPickerProps): ReactElement {
  const listId = useId();
  const selected = useMemo(() => banks.find((b) => b.code === value) ?? null, [banks, value]);

  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  // When a bank is chosen elsewhere — or the list arrives after the value did —
  // the box shows that bank's name rather than going stale or blank.
  useEffect(() => {
    if (!open) setQuery(selected?.name ?? '');
  }, [selected, open]);

  const matches = useMemo(
    () => (open ? filterBanks(banks, selected && query === selected.name ? '' : query) : []),
    [banks, query, open, selected],
  );

  // A list left open over the rest of the form swallows the next tap.
  useEffect(() => {
    if (!open) return;
    const onDocPointerDown = (event: MouseEvent | TouchEvent): void => {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocPointerDown);
    document.addEventListener('touchstart', onDocPointerDown);
    return () => {
      document.removeEventListener('mousedown', onDocPointerDown);
      document.removeEventListener('touchstart', onDocPointerDown);
    };
  }, [open]);

  const choose = (bank: BankChoice): void => {
    onChange(bank.code);
    setQuery(bank.name);
    setOpen(false);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        setActive(0);
        return;
      }
      setActive((i) => {
        const next = event.key === 'ArrowDown' ? i + 1 : i - 1;
        if (matches.length === 0) return 0;
        return (next + matches.length) % matches.length;
      });
      return;
    }
    if (event.key === 'Enter' && open) {
      const bank = matches[active];
      if (bank) {
        event.preventDefault();
        choose(bank);
      }
      return;
    }
    if (event.key === 'Escape' && open) {
      setOpen(false);
      setQuery(selected?.name ?? '');
    }
  };

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <input
        role="combobox"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
        value={query}
        placeholder={loading ? 'Loading banks…' : placeholder}
        disabled={loading}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
          setOpen(true);
          // Typing past a chosen bank un-chooses it. Leaving the old code in
          // place while the text says something else is how an account gets
          // linked to a bank nobody picked.
          if (selected && e.target.value !== selected.name) onChange('');
        }}
        onKeyDown={onKeyDown}
        style={style}
      />
      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-label={ariaLabel}
          style={{
            position: 'absolute',
            zIndex: 40,
            left: 0,
            right: 0,
            maxHeight: 240,
            overflowY: 'auto',
            margin: '4px 0 0',
            padding: 0,
            listStyle: 'none',
            ...listStyle,
          }}
        >
          {matches.length === 0 ? (
            <li style={{ padding: '10px 12px', ...optionStyle }}>No bank matches that</li>
          ) : (
            matches.map((bank, i) => (
              <li
                key={bank.code}
                role="option"
                aria-selected={bank.code === value}
                onMouseDown={(e) => {
                  // mousedown, not click: blurring the input first would close
                  // the list out from under the tap.
                  e.preventDefault();
                  choose(bank);
                }}
                onMouseEnter={() => setActive(i)}
                style={{
                  padding: '10px 12px',
                  cursor: 'pointer',
                  ...optionStyle,
                  ...(i === active ? { background: 'rgba(255,255,255,.08)' } : {}),
                }}
              >
                {bank.name}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
