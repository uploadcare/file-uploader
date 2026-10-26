import { describe, expect, it, vi } from 'vitest';
import { plainText } from '@/abstract/l10n';
import type { PluginSetupParams } from '@/index';
import { clickSource, createTestPlugin, modalDialog, renderSolution } from '~/tests/utils/render-solution';

type PluginActivityRegistration = Parameters<PluginSetupParams['pluginApi']['registry']['registerActivity']>[0];

const labelOf = (root: HTMLElement, id: string) => modalDialog(root, id)?.getAttribute('aria-label') ?? null;

const withActivity = (activity: Omit<PluginActivityRegistration, 'render'>) =>
  createTestPlugin({
    id: `plugin-${activity.id}`,
    setup: ({ pluginApi }) => {
      pluginApi.registry.registerActivity({ ...activity, render: () => undefined });
    },
  });

describe('plugin activity label', () => {
  it('names the dialog with plain text', async () => {
    const { root } = await renderSolution('regular', {
      plugins: [withActivity({ id: 'lbl-text', label: plainText('My panel') })],
    });

    await vi.waitFor(() => expect(labelOf(root, 'lbl-text')).toBe('My panel'));
  });

  it('names the dialog with a translated key', async () => {
    const { root } = await renderSolution('regular', {
      plugins: [withActivity({ id: 'lbl-key', label: 'upload-files' })],
    });

    await vi.waitFor(() => expect(labelOf(root, 'lbl-key')).toBe('Upload files'));
  });

  it('leaves the dialog unnamed without a label', async () => {
    const { root } = await renderSolution('regular', { plugins: [withActivity({ id: 'lbl-none' })] });

    await vi.waitFor(() => expect(modalDialog(root, 'lbl-none')).not.toBeNull());
    expect(modalDialog(root, 'lbl-none')?.hasAttribute('aria-label')).toBe(false);
  });

  it('names the dialog from the params it was opened with, and follows them', async () => {
    const label = vi.fn((params: Partial<{ name: string }>) => plainText(params.name ?? ''));
    const { root, api } = await renderSolution('regular', { plugins: [withActivity({ id: 'lbl-fn', label })] });
    await vi.waitFor(() => expect(modalDialog(root, 'lbl-fn')).not.toBeNull());
    // Closed, it sees no params: the ones in the router belong to whatever else is open.
    expect(label).toHaveBeenLastCalledWith({});
    expect(modalDialog(root, 'lbl-fn')?.hasAttribute('aria-label')).toBe(false);

    api.setCurrentActivity('lbl-fn', { name: 'One' });
    api.setModalState(true);
    await vi.waitFor(() => expect(labelOf(root, 'lbl-fn')).toBe('One'));

    api.setCurrentActivity('lbl-fn', { name: 'Two' });
    await vi.waitFor(() => expect(labelOf(root, 'lbl-fn')).toBe('Two'));
  });

  it('leaves the dialog unnamed and logs when the label throws', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { root } = await renderSolution('regular', {
      plugins: [
        withActivity({
          id: 'lbl-throws',
          label: () => {
            throw new Error('label boom');
          },
        }),
      ],
    });

    await vi.waitFor(() => expect(modalDialog(root, 'lbl-throws')).not.toBeNull());
    expect(modalDialog(root, 'lbl-throws')?.hasAttribute('aria-label')).toBe(false);
    expect(error).toHaveBeenCalledWith(
      expect.stringContaining('plugin-activity-renderer'),
      expect.stringContaining('"plugin-lbl-throws"'),
      expect.any(Error),
    );
  });

  it('names the external source dialog after the source that opened it', async () => {
    const { root } = await renderSolution('regular');

    await clickSource(root, 'Dropbox');

    await vi.waitFor(() => expect(labelOf(root, 'external')).toBe('Dropbox'));
  });
});

declare module '@/types/index' {
  interface CustomActivities {
    'lbl-fn': { params: { name: string } };
  }
}
