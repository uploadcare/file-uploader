import { signalState } from '../di/signalState';

/**
 * Boot-time identity of an uploader scope. Container-owned.
 *
 * `solutionName` is the solution (preset) tag that owns this scope — a
 * boot-time fact set once by the solution element and read lazily by telemetry
 * (`TelemetryManager`'s `getSolution` closure). It is backed by a
 * `@signalState` field so a future `SignalWatcher` consumer can track it, but
 * it is not reactive DOM state today; behavior matches v1's `pub('*solution',
 * …)` last-writer semantics.
 */
export class AppInfo {
  // Stored lowercased, payload-ready — set once (last-writer-wins) by the
  // solution element, read lazily by telemetry.
  @signalState() private _solutionName: string | null = null;

  public get solutionName(): string | null {
    return this._solutionName;
  }

  /**
   * Register the solution (preset) owning this scope. Several solutions may
   * share one `ctx-name` (a supported composition — e.g. an uploader plus a
   * standalone editor); the most recently initialized one identifies the
   * scope, matching v1's `pub('*solution', …)` last-writer semantics.
   */
  public setSolutionName(name: string): void {
    this._solutionName = name.toLowerCase();
  }

  // Whether the solution owning this scope shows activities in a modal, declared by it (`SolutionChildBlock.hasModal`).
  @signalState() private _hasModal = true;

  public get hasModal(): boolean {
    return this._hasModal;
  }

  public setHasModal(hasModal: boolean): void {
    this._hasModal = hasModal;
  }
}
