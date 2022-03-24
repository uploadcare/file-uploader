import json from '../data/base.js'
import find from '../utils/find.js'

/**
 * '/base/'
 * @param {object} ctx
 */
const index = (ctx) => {
  ctx.body = find(json, 'info')
}

export { index }
