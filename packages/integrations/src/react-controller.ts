import type {
  IntegrationDirectory,
  IntegrationDirectoryLoader,
} from "./connection";

export interface IntegrationDirectoryState {
  directory: IntegrationDirectory | undefined;
  error: Error | undefined;
  isLoading: boolean;
  refresh: () => Promise<void>;
}

type StateListener = (state: IntegrationDirectoryState) => void;

function asError(error: unknown): Error {
  return error instanceof Error
    ? error
    : new Error("Unable to load integrations.");
}

/**
 * A small framework-neutral state machine used by the React adapter. Keeping
 * it separate makes stale requests and unmount behavior testable without a
 * DOM, query client, or product runtime dependency.
 */
export class IntegrationDirectoryLoaderController {
  private abortController: AbortController | undefined;
  private disposed = false;
  private loader: IntegrationDirectoryLoader;
  private listeners = new Set<StateListener>();
  private requestVersion = 0;

  state: IntegrationDirectoryState;

  constructor(loader: IntegrationDirectoryLoader) {
    this.loader = loader;
    this.state = {
      directory: undefined,
      error: undefined,
      isLoading: true,
      refresh: () => this.refresh(),
    };
  }

  setLoader(loader: IntegrationDirectoryLoader): void {
    this.loader = loader;
  }

  subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private publish(next: Omit<IntegrationDirectoryState, "refresh">): void {
    if (this.disposed) {
      return;
    }
    this.state = { ...next, refresh: () => this.refresh() };
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }

  async refresh(): Promise<void> {
    if (this.disposed) {
      return;
    }
    this.abortController?.abort();
    const abortController = new AbortController();
    this.abortController = abortController;
    const requestVersion = this.requestVersion + 1;
    this.requestVersion = requestVersion;
    this.publish({
      directory: this.state.directory,
      error: undefined,
      isLoading: true,
    });
    try {
      const directory = await this.loader({ signal: abortController.signal });
      if (
        this.disposed ||
        requestVersion !== this.requestVersion ||
        abortController.signal.aborted
      ) {
        return;
      }
      this.publish({ directory, error: undefined, isLoading: false });
    } catch (error) {
      if (
        this.disposed ||
        requestVersion !== this.requestVersion ||
        abortController.signal.aborted
      ) {
        return;
      }
      this.publish({
        directory: this.state.directory,
        error: asError(error),
        isLoading: false,
      });
    }
  }

  dispose(): void {
    this.disposed = true;
    this.requestVersion += 1;
    this.abortController?.abort();
    this.listeners.clear();
  }
}
