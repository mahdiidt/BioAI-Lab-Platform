// Web Worker entry: runs the Cancer ML Studio experiment off the main thread so
// large datasets do not freeze the page. Data stay inside the browser; the
// worker has no network code.
import { runExperiment, type ExperimentConfig } from './pipeline';
import type { MlDataset } from './csvDataset';

interface WorkerRequest {
  id: number;
  dataset: MlDataset;
  config: ExperimentConfig;
}

const ctx = self as unknown as {
  onmessage: ((e: MessageEvent<WorkerRequest>) => void) | null;
  postMessage: (msg: unknown) => void;
};

ctx.onmessage = (e) => {
  const { id, dataset, config } = e.data;
  try {
    ctx.postMessage({ id, ok: true, result: runExperiment(dataset, config) });
  } catch {
    ctx.postMessage({ id, ok: false });
  }
};
