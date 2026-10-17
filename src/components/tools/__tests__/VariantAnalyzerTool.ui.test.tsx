// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { VariantAnalyzerTool } from '../VariantAnalyzerTool';
import { DEMO_VCF } from '../../../utils/variants/vcfParser';

const SNV_VCF = `##fileformat=VCFv4.2\n##reference=GRCh38\n#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO\nchr17\t43045712\t.\tG\tA\t.\tPASS\t.\nchr17\t43045800\t.\tC\tT\t.\tPASS\t.\nchr7\t117559590\t.\tATCT\tA\t.\tPASS\t.\n`;

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function openVcfTab() {
  const utils = render(<VariantAnalyzerTool lang="en" />);
  fireEvent.click(screen.getByRole('tab', { name: /VCF file & ClinVar/ }));
  await screen.findByRole('button', { name: /Load synthetic demo VCF/ });
  return utils;
}

async function uploadVcf(container: HTMLElement, text: string, name = 'sample.vcf') {
  const input = container.querySelector('input[type="file"]') as HTMLInputElement;
  const buf = new TextEncoder().encode(text);
  const file = new File([buf], name, { type: 'text/plain' });
  // jsdom's FileReader.readAsArrayBuffer returns an ArrayBuffer from another realm in some versions; make it explicit.
  fireEvent.change(input, { target: { files: [file] } });
}

const consentBox = () => screen.getByRole('checkbox', { name: /I understand and want to send/ }) as HTMLInputElement;

describe('ClinVar consent lifecycle', () => {
  it('shows exactly what will be sent (coordinates only) and that the IP address is visible to NCBI', async () => {
    await openVcfTab();
    fireEvent.click(screen.getByRole('button', { name: /Load synthetic demo VCF/ }));
    const boxes = await screen.findAllByRole('checkbox', { name: /^Select / });
    fireEvent.click(boxes.find((b) => !(b as HTMLInputElement).disabled)!);
    const list = await screen.findByTestId('clinvar-send-list');
    expect(list.textContent).toMatch(/chr\d+:\d+ [ACGTN]+>[ACGTN]+ \(GRCh38\)/);
    expect(screen.getByText(/reveals your IP address to NCBI/)).toBeTruthy();
    expect(screen.getByText(/consent applies only to the variants listed above/i)).toBeTruthy();
  });

  it('is reset when a new VCF file is loaded', async () => {
    const { container } = await openVcfTab();
    fireEvent.click(screen.getByRole('button', { name: /Load synthetic demo VCF/ }));
    const boxes = await screen.findAllByRole('checkbox', { name: /^Select / });
    fireEvent.click(boxes.find((b) => !(b as HTMLInputElement).disabled)!);
    fireEvent.click(consentBox());
    expect(consentBox().checked).toBe(true);

    // Load the demo again (new file): the consent must not carry over.
    fireEvent.click(screen.getByRole('button', { name: /Load synthetic demo VCF/ }));
    await waitFor(() => expect(consentBox().checked).toBe(false));
    expect(container).toBeTruthy();
  });

  it('is reassessed when the selected variants change', async () => {
    await openVcfTab();
    fireEvent.click(screen.getByRole('button', { name: /Load synthetic demo VCF/ }));
    const boxes = (await screen.findAllByRole('checkbox', { name: /^Select / })).filter((b) => !(b as HTMLInputElement).disabled) as HTMLInputElement[];
    expect(boxes.length).toBeGreaterThan(1);
    fireEvent.click(boxes[0]);
    fireEvent.click(consentBox());
    expect(consentBox().checked).toBe(true);
    fireEvent.click(boxes[1]); // the selection changed -> the earlier consent no longer covers it
    await waitFor(() => expect(consentBox().checked).toBe(false));
    fireEvent.click(boxes[1]); // back to the original selection is NOT silently re-consented either
    expect(consentBox().checked).toBe(false);
  });

  it('is reassessed when the genome build changes', async () => {
    await openVcfTab();
    fireEvent.click(screen.getByRole('button', { name: /Load synthetic demo VCF/ }));
    const boxes = (await screen.findAllByRole('checkbox', { name: /^Select / })).filter((b) => !(b as HTMLInputElement).disabled) as HTMLInputElement[];
    fireEvent.click(boxes[0]);
    fireEvent.click(consentBox());
    expect(consentBox().checked).toBe(true);
    fireEvent.change(document.getElementById('var-build') as HTMLSelectElement, { target: { value: 'GRCh37' } });
    await waitFor(() => expect(consentBox().checked).toBe(false));
  });
});

