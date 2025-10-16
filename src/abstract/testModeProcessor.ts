import type { Block } from './Block';

export function testModeProcessor<T extends Block>(fr: DocumentFragment, fnCtx: T): void {
  const elementsWithTestId = fr.querySelectorAll('[data-testid]');
  if (elementsWithTestId.length === 0) {
    return;
  }
  const valuesPerElement = new WeakMap();

  for (const el of elementsWithTestId) {
    const testIdValue = el.getAttribute('data-testid');
    if (testIdValue) {
      valuesPerElement.set(el, testIdValue);
    }
  }

  fnCtx.subConfigValue('testMode', (testMode) => {
    if (!testMode) {
      for (const el of elementsWithTestId) {
        el.removeAttribute('data-testid');
      }
      return;
    }

    const testIdPrefix = fnCtx.testId;
    for (const el of elementsWithTestId) {
      const testIdValue = valuesPerElement.get(el);
      if (!testIdValue) {
        continue;
      }
      el.setAttribute(`data-testid`, `${testIdPrefix}--${testIdValue}`);
    }
  });
}
