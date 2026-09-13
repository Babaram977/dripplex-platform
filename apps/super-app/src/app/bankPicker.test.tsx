import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { BankPicker, filterBanks, type BankChoice } from './bankPicker';

/**
 * The bank picker, which is a financial control before it is a convenience.
 *
 * It exists because Nigeria's bank list runs to several hundred entries and a
 * native select gave no way through it but scrolling — reported from a phone on
 * 2026-09-13, nine consecutive microfinance banks on screen.
 *
 * What must not be lost in making it searchable is the reason it was a picker
 * in the first place: what someone types never matches what the provider calls
 * a bank, so the value that leaves this component has to be a code taken from
 * the list. A typed name that merely looks right is an account linked to the
 * wrong bank, or to no bank at all.
 */

const BANKS: BankChoice[] = [
  { name: 'Guaranty Trust Bank', code: '058' },
  { name: 'OPay Digital Services Limited (OPay)', code: '999992' },
  { name: 'Hasal Microfinance Bank', code: '50383' },
  { name: 'Hayat Trust MFB', code: '51211' },
  { name: 'Ibile Microfinance Bank', code: '51244' },
];

function Harness({ onChange }: { onChange?: (code: string) => void }): React.ReactElement {
  const [value, setValue] = useState('');
  return (
    <>
      <BankPicker
        banks={BANKS}
        value={value}
        onChange={(code) => {
          setValue(code);
          onChange?.(code);
        }}
      />
      <output data-testid="chosen">{value}</output>
    </>
  );
}

const chosen = (): string => screen.getByTestId('chosen').textContent ?? '';
const open = (): void => {
  fireEvent.focus(screen.getByRole('combobox'));
};
const type = (text: string): void => {
  fireEvent.change(screen.getByRole('combobox'), { target: { value: text } });
};

describe('searching', () => {
  it('narrows the list as you type', () => {
    render(<Harness />);
    open();
    expect(screen.getAllByRole('option')).toHaveLength(5);

    type('hasal');
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual([
      'Hasal Microfinance Bank',
    ]);
  });

  it('ignores case and punctuation, because nobody types the provider spelling', () => {
    // "OPay Digital Services Limited (OPay)" is the name in the list. Someone
    // types "opay".
    expect(filterBanks(BANKS, 'opay').map((b) => b.code)).toEqual(['999992']);
    expect(filterBanks(BANKS, 'GUARANTY trust').map((b) => b.code)).toEqual(['058']);
    expect(filterBanks(BANKS, 'guarantytrust').map((b) => b.code)).toEqual(['058']);
  });

  it('matches on the code too', () => {
    expect(filterBanks(BANKS, '058').map((b) => b.name)).toEqual(['Guaranty Trust Bank']);
  });

  it('says so when nothing matches, rather than showing an empty box', () => {
    render(<Harness />);
    open();
    type('zzzz');
    expect(screen.queryAllByRole('option')).toHaveLength(0);
    expect(screen.getByText('No bank matches that')).toBeTruthy();
  });

  it('an empty query offers everything', () => {
    expect(filterBanks(BANKS, '')).toHaveLength(5);
    expect(filterBanks(BANKS, '   ')).toHaveLength(5);
  });
});

describe('what leaves the component is a code from the list', () => {
  it('reports the chosen bank’s code, not the text shown', () => {
    render(<Harness />);
    open();
    type('hasal');
    fireEvent.mouseDown(screen.getByRole('option', { name: 'Hasal Microfinance Bank' }));

    expect(chosen()).toBe('50383');
    expect((screen.getByRole('combobox') as HTMLInputElement).value).toBe(
      'Hasal Microfinance Bank',
    );
  });

  it('typing a bank’s exact name selects nothing on its own', () => {
    // The whole hazard of a searchable field. Text that reads like a bank is
    // not a bank; only picking from the list is.
    render(<Harness />);
    open();
    type('Guaranty Trust Bank');
    expect(chosen()).toBe('');
  });

  it('editing past a chosen bank clears the choice', () => {
    // Otherwise the box reads "Guarant" while the request still carries 058,
    // and an account gets linked to a bank nobody picked.
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    open();
    fireEvent.mouseDown(screen.getByRole('option', { name: 'Guaranty Trust Bank' }));
    expect(chosen()).toBe('058');

    type('Guarant');
    expect(chosen()).toBe('');
    expect(onChange).toHaveBeenLastCalledWith('');
  });

  it('never offers a bank that is not in the list it was given', () => {
    render(<Harness />);
    open();
    const offered = screen.getAllByRole('option').map((o) => o.textContent);
    expect(offered.every((name) => BANKS.some((b) => b.name === name))).toBe(true);
  });
});

describe('reaching it without a mouse', () => {
  it('picks the highlighted bank on Enter', () => {
    render(<Harness />);
    open();
    type('microfinance');
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'ArrowDown' });
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Enter' });

    expect(chosen()).toBe('51244'); // Ibile, the second match
  });

  it('Escape closes without choosing', () => {
    render(<Harness />);
    open();
    type('hasal');
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Escape' });

    expect(chosen()).toBe('');
    expect(screen.queryAllByRole('option')).toHaveLength(0);
  });

  it('carries an accessible name and combobox semantics', () => {
    render(<Harness />);
    const box = screen.getByRole('combobox', { name: 'Bank' });
    expect(box.getAttribute('aria-expanded')).toBe('false');
    fireEvent.focus(box);
    expect(screen.getByRole('combobox').getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('listbox')).toBeTruthy();
  });
});

describe('while the list is still loading', () => {
  it('says so and cannot be typed into', () => {
    render(<BankPicker banks={[]} value="" onChange={() => undefined} loading />);
    const box = screen.getByRole('combobox') as HTMLInputElement;
    expect(box.placeholder).toBe('Loading banks…');
    expect(box.disabled).toBe(true);
  });
});
