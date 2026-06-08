import { describe, expect, it, vi } from 'vitest';
import { PluginRegistryController } from './PluginRegistryController';

// Notification is batched via `debounce(notify, 0)` — flush a macrotask to let it fire.
const flushBatch = () => new Promise((resolve) => setTimeout(resolve, 0));

/**
 * The registry notifies subscribers (batched) on change. Contributions often
 * arrive in a synchronous burst — a plugin's setup() registering an icon, a
 * source and several l10n maps in one tick, or a locale switch re-registering
 * strings. A burst must coalesce into a single notification, and a later-tick
 * registration must notify again so consumers re-apply lazily-loaded state.
 */
describe('PluginRegistryController — batched change notification', () => {
  it('notifies once for a synchronous burst, on the next macrotask', async () => {
    const registry = new PluginRegistryController();
    const listener = vi.fn();
    registry.subscribe(listener);

    registry.registerIcon('my-icon', '<svg/>');
    registry.registerSource({ id: 's', label: 'Source', onSelect: () => {} });
    registry.registerAction({ id: 'a', label: 'Action', onClick: () => {} });

    // Batched: nothing fired synchronously.
    expect(listener).not.toHaveBeenCalled();

    await flushBatch();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('re-notifies for a registration on a later tick', async () => {
    const registry = new PluginRegistryController();
    const listener = vi.fn();
    registry.subscribe(listener);

    registry.registerSource({ id: 's1', onSelect: () => {} });
    await flushBatch();
    expect(listener).toHaveBeenCalledTimes(1);

    registry.registerSource({ id: 's2', onSelect: () => {} });
    await flushBatch();
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('does not notify after destroy()', async () => {
    const registry = new PluginRegistryController();
    const listener = vi.fn();
    registry.subscribe(listener);

    registry.registerSource({ id: 's', onSelect: () => {} });
    registry.destroy();

    await flushBatch();
    expect(listener).not.toHaveBeenCalled();
  });
});
