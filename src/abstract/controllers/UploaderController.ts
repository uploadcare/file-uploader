import { EventBus } from '../EventBus';

/**
 * Root controller — one instance per uploader scope (keyed by `ctx-name` in
 * `UploaderRegistry`). Pure logic: it does NOT import from `lit` or touch the
 * DOM, so it is constructible and testable in isolation.
 *
 * This is the strangler engine that v1's `PubSub` facade will eventually
 * delegate to. It starts minimal and grows by one sub-controller per
 * migration milestone (M1 `config`, M2 `locale`, M3 `collection`, …). For
 * now it owns only the event bus and is wired to nothing.
 */
export class UploaderController {
  public readonly events = new EventBus();

  public destroy(): void {
    this.events.destroy();
  }
}
