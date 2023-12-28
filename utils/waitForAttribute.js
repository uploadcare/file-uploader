// @ts-check

/**
 * @param {{
 *   element: HTMLElement;
 *   attribute: string;
 *   onSuccess: (value: string) => void;
 *   onTimeout: () => void;
 *   timeout?: number;
 * }} options
 */
export const waitForAttribute = ({ element, attribute, onSuccess, onTimeout, timeout = 300 }) => {
  const currentAttrValue = element.getAttribute(attribute);
  if (currentAttrValue !== null) {
    onSuccess(currentAttrValue);
    return;
  }

  const observer = new MutationObserver((mutations) => {
    const mutation = mutations[mutations.length - 1];
    handleMutation(mutation);
  });

  observer.observe(element, {
    attributes: true,
    attributeFilter: [attribute],
  });

  const timeoutId = setTimeout(() => {
    observer.disconnect();
    onTimeout();
  }, timeout);

  /** @param {MutationRecord} mutation */
  const handleMutation = (mutation) => {
    const attrValue = element.getAttribute(attribute);
    if (mutation.type === 'attributes' && mutation.attributeName === attribute && attrValue !== null) {
      clearTimeout(timeoutId);
      observer.disconnect();
      onSuccess(attrValue);
    }
  };
};
