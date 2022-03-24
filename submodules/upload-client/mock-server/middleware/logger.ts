import chalk from 'chalk'

/**
 * Pretty print for JSON.
 * @param {Record<string, unknown>} json
 * @return {string}
 */
const pretty = (json: Record<string, unknown>): string =>
  JSON.stringify(json, null, 2)

/**
 * Check is empty object.
 * @param {Record<string, unknown>} object
 * @return {boolean}
 */
const isEmptyObject = (object: Record<string, unknown>): boolean =>
  Object.keys(object).length === 0 && object.constructor === Object

/**
 * Logger for requests and responses.
 * @param {object} ctx
 * @param {function} next
 */
const logger = async (ctx, next) => {
  await next()

  const request = `${chalk.gray('-->')} ${chalk.bold(
    ctx.request.method
  )} ${chalk.gray(ctx.request.url)}`
  const requestHeaders = ctx.request.headers
  const requestBody = ctx.request.body
  const requestQuery = ctx.request.query

  const status = ctx.response.status
  const message = ctx.response.message
  const isPositive = status >= 200 && status < 300
  const statusMessage = `${status.toString()} ${message}`
  const coloredStatusMessage = isPositive
    ? `${chalk.green(statusMessage)}`
    : `${chalk.red(statusMessage)}`

  const response = `${chalk.gray('<--')} ${chalk.bold(coloredStatusMessage)}`
  const responseBody = ctx.response.body

  console.log(request)

  if (!isEmptyObject(requestHeaders)) {
    console.log('Request Headers:')
    console.log(pretty(requestHeaders))
  }

  if (!isEmptyObject(requestBody)) {
    if (ctx.request.url.match(/\/multipart\/upload/)) {
      console.log(
        `Request Body: ${chalk.gray(
          'hidden (because a lot of binary data will be printed)'
        )}`
      )
    } else {
      console.log('Request Body:')
      console.log(pretty(requestBody))
    }
  }

  if (!isEmptyObject(requestQuery)) {
    console.log('Request Query:')
    console.log(pretty(requestQuery))
  }

  console.log()
  console.log(response)

  if (responseBody) {
    console.log('Response Body:')
    console.log(pretty(responseBody))
  }

  console.log()
}

export default logger
