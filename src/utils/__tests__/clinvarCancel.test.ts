import { describe, it, expect } from 'vitest';
import { abortableSleep, lookupClinVar, type ClinVarQuery } from '../variants/clinvar';

const q: ClinVarQuery = { key: 'k1', chrom: 'chr17', pos: 43045712, ref: 'G', alt: 'A', build: 'GRCh38' };

const res = (status: number, body: unknown = {}) => ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response;

describe('abortableSleep', () => {
  it('resolves after the delay when not aborted', async () => {
    const t0 = Date.now();
    await abortableSleep(30);
    expect(Date.now() - t0).toBeGreaterThanOrEqual(25);
  });

  it('rejects immediately when the signal fires during the wait', async () => {
    const c = new AbortController();
    const t0 = Date.now();
    const p = abortableSleep(5000, c.signal);
    setTimeout(() => c.abort(), 20);
    await expect(p).rejects.toMatchObject({ name: 'AbortError' });
    expect(Date.now() - t0).toBeLessThan(1000);
  });

  it('rejects at once for an already aborted signal', async () => {
    const c = new AbortController();
    c.abort();
    await expect(abortableSleep(5000, c.signal)).rejects.toMatchObject({ name: 'AbortError' });
  });
});

describe('lookupClinVar cancellation', () => {
  it('cancelling during the 429 retry wait stops promptly and never sends the retry', async () => {
    let calls = 0;
    const fetchImpl = (async () => {
      calls++;
      return res(429);
    }) as unknown as typeof fetch;
    const c = new AbortController();
    const t0 = Date.now();
    const p = lookupClinVar([q], { fetchImpl, signal: c.signal, minIntervalMs: 0 }); // real 2 s retry wait
    setTimeout(() => c.abort(), 60);
    const out = await p;
    expect(Date.now() - t0).toBeLessThan(1000);
    expect(calls).toBe(1); // the delayed retry was never sent
    expect(out).toEqual([]); // nothing is reported for the cancelled variant
  });

  it('passes the abort signal to the wait helper used for rate limiting and retries', async () => {
    const seen: (AbortSignal | undefined)[] = [];
    const sleep = async (_ms: number, signal?: AbortSignal) => {
      seen.push(signal);
    };
    let n = 0;
    const fetchImpl = (async () => (++n === 1 ? res(429) : res(200, { esearchresult: { count: '0', idlist: [] } }))) as unknown as typeof fetch;
    const c = new AbortController();
    const out = await lookupClinVar([q], { fetchImpl, signal: c.signal, sleep, minIntervalMs: 0 });
    expect(out[0].status).toBe('no_record');
    expect(seen.length).toBeGreaterThan(0);
    expect(seen.every((s) => s === c.signal)).toBe(true);
  });

  it('aborts the in-flight request and does not start the next variant', async () => {
    const c = new AbortController();
    let calls = 0;
    const fetchImpl = ((_url: string, init?: RequestInit) =>
      new Promise((_resolve, reject) => {
        calls++;
        init?.signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
      })) as unknown as typeof fetch;
    const p = lookupClinVar([q, { ...q, key: 'k2', pos: 43045713 }], { fetchImpl, signal: c.signal, minIntervalMs: 0, sleep: async () => undefined });
    setTimeout(() => c.abort(), 20);
    const out = await p;
    expect(calls).toBe(1);
    expect(out).toEqual([]);
  });

  it('does not send anything when the signal is already aborted', async () => {
    const c = new AbortController();
    c.abort();
    let calls = 0;
    const fetchImpl = (async () => {
      calls++;
      return res(200);
    }) as unknown as typeof fetch;
    expect(await lookupClinVar([q], { fetchImpl, signal: c.signal, minIntervalMs: 0 })).toEqual([]);
    expect(calls).toBe(0);
  });
});
