/**
 * @param {String} str
 * @param {{ [key: String]: String | Number }} [variables={}] Default is `{}`
 * @returns {String}
 */
export function stringTemplate(str, variables = {}) {
  return str
    .split('{{')
    .map((part) => part.split('}}'))
    .reduce((result, token) => {
      if (token.length == 1) {
        result += token[0];
      } else {
        result += variables[token[0]]?.toString();
        result += token[1];
      }
      return result;
    }, '');
}
