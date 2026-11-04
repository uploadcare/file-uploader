import { describe, expect, it } from 'vitest';
import { ControllerContainer } from '../di/ControllerContainer';
import { AppInfo } from './AppInfo';

describe('AppInfo', () => {
  it('starts with a null solutionName', () => {
    expect(new AppInfo().solutionName).toBeNull();
  });

  it('stores the name lowercased (solution tag names arrive uppercase)', () => {
    const appInfo = new AppInfo();

    appInfo.setSolutionName('UC-FILE-UPLOADER-REGULAR');

    expect(appInfo.solutionName).toBe('uc-file-uploader-regular');
  });

  it('lets the most recently set solution identify the scope (last-writer-wins)', () => {
    const appInfo = new AppInfo();

    // Several solutions sharing one ctx-name is a supported composition
    // (e.g. uploader + standalone editor) — v1 pub last-writer parity.
    appInfo.setSolutionName('UC-FILE-UPLOADER-REGULAR');
    appInfo.setSolutionName('UC-CLOUD-IMAGE-EDITOR');

    expect(appInfo.solutionName).toBe('uc-cloud-image-editor');
  });

  it('is container-resolvable as a cached singleton', () => {
    const container = new ControllerContainer();

    const appInfo = container.get(AppInfo);
    appInfo.setSolutionName('UC-FILE-UPLOADER-MINIMAL');

    // Same instance on every access, so the write is observed by every reader.
    expect(container.get(AppInfo)).toBe(appInfo);
    expect(container.get(AppInfo).solutionName).toBe('uc-file-uploader-minimal');
  });
});
