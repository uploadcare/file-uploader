import { describe, expect, it, vi } from 'vitest';
import { PluginRegistry } from './PluginRegistry';

// The notification is batched via `debounce(onChange, 0)`, i.e. a 0ms timer —
// flush a macrotask to let it fire.
const flushBatch = () => new Promise((resolve) => setTimeout(resolve, 0));

/**
 * The registry notifies (batched) on every successful registration.
 * Registrations can happen lazily, long after a plugin's setup() ran (e.g.
 * registering a locale's strings when `localeName` changes), so consumers must
 * be told to re-apply the new state — without this, late `addL10n` calls never
 * reach rendered labels. A synchronous burst coalesces into a single call.
 */
describe('PluginRegistry — batched change notification', () => {
  it('notifies once for a synchronous burst of registrations, on the next microtask', async () => {
    const onChange = vi.fn();
    const registry = new PluginRegistry(onChange);

    registry.addL10n('p', { en: { 'my-key': 'My value' } });
    registry.addIcon('p', { name: 'my-icon', svg: '<svg/>' });
    registry.addFileAction('p', {
      id: 'fa',
      label: 'Action',
      icon: 'my-icon',
      shouldRender: () => true,
      onClick: () => {},
    });
    registry.addSource('p', { id: 's', label: 'Source', onSelect: () => {} });

    // Batched: nothing fired synchronously.
    expect(onChange).not.toHaveBeenCalled();

    await flushBatch();
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(registry.snapshot().l10n).toHaveLength(1);
  });

  it('notifies again for a later (separate-tick) registration', async () => {
    const onChange = vi.fn();
    const registry = new PluginRegistry(onChange);

    registry.addL10n('p', { en: { a: '1' } });
    await flushBatch();
    expect(onChange).toHaveBeenCalledTimes(1);

    // A registration in a later tick (e.g. a locale loaded on demand) re-notifies.
    registry.addL10n('p', { de: { a: 'eins' } });
    await flushBatch();
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it('does not notify when a duplicate source is skipped', async () => {
    const onChange = vi.fn();
    const registry = new PluginRegistry(onChange);

    registry.addSource('p', { id: 's', label: 'Source', onSelect: () => {} });
    registry.addSource('p2', { id: 's', label: 'Other', onSelect: () => {} }); // duplicate id → skipped

    await flushBatch();
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(registry.snapshot().sources).toHaveLength(1);
  });
});
