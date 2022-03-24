import multipartJson from '../data/multipart.js'
import infoJson from '../data/info.js'
import find from '../utils/find.js'
import error from '../utils/error.js'

/**
 * '/multipart/start/'
 * @param {object} ctx
 */
const start = (ctx) => {
  if (ctx.request.body && !ctx.request.body.filename) {
    return error(ctx, {
      statusText: 'The "filename" parameter is missing.'
    })
  }

  if (ctx.request.body && !ctx.request.body.size) {
    return error(ctx, {
      statusText: 'The provided "size" should be an integer.'
    })
  }

  if (
    ctx.request.body &&
    ctx.request.body.size &&
    ctx.request.body.size < 10485760
  ) {
    return error(ctx, {
      statusText:
        'File size can not be less than 10485760 bytes. Please use direct upload instead of multipart.'
    })
  }

  if (ctx.request.body && !ctx.request.body.content_type) {
    return error(ctx, {
      statusText: 'The "content_type" parameter is missing.'
    })
  }

  ctx.body = find(multipartJson, 'start')
}

/**
 * '/multipart/upload/'
 * @param {object} ctx
 */
const upload = (ctx) => {
  ctx.status = 200
}

/**
 * '/multipart/complete/'
 * @param {object} ctx
 */
const complete = (ctx) => {
  if (ctx.request.body && !ctx.request.body.uuid) {
    return error(ctx, {
      statusText: 'uuid is required.'
    })
  }

  // eslint-disable-next-line require-atomic-updates
  ctx.body = find(infoJson, 'info')
}

export { start, upload, complete }
