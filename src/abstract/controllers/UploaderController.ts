import { EventBus } from '../EventBus';
import { ConfigController } from './ConfigController';
import { LocaleController } from './LocaleController';

/**
 * Root controller — one instance per uploader scope (keyed by `ctx-name` in
 * `UploaderRegistry`). Pure logic: it does NOT import from `lit` or touch the
 * DOM, so it is constructible and testable in isolation.
 *
 * This is the strangler engine that v1's `PubSub` facade delegates to. It
 * grows by one sub-controller per migration milestone (M1 `config`, M2
 * `locale`, M3 `collection`, …).
 *
 * - `events`: the typed event bus (wired to DOM events in a later milestone).
 * - `config`: source of truth for `*cfg/*` state — `PubSubCompat` routes the
 *   config namespace here.
 * - `locale`: source of truth for `*l10n/*` state — `PubSubCompat` routes the
 *   locale namespace here.
 */
export class UploaderController {
  public readonly events = new EventBus();
  public readonly config = new ConfigController();
  public readonly locale = new LocaleController();

  public destroy(): void {
    this.events.destroy();
    this.config.destroy();
    this.locale.destroy();
  }
}
