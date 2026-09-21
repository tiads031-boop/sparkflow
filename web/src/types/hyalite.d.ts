type HyaliteShape = 'circle' | 'squircle' | 'lip';

interface HyaliteOptions {
  bevel?: number;
  thickness?: number;
  slope?: number;
  shape?: HyaliteShape;
  blur?: number;
  dispersion?: number;
  shade?: number;
  rim?: number;
  edgeW?: number;
  sat?: number;
  edge?: number;
  smooth?: number;
  materialize?: number;
  settle?: number;
  self?: boolean;
}

interface HyaliteWatcher {
  stop(): void;
}

interface HyaliteAPI {
  watch(container: Element, selector: string, options?: HyaliteOptions): HyaliteWatcher;
  supported(): boolean;
  refresh(element: Element): void;
  detach(element: Element): void;
  version: string;
}

interface Window {
  Hyalite?: HyaliteAPI;
}
