import { afterEach, describe, expect, it } from 'vitest';
import { UploaderRegistry } from '../../../abstract/UploaderRegistry';
import { ensureUploaderCtx } from '../../../lit/ensureUploaderCtx';
import { delay } from '../../../utils/delay';
import { CameraSettingsPopup } from './CameraSettingsPopup';
import type { SettingSectionData } from './settingsView';

CameraSettingsPopup.reg('uc-camera-settings');

const ctxName = 'camera-settings-popup-spec';
const mounted: HTMLElement[] = [];

afterEach(() => {
  for (const el of mounted.splice(0)) el.remove();
  UploaderRegistry.dispose(ctxName);
});

const cameras = (...ids: string[]): SettingSectionData => ({
  key: 'camera',
  labelKey: 'caption-camera',
  hidden: false,
  value: 'cam-b',
  options: ids.map((id) => ({ value: id, text: id })),
});

const microphones = (disabled = false): SettingSectionData => ({
  key: 'microphone',
  labelKey: 'camera-microphone',
  hidden: false,
  disabled,
  value: 'mic-a',
  options: [
    { value: 'mic-a', text: 'mic-a' },
    { value: 'mic-b', text: 'mic-b' },
  ],
});

const mount = async (sections: SettingSectionData[]): Promise<CameraSettingsPopup> => {
  ensureUploaderCtx(ctxName);
  const el = document.createElement('uc-camera-settings');
  el.setAttribute('ctx-name', ctxName);
  el.buttonHidden = false;
  el.sections = sections;
  document.body.append(el);
  mounted.push(el);
  await el.updateComplete;
  return el;
};

const section = (el: CameraSettingsPopup, key: SettingSectionData['key']) =>
  el.querySelector<HTMLDetailsElement>(`details[data-setting="${key}"]`);

/** Clicks a section's heading, then lets its `toggle` event and the render it causes land. */
const clickHeading = async (el: CameraSettingsPopup, key: SettingSectionData['key']) => {
  section(el, key)?.querySelector('summary')?.click();
  await delay(0);
  await el.updateComplete;
};

const radio = (el: CameraSettingsPopup, value: string) =>
  el.querySelector<HTMLInputElement>(`input[type="radio"][value="${value}"]`);

describe('CameraSettingsPopup', () => {
  it('keeps focus on the same device when one before it leaves the list', async () => {
    const el = await mount([cameras('cam-a', 'cam-b', 'cam-c')]);
    radio(el, 'cam-b')?.focus();

    el.sections = [cameras('cam-b', 'cam-c')];
    await el.updateComplete;

    expect(document.activeElement).toBe(radio(el, 'cam-b'));
  });

  it('opens one section at a time', async () => {
    const el = await mount([cameras('cam-a', 'cam-b'), microphones()]);

    await clickHeading(el, 'camera');
    expect(section(el, 'camera')?.open).toBe(true);

    await clickHeading(el, 'microphone');
    expect(section(el, 'microphone')?.open).toBe(true);
    expect(section(el, 'camera')?.open).toBe(false);
  });

  it('shuts an open section that turns disabled, and keeps it shut once enabled again', async () => {
    const el = await mount([cameras('cam-a', 'cam-b'), microphones()]);
    await clickHeading(el, 'microphone');
    expect(section(el, 'microphone')?.open).toBe(true);

    el.sections = [cameras('cam-a', 'cam-b'), microphones(true)];
    await el.updateComplete;
    await delay(0);
    expect(section(el, 'microphone')?.open).toBe(false);

    el.sections = [cameras('cam-a', 'cam-b'), microphones()];
    await el.updateComplete;
    expect(section(el, 'microphone')?.open).toBe(false);
  });

  it('keeps a lone section open, disabled or not', async () => {
    const el = await mount([microphones(true)]);

    expect(section(el, 'microphone')?.open).toBe(true);
  });

  it("doesn't open a disabled section on click", async () => {
    const el = await mount([cameras('cam-a', 'cam-b'), microphones(true)]);

    await clickHeading(el, 'microphone');

    expect(section(el, 'microphone')?.open).toBe(false);
  });
});
