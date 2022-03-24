/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-ignore
import Koa from 'koa'
import Router from '@koa/router'
import chalk from 'chalk'

// Middleware
import cors from '@koa/cors'
import addTrailingSlashes from 'koa-add-trailing-slashes'
// @ts-ignore
import koaBody from 'koa-body'

import logger from './middleware/logger.js'
import delayer from './middleware/delayer.js'
import auth from './middleware/auth.js'

// Config
import { PORT } from './config.js'

// Routes
import { ROUTES, RouteType } from './routes.js'

const app = new Koa()
const router = new Router()

const silent = process.argv.includes('--silent')
const noop = (_, next) => next()

// Use middleware
app.use(cors())
app.use(addTrailingSlashes())
app.use(silent ? noop : logger)
app.use(delayer)
app.use(
  koaBody({
    multipart: true,
    formLimit: 50 * 1024 * 1024,
    textLimit: 50 * 1024 * 1024
  })
)
app.use(auth)

// Routes
ROUTES.forEach((route: RouteType) => {
  const keys = Object.keys(route)
  const path = keys[0]
  const method = route[path].method
  const fn = route[path].fn
  router[method](path, fn)

  app.use(router.routes())
})

// Handle errors
app.on('error', (err, ctx) => {
  if (!silent) {
    console.error(`💔 ${chalk.red('Server error')}:`)
    console.error(err)
    console.error(ctx)
  }
})

// Listen server
app.listen(PORT, () => {
  if (!silent) {
    console.log(
      `🚀 ${chalk.bold('Server started at')} ${chalk.green(
        chalk.bold(`http://localhost:${PORT}`)
      )}`,
      '\n'
    )
    console.log('Available routes:', '\n')

    // Print all available routes
    ROUTES.forEach((route: RouteType) => {
      const keys = Object.keys(route)
      const path = keys[0]
      const routePath = route[path]
      const method = routePath.method.toUpperCase()
      const description = routePath.description || path
      const isFake = routePath.isFake || false

      console.log(
        `  ${chalk.bold(method)}: '${
          isFake ? chalk.gray(description) : chalk.green(description)
        }'`
      )
    })
    console.log()
  }
})
