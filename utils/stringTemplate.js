const KEY_NOT_FOUND = '__KEY_NOT_FOUND__';

/**
 * @param {String} str
 * @param {{ [key: String]: String | Number }} [variables={}] Default is `{}`
 * @returns {{ string: String; missingKeys: String[] }}
 */
export function stringTemplate(str, variables = {}) {
  let missingKeys = [];
  let result = '';

  for (let part of str.split('{{')) {
    let tokens = part.split('}}');
    if (tokens.length == 1) {
      let text = tokens[0];
      result += text;
    } else {
      let [key, text] = tokens;
      let hasValue = variables[key] !== undefined;
      let value = hasValue ? variables[key].toString() : KEY_NOT_FOUND;
      !hasValue && missingKeys.push(key);

      result += value;
      result += text;
    }
  }

  return { string: result, missingKeys: missingKeys };
}
