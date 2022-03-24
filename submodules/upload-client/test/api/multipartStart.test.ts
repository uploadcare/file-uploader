import multipartStart from '../../src/api/multipartStart'
import * as factory from '../_fixtureFactory'
import { getSettingsForTesting } from '../_helpers'
import { UploadClientError } from '../../src/tools/errors'
import AbortController from 'abort-controller'

describe('API - multipartStart', () => {
  const size = factory.file(12).size

  it('should be able to start upload data', async () => {
    const settings = getSettingsForTesting({
      publicKey: factory.publicKey('multipart'),
      contentType: 'application/octet-stream'
    })
    const { uuid, parts } = await multipartStart(size, settings)

    expect(uuid).toBeTruthy()
    expect(parts).toBeTruthy()
  })

  it('should be able to cancel uploading', async () => {
    const cntr = new AbortController()
    const settings = getSettingsForTesting({
      publicKey: factory.publicKey('multipart'),
      contentType: 'application/octet-stream',
      signal: cntr.signal
    })
    const upload = multipartStart(size, settings)

    setTimeout(() => {
      cntr.abort()
    })

    await expect(upload).rejects.toThrowError(
      new UploadClientError('Request canceled')
    )
  })

  it('should be rejected with bad options', async () => {
    const size = factory.file(9).size
    const settings = getSettingsForTesting({
      publicKey: factory.publicKey('multipart'),
      contentType: 'application/octet-stream'
    })

    const upload = multipartStart(size, settings)

    await expect(upload).rejects.toThrowError(
      new UploadClientError(
        'File size can not be less than 10485760 bytes. Please use direct upload instead of multipart.'
      )
    )
  })

  it('should be rejected with error code if failed', async () => {
    const size = factory.file(9).size
    const settings = getSettingsForTesting({
      publicKey: factory.publicKey('invalid'),
      contentType: 'application/octet-stream'
    })

    try {
      await multipartStart(size, settings)
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
