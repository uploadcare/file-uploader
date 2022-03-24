import json from '../data/info.js'
import find from '../utils/find.js'
import error from '../utils/error.js'

/**
 * '/info?pub_key=XXXXXXXXXXXXXXXXXXXX&file_id=XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX'
 * @param {object} ctx
 */
const index = (ctx) => {
  if (ctx.query && ctx.query.file_id) {
    ctx.body = find(json, 'info')
  } else {
    error(ctx, {
      statusText: 'file_id is required.'
    })
  }
}

export { index }
