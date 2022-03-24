import jsonIndex from '../data/from_url/index.js'
import jsonStatus from '../data/from_url/status.js'
import find from '../utils/find.js'
import error from '../utils/error.js'

import { PORT } from '../config.js'

interface State {
  isComputable: boolean
  done: number
  total: number
}

interface ProgressResponse {
  done: number
  total: number | 'unknown'
}

const state: {
  [key: string]: State
} = {}

/**
 * '/from_url/?pub_key=XXXXXXXXXXXXXXXXXXXX'
 * @param {object} ctx
 */
const index = (ctx) => {
  const isPrivateIP = (url: string): boolean =>
    url.includes('192.168.') ||
    (url.includes('localhost') && !url.includes(`http://localhost:${PORT}/`))
  const doesNotExist = (url: string): boolean => url === 'https://1.com/1.jpg'

  const publicKey = ctx.query && ctx.query.pub_key
  const sourceUrl = ctx.query && ctx.query.source_url
  const checkForUrlDuplicates = !!parseInt(
    ctx.query && ctx.query.check_URL_duplicates
  )
  const saveUrlForRecurrentUploads = !!parseInt(
    ctx.query && ctx.query.save_URL_duplicates
  )

  // Check params
  if (!sourceUrl) {
    error(ctx, {
      statusText: 'source_url is required.'
    })

    return
  }

  if (doesNotExist(sourceUrl)) {
    error(ctx, {
      statusText: 'Host does not exist.'
    })

    return
  }

  if (isPrivateIP(sourceUrl)) {
    error(ctx, {
      statusText: 'Only public IPs are allowed.'
    })

    return
  }

  if (checkForUrlDuplicates === true && saveUrlForRecurrentUploads === true) {
    ctx.body = find(jsonIndex, 'info')
    return
  }

  const token = `token-${Date.now()}`
  state[token] = {
    isComputable: publicKey !== 'pub_test__unknown_progress',
    total: 100,
    done: 0
  }

  const response = find(jsonIndex, 'token') as { [key: string]: string }
  response.token = token

  ctx.body = response
}

/**
 * '/from_url/status/?pub_key=XXXXXXXXXXXXXXXXXXXX&token=XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX'
 * @param {object} ctx
 */
const status = (ctx) => {
  const token = ctx.query && ctx.query.token

  if (token) {
    const tokenState = state[token]

    if (!tokenState) {
      ctx.body = find(jsonStatus, 'progress')
      return
    }

    if (tokenState.done === tokenState.total) {
      ctx.body = find(jsonStatus, 'info')
      return
    }

    const response = find(jsonStatus, 'progress') as ProgressResponse

    if (tokenState.isComputable) {
      response.total = tokenState.total
      response.done = tokenState.done

      const nextDone = Math.min(
        tokenState.done + (tokenState.total as number) / 3,
        tokenState.total as number
      )
      state[token] = {
        ...tokenState,
        done: nextDone
      }
    } else {
      response.total = 'unknown'
      response.done = tokenState.done

      const nextDone = Math.min(
        tokenState.done + (tokenState.total as number) / 3,
        tokenState.total as number
      )
      state[token] = {
        ...tokenState,
        done: nextDone
      }
    }

    ctx.body = response
  } else {
    error(ctx, {
      statusText: 'token is required.'
    })
  }
}

export { index, status }
