import AbortController from 'abort-controller'
import fromUrlStatus, { Status } from '../../src/api/fromUrlStatus'
import * as factory from '../_fixtureFactory'
import { getSettingsForTesting } from '../_helpers'
import { UploadClientError } from '../../src/tools/errors'

describe('API - from url status', () => {
  const token = factory.token('valid')
  const settings = getSettingsForTesting({})

  it('should return info about file uploaded from url', async () => {
    const data = await fromUrlStatus(token, settings)

    expect(data.status).toBeTruthy()

    if (data.status === Status.Progress || data.status === Status.Success) {
      expect(data.done).toBeTruthy()
      expect(data.total).toBeTruthy()
    } else if (data.status === Status.Error) {
      expect(data.error).toBeTruthy()
    }
  })

  it('should be rejected with empty token', async () => {
    const token = factory.token('empty')
    const upload = fromUrlStatus(token, settings)

    await expect(upload).rejects.toThrowError('token is required.')
  })

  it('should be able to cancel uploading', async () => {
    const controller = new AbortController()

    const settings = getSettingsForTesting({
      publicKey: factory.publicKey('demo'),
      signal: controller.signal
    })

    setTimeout(() => {
      controller.abort()
    })

    await expect(fromUrlStatus(token, settings)).rejects.toThrowError(
      'Request canceled'
    )
  })

  it('should be rejected with error code if failed', async () => {
    const publicKey = factory.publicKey('invalid')

    try {
      await fromUrlStatus('token', { publicKey })
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
