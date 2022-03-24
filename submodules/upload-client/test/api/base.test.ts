import AbortController from 'abort-controller'
import base from '../../src/api/base'
import * as factory from '../_fixtureFactory'
import { UploadClientError } from '../../src/tools/errors'
import { assertComputableProgress } from '../_helpers'

describe('API - base', () => {
  const fileToUpload = factory.image('blackSquare')

  it('should be able to upload data', async () => {
    const publicKey = factory.publicKey('demo')
    const { file } = await base(fileToUpload.data, { publicKey })

    expect(typeof file).toBe('string')
  })

  it('should be able to cancel uploading', async () => {
    const timeout = jest.fn()
    const publicKey = factory.publicKey('demo')
    const controller = new AbortController()
    const directUpload = base(fileToUpload.data, {
      publicKey,
      signal: controller.signal
    })

    controller.abort()

    const timeoutId = setTimeout(timeout, 10)

    await expect(directUpload).rejects.toThrowError('Request canceled')

    expect(timeout).not.toHaveBeenCalled()
    clearTimeout(timeoutId)
  })

  it('should be able to handle progress', async () => {
    const publicKey = factory.publicKey('demo')
    const onProgress = jest.fn()

    await base(fileToUpload.data, { publicKey, onProgress })

    assertComputableProgress(onProgress)
  })

  it('should be rejected with error code if failed', async () => {
    const publicKey = factory.publicKey('invalid')

    try {
      await base(fileToUpload.data, { publicKey })
    } catch (error) {
      expect((error as UploadClientError).message).toEqual(
        'UPLOADCARE_PUB_KEY is invalid.'
      )
      expect((error as UploadClientError).code).toEqual(
        'ProjectPublicKeyInvalidError'
      )
    }
  })
})
