/**
 * @param {String} template
 * @param {{ [key: String]: String | Number }} [data={}] Default is `{}`
 * @param {String} [openToken='{{'] Default is `'{{'`
 * @param {String} [closeToken='}}'] Default is `'}}'`
 * @returns {String}
 */
export function applyTemplateData(template, data, openToken = '{{', closeToken = '}}') {
  for (let key in data) {
    template = template.replaceAll(openToken + key + closeToken, data[key]?.toString());
  }
  return template;
}
