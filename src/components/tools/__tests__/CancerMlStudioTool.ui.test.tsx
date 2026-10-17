// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup, within } from '@testing-library/react';
import { CancerMlStudioTool } from '../CancerMlStudioTool';

afterEach(cleanup);

function lcg(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** 20 patients x 2 samples (one normal + one tumour each). `patientCol` is numeric and has an arbitrary name. */
function csvText(patientCol = 'xq7', extra = '') {
  const r = lcg(42);
  const rows: string[] = [];
  for (let p = 0; p < 20; p++) {
    const effect = (r() - 0.5) * 3;
    for (let k = 0; k < 2; k++) {
      const label = k === 0 ? 'normal' : 'tumor';
      const sig = k === 0 ? 0 : 1.5;
      rows.push(`S${p}_${k},${200 + p},${label},${(effect + sig + r() * 0.3).toFixed(3)},${(effect + r() * 0.3).toFixed(3)},${(r() * 4).toFixed(3)}${extra ? ',' + extra : ''}`);
    }
  }
  return `sample_id,${patientCol},condition,G1,G2,G3${extra ? ',dup' : ''}\n${rows.join('\n')}\n`;
}

async function load(csv: string) {
  const utils = render(<CancerMlStudioTool lang="en" />);
  const input = utils.container.querySelector('input[type="file"]') as HTMLInputElement;
  fireEvent.change(input, { target: { files: [new File([csv], 'data.csv', { type: 'text/csv' })] } });
  await screen.findByLabelText('Group / subject column');
  return utils;
}

const groupSelect = () => screen.getByLabelText('Group / subject column') as HTMLSelectElement;
const groupAware = () => screen.getByLabelText('Group-aware evaluation') as HTMLInputElement;

describe('Cancer ML Studio: group column selector', () => {
  it('is a visible, labelled dropdown with an explicit "No group column" option and a plain-language explanation', async () => {
    await load(csvText());
    const sel = groupSelect();
    expect(sel.tagName).toBe('SELECT');
    expect(sel.getAttribute('aria-describedby')).toBe('ml-group-help');
    expect(document.getElementById('ml-group-help')!.textContent).toMatch(/same patient\/subject together/);
    const options = within(sel).getAllByRole('option').map((o) => o.textContent);
    expect(options[0]).toBe('No group column');
    expect(sel.value).toBe(''); // "xq7" is not a name anyone hard-coded: nothing is assumed, the user stays in control
  });

  it('offers every column except the label, including numeric ones', async () => {
    await load(csvText());
    const texts = within(groupSelect()).getAllByRole('option').map((o) => o.textContent ?? '');
    expect(texts.some((t) => t.startsWith('xq7'))).toBe(true); // numeric
    expect(texts.some((t) => t.startsWith('sample_id'))).toBe(true);
    expect(texts.some((t) => t.startsWith('G1'))).toBe(true);
    expect(texts.some((t) => t.startsWith('condition'))).toBe(false); // label column is excluded
    expect(texts.find((t) => t.startsWith('xq7'))).toContain('20 distinct values');
  });

  it('rebuilds the dataset when the group column changes (group-aware option and group note follow the selection)', async () => {
    await load(csvText());
    expect(groupAware().disabled).toBe(true);
    expect(screen.queryByText(/Groups from xq7/)).toBeNull();

    fireEvent.change(groupSelect(), { target: { value: 'xq7' } });
    await waitFor(() => expect(groupAware().disabled).toBe(false));
    expect(screen.getByText(/Groups from xq7: 20/)).toBeTruthy();

    // switching to a different column rebuilds again (this is the stale-memo regression)
    fireEvent.change(groupSelect(), { target: { value: 'sample_id' } });
    await waitFor(() => expect(screen.getByText(/Groups from sample_id: 40/)).toBeTruthy());

    fireEvent.change(groupSelect(), { target: { value: '' } });
    await waitFor(() => expect(groupAware().disabled).toBe(true));
    expect(groupAware().checked).toBe(false);
    expect(screen.queryByText(/Groups from/)).toBeNull();
  });

  it('turning group-aware off when the group column is cleared (no silent group-aware run without groups)', async () => {
    await load(csvText());
    fireEvent.change(groupSelect(), { target: { value: 'xq7' } });
    await waitFor(() => expect(groupAware().disabled).toBe(false));
    fireEvent.click(groupAware());
    expect(groupAware().checked).toBe(true);
    fireEvent.change(groupSelect(), { target: { value: '' } });
    await waitFor(() => expect(groupAware().checked).toBe(false));
  });

  it('the group column never appears as a model feature (its option is also excluded from the ID list if it is the label)', async () => {
    await load(csvText());
    const labelSel = screen.getByLabelText('Label (class) column') as HTMLSelectElement;
    fireEvent.change(groupSelect(), { target: { value: 'xq7' } });
    await waitFor(() => expect(groupAware().disabled).toBe(false));
    const idTexts = within(screen.getByLabelText('Sample ID column')).getAllByRole('option').map((o) => o.textContent);
    expect(idTexts).not.toContain('xq7'); // selected group is not offered as the sample ID
    expect(labelSel.value).toBe('condition');
  });

  it('runs a group-aware experiment end-to-end and reports the chosen group column', async () => {
    await load(csvText());
    fireEvent.change(groupSelect(), { target: { value: 'xq7' } });
    await waitFor(() => expect(groupAware().disabled).toBe(false));
    fireEvent.click(groupAware());
    fireEvent.click(screen.getByRole('button', { name: /Train & evaluate/ }));
    await screen.findByText(/\(xq7\)/, undefined, { timeout: 15000 });
    // matched tumour/normal pairs: the permutation control must say it is unavailable instead of shuffling rows
    await screen.findByText(/Not available \(see warning\)/);
  }, 20000);
});

describe('Cancer ML Studio: feature review and exclusion', () => {
  it('flags a numeric patient identifier, leaves it out by default and lets the user include it', async () => {
    await load(csvText('subject_no')); // identifier-like name, but not a name the group suggestion knows: nothing is selected as group
    expect(screen.getByText(/Feature review/)).toBeTruthy();
    const cb = screen.getByLabelText('Use as feature: subject_no') as HTMLInputElement;
    expect(cb.checked).toBe(false);
    expect(screen.getByText(/were left out of the features|left out of the features/)).toBeTruthy();
    fireEvent.click(cb);
    await waitFor(() => expect((screen.getByLabelText('Use as feature: subject_no') as HTMLInputElement).checked).toBe(true));
    expect(screen.queryByText(/left out of the features/)).toBeNull();
    expect(screen.getByText(/look suspicious/)).toBeTruthy();
  });

  it('explicitly says the heuristics are incomplete and the user must review the features', async () => {
    await load(csvText());
    expect(screen.getByText(/cannot find every source of leakage or confounding/)).toBeTruthy();
  });

  it('has a free-text exclusion list for any column', async () => {
    await load(csvText());
    const input = screen.getByLabelText(/Additional columns to exclude/) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'G3' } });
    await waitFor(() => expect(input.value).toBe('G3'));
  });

  it('shows duplicate-row handling choices only when duplicates exist, and lets the user choose', async () => {
    const base = csvText();
    const lines = base.trim().split('\n');
    const dup = lines.slice(1, 7).map((l, i) => l.replace(/^S\d+_\d+/, `D${i}`));
    await load([...lines, ...dup].join('\n') + '\n');
    expect(screen.getByText('Duplicate rows')).toBeTruthy();
    const group = screen.getByLabelText('Treat identical rows as one group') as HTMLInputElement;
    expect((screen.getByLabelText('Keep and warn') as HTMLInputElement).checked).toBe(true);
    fireEvent.click(group);
    await waitFor(() => expect(group.checked).toBe(true));
    await waitFor(() => expect(groupAware().disabled).toBe(false)); // identical rows became groups
  });
});
