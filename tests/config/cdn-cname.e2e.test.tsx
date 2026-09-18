import { describe, expect, it } from 'vitest';
import '~/types/jsx';
import { renderSolution } from '~/tests/utils/render-solution';

// No pubkey: these tests set it themselves and watch what `cdnCname` derives from it.
const render = (configProps: Parameters<typeof renderSolution>[1] = {}) =>
  renderSolution('regular', configProps, { pubkey: null });

describe('cdnCname', () => {
  it('is ucarecdn.com by default', async () => {
    const { config } = await render();
    expect(config.cdnCname).toBe('https://ucarecdn.com');
  });

  it('updates synchronously', async () => {
    const { config } = await render();
    config.cdnCname = 'https://cdn.example.com';
    expect(config.cdnCname).toBe('https://cdn.example.com');
  });

  it('is derived asynchronously from the pubkey when no custom domain is set', async () => {
    const { config } = await render();
    config.pubkey = 'demopublickey';
    expect(config.cdnCname).toBe('https://ucarecdn.com');
    await expect.poll(() => config.cdnCname).toBe('https://1s4oyld5dc.ucarecd.net');
  });

  it('is not derived when a custom domain is set', async () => {
    const { config } = await render();
    config.cdnCname = 'https://cdn.example.com';
    config.pubkey = 'demopublickey';
    await expect.poll(() => config.cdnCname).toBe('https://cdn.example.com');
  });

  it('is derived again when the pubkey changes and no custom domain is present', async () => {
    const { config } = await render();
    config.pubkey = 'demopublickey';
    await expect.poll(() => config.cdnCname).toBe('https://1s4oyld5dc.ucarecd.net');
    config.pubkey = 'anotherpublickey';
    await expect.poll(() => config.cdnCname).toBe('https://t8zl5ek5q1.ucarecd.net');
  });

  it('is read from the attribute when no pubkey is defined', async () => {
    const { config } = await render({ cdnCname: 'https://cdn.example.com' });
    expect(config.cdnCname).toBe('https://cdn.example.com');
  });
});
