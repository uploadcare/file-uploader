/**
 * Boot-time identity of an uploader scope. Container-owned.
 *
 * `solutionName` is the solution (preset) tag that owns this scope — a
 * boot-time fact set by the solution element and read imperatively by
 * `TelemetryManager`. Plain fields: nothing tracks them reactively. Behavior
 * matches v1's `pub('*solution', …)` last-writer semantics.
 */
export class AppInfo {
  // Stored lowercased, payload-ready — set once (last-writer-wins) by the
  // solution element, read lazily by telemetry.
  private _solutionName: string | null = null;

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
  private _hasModal = true;

  public get hasModal(): boolean {
    return this._hasModal;
  }

  public setHasModal(hasModal: boolean): void {
    this._hasModal = hasModal;
  }
}
