type ClassNameMapping = Record<string, boolean | undefined | null>;
type ClassNameArg = string | ClassNameMapping;

function normalize(...args: ClassNameArg[]): Record<string, boolean | undefined | null> {
  return args.reduce<Record<string, boolean | undefined | null>>((result, arg) => {
    if (typeof arg === 'string') {
      result[arg] = true;
      return result;
    }

    for (const token of Object.keys(arg)) {
      result[token] = arg[token];
    }

    return result;
  }, {});
}

export function classNames(...args: ClassNameArg[]): string {
  const mapping = normalize(...args);
  return Object.keys(mapping)
    .reduce<string[]>((result, token) => {
      if (mapping[token]) {
        result.push(token);
      }

      return result;
    }, [])
    .join(' ');
}

export function applyClassNames(element: Element, ...args: ClassNameArg[]): void {
  const mapping = normalize(...args);
  for (const token of Object.keys(mapping)) {
    element.classList.toggle(token, Boolean(mapping[token]));
  }
}
