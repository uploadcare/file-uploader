/** @typedef {{ [key: String]: String | Number | Boolean | InputData }} InputData */

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
export function applyTemplateData(template, data, options = {}) {
  let { openToken = '{{', closeToken = '}}', transform = DEFAULT_TRANSFORMER } = options;
  for (let key in data) {
    let value = data[key]?.toString();
    template = template.replaceAll(openToken + key + closeToken, typeof value === 'string' ? transform(value) : value);
  }
  return template;
}
