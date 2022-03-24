/**
 * @jest-environment jsdom
 */

import 'abort-controller/polyfill'
import { UploadClientError } from '../../src/tools/errors'
import request from '../../src/request/request.browser'
import getUrl from '../../src/tools/getUrl'

describe('request', () => {
  it('should post', async () => {
    const response = await request({
      method: 'POST',
      url: getUrl('https://upload.uploadcare.com', '/base/', {
        jsonerrors: 1
      }),
      data: new Blob(Array(1000).fill(1))
    })

    expect(response.request.method).toBe('POST')
    expect(response.status).toBe(200)
    expect(response.request.url).toBe(
      'https://upload.uploadcare.com/base/?jsonerrors=1'
    )
    expect(JSON.parse(response.data).error.content).toBe(
      'UPLOADCARE_PUB_KEY is required.'
    )
  })

  it('should get', async () => {
    const response = await request({
      url: getUrl('https://upload.uploadcare.com', '/from_url/status/', {
        token: 'test'
      })
    })

    expect(response.request.url).toBe(
      'https://upload.uploadcare.com/from_url/status/?token=test'
    )
    expect(response.request.method).toBe('GET')
    expect(JSON.parse(response.data).status).toBe('unknown')
  })

  it('should be cancellable', async () => {
    const cntr = new AbortController()

    setTimeout(() => {
      cntr.abort()
    })

    await expect(
      request({
        url: getUrl('https://upload.uploadcare.com', '/from_url/status/', {
          token: 'test'
        }),
        signal: cntr.signal
      })
    ).rejects.toThrowError(new UploadClientError('Request canceled'))
  })

  it('should handle progress', async () => {
    const onProgress = jest.fn()
    const response = await request({
      method: 'POST',
      url: getUrl('https://upload.uploadcare.com', '/base/', {
        jsonerrors: 1
      }),
      data: new Blob(Array(1000).fill(1)),
      onProgress
    })

    expect(response.request.method).toBe('POST')
    expect(response.status).toBe(200)

    // do not use assertProgressMock because progress won't work in the jsdom env
    expect(onProgress).toHaveBeenCalled()
  })
})