describe('ClinVar request lifecycle', () => {
  const pendingFetch = () => {
    const signals: AbortSignal[] = [];
    const fn = vi.fn((_url: string, init?: RequestInit) => {
      if (init?.signal) signals.push(init.signal);
      return new Promise<Response>((_res, rej) => {
        init?.signal?.addEventListener('abort', () => rej(Object.assign(new Error('aborted'), { name: 'AbortError' })));
      });
    });
    return { fn, signals };
  };

  async function startLookup() {
    await openVcfTab();
    fireEvent.click(screen.getByRole('button', { name: /Load synthetic demo VCF/ }));
    const boxes = (await screen.findAllByRole('checkbox', { name: /^Select / })).filter((b) => !(b as HTMLInputElement).disabled) as HTMLInputElement[];
    fireEvent.click(boxes[0]);
    fireEvent.click(consentBox());
    fireEvent.click(screen.getByRole('button', { name: /Look up 1 in ClinVar/ }));
  }

  it('cancels the in-flight request when the user presses Cancel and keeps the tool usable', async () => {
    const { fn, signals } = pendingFetch();
    vi.stubGlobal('fetch', fn);
    await startLookup();
    await waitFor(() => expect(fn).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('button', { name: /Cancel/ }));
    await waitFor(() => expect(signals[0].aborted).toBe(true));
    await screen.findByText('Lookup cancelled.');
    expect((screen.getByRole('button', { name: /Look up 1 in ClinVar/ }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('aborts the in-flight request when the component unmounts', async () => {
    const { fn, signals } = pendingFetch();
    vi.stubGlobal('fetch', fn);
    const unmountable = await (async () => {
      const u = render(<VariantAnalyzerTool lang="en" />);
      cleanup(); // discard (render helper above is reused in startLookup)
      return u;
    })();
    expect(unmountable).toBeTruthy();
    const utils = render(<VariantAnalyzerTool lang="en" />);
    fireEvent.click(screen.getByRole('tab', { name: /VCF file & ClinVar/ }));
    fireEvent.click(await screen.findByRole('button', { name: /Load synthetic demo VCF/ }));
    const boxes = (await screen.findAllByRole('checkbox', { name: /^Select / })).filter((b) => !(b as HTMLInputElement).disabled) as HTMLInputElement[];
    fireEvent.click(boxes[0]);
    fireEvent.click(consentBox());
    fireEvent.click(screen.getByRole('button', { name: /Look up 1 in ClinVar/ }));
    await waitFor(() => expect(fn).toHaveBeenCalledTimes(1));
    utils.unmount();
    await waitFor(() => expect(signals[0].aborted).toBe(true));
  });

  it('aborts the request and drops late results when a new VCF file is loaded', async () => {
    const { fn, signals } = pendingFetch();
    vi.stubGlobal('fetch', fn);
    await startLookup();
    await waitFor(() => expect(fn).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('button', { name: /Load synthetic demo VCF/ })); // new file
    await waitFor(() => expect(signals[0].aborted).toBe(true));
    await waitFor(() => expect(screen.queryByRole('button', { name: /Cancel/ })).toBeNull());
    expect(consentBox().checked).toBe(false);
    expect(screen.queryByText(/Retrieved at/)).toBeNull(); // nothing from the old run is attached to the new file
  });

  it('stale results never attach to a newly loaded file even if the old request resolves later', async () => {
    let resolveFirst: ((r: Response) => void) | null = null;
    const body = (b: unknown) => ({ ok: true, status: 200, json: async () => b }) as Response;
    const fn = vi.fn((url: string) => {
      if (!resolveFirst) return new Promise<Response>((res) => (resolveFirst = res)); // never honours the abort signal
      return Promise.resolve(body({ esearchresult: { count: '0', idlist: [] } }));
    });
    vi.stubGlobal('fetch', fn);
    await startLookup();
    await waitFor(() => expect(fn).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('button', { name: /Load synthetic demo VCF/ }));
    resolveFirst!(body({ esearchresult: { count: '0', idlist: [] } }));
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByText(/No ClinVar record|no_record|Retrieved at/i)).toBeNull();
  });
});
