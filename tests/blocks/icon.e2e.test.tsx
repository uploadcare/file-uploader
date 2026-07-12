import { beforeAll, describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import type { Config, Icon, UploaderPlugin } from '@/index.ts';
import { delay } from '@/utils/delay';
import { getCtxName } from '../utils/getCtxName';
import '../../types/jsx';

beforeAll(async () => {
  const UC = await import('@/index.js');
  UC.defineComponents(UC);
});

const renderIcon = (name: string) => {
  const ctxName = getCtxName();
  page.render(
    <>
      <uc-icon ctx-name={ctxName}></uc-icon>
      <uc-config ctx-name={ctxName} pubkey="demopublickey" testMode></uc-config>
    </>,
  );
  const config = page.getByTestId('uc-config').query()! as Config;
  const icon = document.querySelector('uc-icon')! as Icon;
  // `name` isn't part of the JSX `CustomElement<Icon>` attribute typing
  // (only reflected properties are), so it's set as a JS property post-render.
  icon.name = name;
  return { ctxName, config, icon };
};

const useHref = () => document.querySelector('uc-icon svg use')?.getAttribute('href');

describe('uc-icon', () => {
  it('renders a sprite reference for the given name and is aria-hidden', async () => {
    const { icon } = renderIcon('upload');
    await expect.poll(useHref).toBe('#uc-icon-upload');
    expect(icon.getAttribute('aria-hidden')).toBe('true');
  });

  it('updates the sprite reference when name changes', async () => {
    const { icon } = renderIcon('upload');
    await expect.poll(useHref).toBe('#uc-icon-upload');
    icon.name = 'close';
    await expect.poll(useHref).toBe('#uc-icon-close');
  });

  it('resolves the href through iconHrefResolver when configured', async () => {
    const { config } = renderIcon('upload');
    config.iconHrefResolver = (name: string) => `/sprite.svg#${name}`;
    await expect.poll(useHref).toBe('/sprite.svg#upload');

    config.iconHrefResolver = null;
    await expect.poll(useHref).toBe('#uc-icon-upload');
  });

  it('renders a plugin-registered icon inline, overriding the sprite', async () => {
    // The plugin registry is only wired up to `cfg.plugins` changes when a
    // `*lazyPlugins` list has been published to the shared ctx — that only
    // happens once a solution block (e.g. `uc-file-uploader-regular`) is
    // present. Without one, `LazyPluginLoader` sees zero entries and never
    // subscribes to plugin config changes at all, so `config.plugins` writes
    // would be silently dropped.
    const ctxName = getCtxName();
    page.render(
      <>
        <uc-icon ctx-name={ctxName} class="icon-under-test"></uc-icon>
        <uc-config ctx-name={ctxName} pubkey="demopublickey" testMode></uc-config>
        <uc-file-uploader-regular ctx-name={ctxName}></uc-file-uploader-regular>
      </>,
    );
    const config = page.getByTestId('uc-config').query()! as Config;
    // The solution block renders its own internal `uc-icon`s, so scope all
    // lookups to our icon under test instead of querying the whole document.
    const testedIcon = () => document.querySelector('uc-icon.icon-under-test')!;
    (testedIcon() as Icon).name = 'my-plugin-icon';
    const testedIconHref = () => testedIcon().querySelector('svg use')?.getAttribute('href');
    await expect.poll(testedIconHref).toBe('#uc-icon-my-plugin-icon');

    const plugin: UploaderPlugin = {
      id: 'icon-test-plugin',
      setup: ({ pluginApi }) => {
        pluginApi.registry.registerIcon({
          name: 'my-plugin-icon',
          svg: '<svg viewBox="0 0 24 24"><rect width="24" height="24"/></svg>',
        });
      },
    };
    await delay(0);
    config.plugins = [plugin];

    await expect.poll(() => testedIcon().querySelector('svg[viewBox="0 0 24 24"] rect')).toBeTruthy();
    expect(testedIcon().querySelector('svg use')).toBeNull();
  });

  it('renders an empty reference when name is empty', async () => {
    renderIcon('');
    await expect.poll(() => document.querySelector('uc-icon svg use')).toBeTruthy();
    expect(useHref()).toBe('');
  });
});
