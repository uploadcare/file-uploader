type WaitForAttributeOptions = {
  element: HTMLElement;
  attribute: string;
  onSuccess: (value: string) => void;
  onTimeout: () => void;
  timeout?: number;
};

export const waitForAttribute = ({
  element,
  attribute,
  onSuccess,
  onTimeout,
  timeout = 300,
}: WaitForAttributeOptions): void => {
  const currentAttrValue = element.getAttribute(attribute);
  if (currentAttrValue !== null) {
    onSuccess(currentAttrValue);
    return;
  }

  const observer = new MutationObserver((mutations) => {
    const mutation = mutations[mutations.length - 1];
    if (mutation) {
      handleMutation(mutation);
    }
  });

  observer.observe(element, {
    attributes: true,
    attributeFilter: [attribute],
  });

  const timeoutId = window.setTimeout(() => {
    observer.disconnect();
    onTimeout();
  }, timeout);

  const handleMutation = (mutation: MutationRecord): void => {
    const attrValue = element.getAttribute(attribute);
    if (mutation.type === 'attributes' && mutation.attributeName === attribute && attrValue !== null) {
      window.clearTimeout(timeoutId);
      observer.disconnect();
      onSuccess(attrValue);
    }
  };
};
