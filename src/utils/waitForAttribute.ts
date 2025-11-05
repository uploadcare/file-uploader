import { withResolvers } from './withResolvers';

type WaitForAttributeOptions = {
  element: HTMLElement;
  attribute: string;
  timeout?: number;
};

type ResolvedValue =
  | {
      success: true;
      value: string;
      attribute: string;
    }
  | {
      success: false;
      attribute: string;
    };

export const waitForAttribute = async ({
  element,
  attribute,
  timeout = 300,
}: WaitForAttributeOptions): Promise<ResolvedValue> => {
  const { promise, resolve } = withResolvers<ResolvedValue, never>();

  const currentAttrValue = element.getAttribute(attribute);
  if (currentAttrValue !== null) {
    resolve({
      success: true,
      value: currentAttrValue,
      attribute,
    });
    return promise;
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
    resolve({
      success: false,
      attribute,
    });
  }, timeout);

  const handleMutation = (mutation: MutationRecord): void => {
    const attrValue = element.getAttribute(attribute);
    if (mutation.type === 'attributes' && mutation.attributeName === attribute && attrValue !== null) {
      window.clearTimeout(timeoutId);
      observer.disconnect();
      resolve({
        success: true,
        value: attrValue,
        attribute,
      });
    }
  };

  return promise;
};
