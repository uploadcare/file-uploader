import * as base from './controllers/base.js'
import * as fromUrl from './controllers/from_url.js'
import * as info from './controllers/info.js'
import * as group from './controllers/group.js'
import * as throttle from './controllers/throttle.js'
import * as multipart from './controllers/multipart.js'

export type RouteType = {
  [path: string]: {
    method: string
    fn: (ctx: Record<string, unknown>, next?: () => Promise<unknown>) => void
    isProtected: boolean
    isFake?: boolean
    description?: string
  }
}

// this route need for health check
const index = (ctx) => {
  ctx.body = 'server is up'
}

export const ROUTES: RouteType[] = [
  {
    '/': {
      method: 'get',
      fn: index,
      isProtected: false
    }
  },
  {
    '/base': {
      method: 'post',
      fn: base.index,
      isProtected: true
    }
  },
  {
    '/from_url': {
      method: 'post',
      fn: fromUrl.index,
      isProtected: true,
      description: '/from_url/?pub_key=XXXXXXXXXXXXXXXXXXXX'
    }
  },
  {
    '/from_url/status': {
      method: 'get',
      fn: fromUrl.status,
      isProtected: false,
      description:
        '/from_url/status/?pub_key=XXXXXXXXXXXXXXXXXXXX&token=XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX'
    }
  },
  {
    '/info': {
      method: 'get',
      fn: info.index,
      isProtected: true,
      description:
        '/info/?pub_key=XXXXXXXXXXXXXXXXXXXX&file_id=XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX'
    }
  },
  {
    '/group': {
      method: 'post',
      fn: group.index,
      isProtected: true,
      description: '/group/'
    }
  },
  {
    '/group/info': {
      method: 'get',
      fn: group.info,
      isProtected: true,
      description:
        '/group/info/?pub_key=XXXXXXXXXXXXXXXXXXXX&group_id=XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX~N'
    }
  },
  {
    '/multipart/start': {
      method: 'post',
      fn: multipart.start,
      isProtected: true
    }
  },
  {
    '/multipart/upload/:uuid/original/': {
      method: 'put',
      fn: multipart.upload,
      isProtected: false,
      isFake: true
    }
  },
  {
    '/multipart/upload/:uuid/original/': {
      method: 'get',
      fn: multipart.upload,
      isProtected: false,
      isFake: true
    }
  },
  {
    '/multipart/complete': {
      method: 'post',
      fn: multipart.complete,
      isProtected: true
    }
  },
  {
    '/throttle': {
      method: 'post',
      fn: throttle.index,
      isFake: true,
      isProtected: true
    }
  }
]
