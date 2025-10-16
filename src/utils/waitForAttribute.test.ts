import { describe, expect, it, vi } from 'vitest';
import { delay } from './delay';
import { waitForAttribute } from './waitForAttribute';

const TEST_ATTRIBUTE = 'test-attribute';

describe('waitForAttribute', () => {
  it('should call onTimeout callback when timeout is over', async () => {
    const element = document.createElement('div');
    const onSuccess = vi.fn();
    const onTimeout = vi.fn();
    waitForAttribute({
      element,
      attribute: TEST_ATTRIBUTE,
      onSuccess,
      onTimeout,
      timeout: 10,
    });
    await delay(100);
    expect(onSuccess).not.toHaveBeenCalled();
    expect(onTimeout).toHaveBeenCalledTimes(1);
  });
  it('should call onSuccess callback when attribute is set async', async () => {
    const element = document.createElement('div');
    const onSuccess = vi.fn();
    const onTimeout = vi.fn();
    waitForAttribute({
      element,
      attribute: TEST_ATTRIBUTE,
      onSuccess,
      onTimeout,
      timeout: 10,
    });
    element.setAttribute(TEST_ATTRIBUTE, 'test');
    await delay(100);
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onSuccess).toHaveBeenCalledWith('test');
    expect(onTimeout).not.toHaveBeenCalled();
  });
  it('should call onSuccess callback when attribute is set sync', async () => {
    const element = document.createElement('div');
    element.setAttribute(TEST_ATTRIBUTE, 'test');
    const onSuccess = vi.fn();
    const onTimeout = vi.fn();
    waitForAttribute({
      element,
      attribute: TEST_ATTRIBUTE,
      onSuccess,
      onTimeout,
      timeout: 10,
    });
    await delay(100);
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onSuccess).toHaveBeenCalledWith('test');
    expect(onTimeout).not.toHaveBeenCalled();
  });

  it('should not call onSuccess on the second attribute change', async () => {
    const element = document.createElement('div');
    element.setAttribute(TEST_ATTRIBUTE, 'test');
    const onSuccess = vi.fn();
    const onTimeout = vi.fn();
    waitForAttribute({
      element,
      attribute: TEST_ATTRIBUTE,
      onSuccess,
      onTimeout,
      timeout: 10,
    });
    await delay(100);
    element.setAttribute(TEST_ATTRIBUTE, 'tes2');
    await delay(100);
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onSuccess).toHaveBeenCalledWith('test');
    expect(onTimeout).not.toHaveBeenCalled();
  });
});
