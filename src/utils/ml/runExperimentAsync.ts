// Runs an experiment in a dedicated Web Worker when available, falling back to
// the main thread (e.g. if workers are blocked). The result is identical either
// way because the pipeline is deterministic for a given seed.
import { runExperiment, type ExperimentConfig, type ExperimentResult, type ExperimentError } from './pipeline';
import type { MlDataset } from './csvDataset';

export interface RunningExperiment {
  promise: Promise<ExperimentResult | ExperimentError>;
  /** Stops the worker. The promise then rejects with an Error named 'AbortError'. */
  cancel: () => void;
  usesWorker: boolean;
}

function abortError(): Error {
  const e = new Error('cancelled');
  e.name = 'AbortError';
  return e;
}

function runOnMainThread(dataset: MlDataset, config: ExperimentConfig): RunningExperiment {
  let cancelled = false;
  let rejectFn: ((e: Error) => void) | null = null;
  const promise = new Promise<ExperimentResult | ExperimentError>((resolve, reject) => {
    rejectFn = reject;
    // Yield one frame so the "training…" state can render first.
    setTimeout(() => {
      if (cancelled) return;
      try {
        resolve(runExperiment(dataset, config));
      } catch (err) {
        reject(err instanceof Error ? err : new Error('failed'));
      }
    }, 20);
  });
  return {
    promise,
    usesWorker: false,
    cancel: () => {
      cancelled = true;
      rejectFn?.(abortError());
    },
  };
}

let nextId = 1;

export function runExperimentAsync(dataset: MlDataset, config: ExperimentConfig): RunningExperiment {
  if (typeof Worker === 'undefined') return runOnMainThread(dataset, config);
  let worker: Worker;
  try {
    worker = new Worker(new URL('./experimentWorker.ts', import.meta.url), { type: 'module' });
  } catch {
    return runOnMainThread(dataset, config);
  }
  const id = nextId++;
  let settled = false;
  let fallback: RunningExperiment | null = null;
  let rejectFn: ((e: Error) => void) | null = null;
  const promise = new Promise<ExperimentResult | ExperimentError>((resolve, reject) => {
    rejectFn = reject;
    worker.onmessage = (e: MessageEvent<{ id: number; ok: boolean; result?: ExperimentResult | ExperimentError }>) => {
      if (e.data?.id !== id || settled) return;
      settled = true;
      worker.terminate();
      if (e.data.ok && e.data.result) resolve(e.data.result);
      else reject(new Error('failed'));
    };
    worker.onerror = (ev) => {
      // Worker could not load (CSP, old browser, bundling issue): run in-page instead.
      ev.preventDefault?.();
      if (settled) return;
      settled = true;
      worker.terminate();
      fallback = runOnMainThread(dataset, config);
      fallback.promise.then(resolve, reject);
    };
    worker.postMessage({ id, dataset, config });
  });
  return {
    promise,
    usesWorker: true,
    cancel: () => {
      if (fallback) {
        fallback.cancel();
        return;
      }
      if (settled) return;
      settled = true;
      worker.terminate();
      rejectFn?.(abortError());
    },
  };
}
