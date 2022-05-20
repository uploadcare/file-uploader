/** @typedef {{ [key: String]: String | Number | Boolean | InputData }} InputData */

import { getProperty } from './getProperty.js';

const DEFAULT_TRANSFORMER = (value) => value;

/**
 * @typedef {Object} Options
 * @property {String} [openToken='{{'] Default is `'{{'`
 * @property {String} [closeToken='}}'] Default is `'}}'`
 * @property {(value: String) => String} [transform=DEFAULT_TRANSFORMER] Default is `DEFAULT_TRANSFORMER`
 */

/**
 * @param {String} template
 * @param {InputData} [data={}] Default is `{}`
 * @param {Options} [options={}] Default is `{}`
 * @returns {String}
 */
export function applyTemplateData(
  template,
  data,
  { openToken = '{{', closeToken = '}}', transform = DEFAULT_TRANSFORMER } = {}
) {
  let result = '';

  for (let part of template.split(openToken)) {
    let tokens = part.split(closeToken);
    if (tokens.length == 1) {
      let text = tokens[0];
      result += text;
    } else {
      let [path, text] = tokens;
      let value = getProperty(data, path)?.toString();
      if (typeof value === 'string') {
        result += transform(value);
      } else {
        result += openToken + path + closeToken;
      }
      result += text;
    }
  }

  return result;
}
