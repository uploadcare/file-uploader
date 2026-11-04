type InputData = {
  [key: string]: string | number | boolean | InputData;
};

type Transformer = (value: string) => string;

type Options = {
  transform?: Transformer;
};

const DEFAULT_TRANSFORMER: Transformer = (value) => value;
const OPEN_TOKEN = '{{';
const CLOSE_TOKEN = '}}';
const PLURAL_PREFIX = 'plural:';

export function applyTemplateData(template: string, data: InputData = {}, options: Options = {}): string {
  const { transform = DEFAULT_TRANSFORMER } = options;

  for (const key in data) {
    const rawValue = data[key];
    const replacement = rawValue != null ? transform(String(rawValue)) : 'undefined';
    template = template.replaceAll(OPEN_TOKEN + key + CLOSE_TOKEN, replacement);
  }
  return template;
}

export function getPluralObjects(
  template: string,
): Array<{ variable: string; pluralKey: string; countVariable: string }> {
  const pluralObjects: Array<{ variable: string; pluralKey: string; countVariable: string }> = [];
  let open = template.indexOf(OPEN_TOKEN);
  while (open !== -1) {
    const close = template.indexOf(CLOSE_TOKEN, open);
    if (close === -1) {
      break;
    }
    const variable = template.substring(open + 2, close);
    if (variable.startsWith(PLURAL_PREFIX)) {
      const keyValue = template.substring(open + 2, close).replace(PLURAL_PREFIX, '');
      const key = keyValue.substring(0, keyValue.indexOf('('));
      const count = keyValue.substring(keyValue.indexOf('(') + 1, keyValue.indexOf(')'));
      pluralObjects.push({ variable, pluralKey: key, countVariable: count });
    }
    open = template.indexOf(OPEN_TOKEN, close);
  }
  return pluralObjects;
}
