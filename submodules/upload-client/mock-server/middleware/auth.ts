import { ROUTES, RouteType } from '../routes.js'
import { ALLOWED_PUBLIC_KEYS } from '../config.js'
import error from '../utils/error.js'

/**
 * Routes protected by auth.
 */
const protectedRoutes: Array<string> = ROUTES.filter((route: RouteType) => {
  const keys = Object.keys(route)
  const path = keys[0]

  return route[path].isProtected
}).map((route: RouteType) => {
  const keys = Object.keys(route)

  return keys[0]
})

/**
 * Check is url protected by auth.
 * @param {string} url
 * @return {boolean}
 */
const isProtected = (url: string) =>
  !!protectedRoutes.filter((path: string) => url === path).length

/**
 * Get public key value from request.
 * @param {Record<string, string>} source
 * @param {string} key
 */
const getPublicKeyFromSource = (
  source: Record<string, string>,
  key: string
): string => {
  return typeof source[key] !== 'undefined' ? source[key] : ''
}

type IsAuthorizedParams = {
  url: string
  publicKey: string
}
/**
 * Check auth.
 * @param {string} url
 * @param {string} publicKey
 * @return {boolean}
 */
const isAuthorized = ({ url, publicKey }: IsAuthorizedParams) => {
  if (!isProtected(url)) {
    return true
  }

  return !!(publicKey && ALLOWED_PUBLIC_KEYS.includes(publicKey))
}

/**
 * Uploadcare Auth middleware.
 * @param {object} ctx
 * @param {function} next
 */
const auth = (ctx, next) => {
  const urlWithSlash = ctx.url.split('?').shift()
  const url = urlWithSlash.substring(0, urlWithSlash.length - 1)

  let key = 'pub_key'
  const params: IsAuthorizedParams = {
    url,
    publicKey: getPublicKeyFromSource(ctx.query, key)
  }

  // UPLOADCARE_PUB_KEY in body
  if (
    url.includes('base') ||
    url.includes('multipart/start') ||
    url.includes('multipart/complete')
  ) {
    key = 'UPLOADCARE_PUB_KEY'
    params.publicKey = getPublicKeyFromSource(ctx.request.body, key)
  }

  if (isAuthorized(params)) {
    next()
  } else {
    error(ctx, {
      status: 403,
      statusText: params.publicKey
        ? `${key} is invalid.`
        : `${key} is required.`,
      errorCode: 'ProjectPublicKeyInvalidError'
    })
  }
}

export default auth
