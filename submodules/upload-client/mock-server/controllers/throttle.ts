import error from '../utils/error.js'

let times = 0

/**
 * '/throttle/'
 * @param {object} ctx
 */
const index = (ctx) => {
  times++

  if (times === 2) {
    times = 0

    return (ctx.status = 200)
  } else {
    return error(ctx, {
      status: 429,
      statusText: 'Request was throttled.'
    })
  }
}

export { index }
