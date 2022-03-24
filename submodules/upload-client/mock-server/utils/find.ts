/**
 * Safely get json value.
 * @param {Record<string, unknown>} json
 * @param {string} key
 */
const find = (json: Record<string, unknown>, key: string): unknown =>
  (Object.prototype.hasOwnProperty.apply(json, [key]) && json[key]) || {}

export default find
