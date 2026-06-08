import type { SourceButtonConfig } from '../../blocks/SourceBtn/SourceBtn';
import { stringToArray } from '../../utils/stringToArray';
import { Listeners } from '../host-subscription';
import type { ConfigController } from './ConfigController';
import type { PluginRegistryController } from './PluginRegistryController';
import type { UploaderController } from './UploaderController';

/**
 * Sub-controller that owns the resolved source list. Watches the two
 * inputs that affect it — `config.sourceList` and the plugin registry
 * (sources can install / expand) — and emits a single "sources
 * changed" notification when the shape actually shifts.
 *
 * Consumers (`<uc-source-list>`, `<uc-dynamic-btn>`) read `.list` and
 * subscribe via `subscribe(listener)`. Replaces having each block
 * subscribe to `config` + `plugins` separately for source-list
 * reactivity, and dedups the notifications (e.g., installing several
 * sources in one task fires once after the microtask drains).
 *
 * Conceptually the v2 equivalent of v1's `SourceListController`
 * (`src/abstract/controllers/SourceListController.ts`), but lives on
 * `UploaderController` instead of being a per-host
 * `Lit ReactiveController` — fits v2's "sub-controller + subscribe"
 * pattern already used by `config`, `locale`, `plugins`, etc.
 */
export class SourcesController {
  private _list: SourceButtonConfig[] = [];
  private _listeners = new Listeners();
  private _unsubs: Array<() => void> = [];
  private _refreshScheduled = false;

  public constructor(
    private _controller: UploaderController,
    config: ConfigController,
    plugins: PluginRegistryController,
  ) {
    this._unsubs.push(config.subscribe(() => this._scheduleRefresh()));
    this._unsubs.push(plugins.subscribe(() => this._scheduleRefresh()));
    // Initial snapshot. Both upstream controllers are wired by the
    // time SourcesController is instantiated.
    this._list = resolveSources(this._controller);
  }

  /** Current resolved source list — safe to render directly. */
  public get list(): readonly SourceButtonConfig[] {
    return this._list;
  }

  /**
   * Subscribe to source-list changes. Fires once per tick when the
   * resolved list's shape (id + label) actually changes — equality
   * checked via `sourcesEqual`.
   */
  public subscribe(listener: () => void): () => void {
    return this._listeners.subscribe(listener);
  }

  // Coalesce config + plugins notifications: installing several sources
  // (or several config updates) in one task fires one refresh.
  private _scheduleRefresh(): void {
    if (this._refreshScheduled) return;
    this._refreshScheduled = true;
    queueMicrotask(() => {
      this._refreshScheduled = false;
      this._refresh();
    });
  }

  private _refresh(): void {
    const next = resolveSources(this._controller);
    if (sourcesEqual(this._list, next)) return;
    this._list = next;
    this._listeners.notify();
  }

  public destroy(): void {
    for (const u of this._unsubs) u();
    this._unsubs = [];
    this._listeners.clear();
  }
}

/**
 * Walks `config.sourceList` against the plugin registry: looks up each
 * source by id, calls `expand()` (camera fans out to mobile photo/video
 * on htmlMediaCapture devices), and produces a flat `SourceButtonConfig`
 * array ready to render.
 */
function resolveSources(controller: UploaderController): SourceButtonConfig[] {
  const cfg = controller.config.values as { sourceList?: string };
  const raw = stringToArray(cfg.sourceList ?? '');
  const registered = controller.plugins.sources;
  const byId = new Map(registered.map((s) => [s.id, s]));

  const out: SourceButtonConfig[] = [];
  for (const name of raw) {
    const src = byId.get(name);
    if (!src) continue;
    const expanded = src.expand?.() ?? [name];
    const expandedDiffer = expanded.length !== 1 || expanded[0] !== name;
    if (expandedDiffer) {
      for (const id of expanded) {
        const inner = byId.get(id);
        if (inner) out.push(toSourceConfig(inner));
      }
    } else {
      out.push(toSourceConfig(src));
    }
  }
  return out;
}

/** Shallow id + label equality. Skips redundant `notify()` calls. */
function sourcesEqual(a: SourceButtonConfig[], b: SourceButtonConfig[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    const y = b[i];
    if (!x || !y) return false;
    if (x.id !== y.id || x.label !== y.label) return false;
  }
  return true;
}

/** Maps a plugin source registration to a `SourceButtonConfig`. */
function toSourceConfig(s: { id: string; label?: string; icon?: string; onSelect: () => void }): SourceButtonConfig {
  return {
    id: s.id,
    label: s.label ?? s.id,
    icon: s.icon,
    onClick: () => s.onSelect(),
  };
}
