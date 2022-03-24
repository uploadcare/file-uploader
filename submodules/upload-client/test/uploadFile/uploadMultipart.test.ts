import AbortController from 'abort-controller'
import * as factory from '../_fixtureFactory'
import { getSettingsForTesting, assertComputableProgress } from '../_helpers'
import uploadMultipart from '../../src/uploadFile/uploadMultipart'
import { UploadClientError } from '../../src/tools/errors'

jest.setTimeout(60000)

describe('API - multipart', () => {
  it('should be able to upload multipart file', async () => {
    const fileToUpload = factory.file(11).data
    const settings = getSettingsForTesting({
      publicKey: factory.publicKey('multipart'),
      contentType: 'application/octet-stream'
    })

    const { uuid } = await uploadMultipart(fileToUpload, settings)

    expect(uuid).toBeTruthy()
  })

  it('should be able to cancel uploading', async () => {
    const ctrl = new AbortController()
    const fileToUpload = factory.file(11).data
    const settings = getSettingsForTesting({
      publicKey: factory.publicKey('multipart'),
      contentType: 'application/octet-stream',
      signal: ctrl.signal
    })

    setTimeout(() => {
      ctrl.abort()
    })

    await expect(uploadMultipart(fileToUpload, settings)).rejects.toThrowError(
      new UploadClientError('Request canceled')
    )
  })

  it('should be able to handle progress', async () => {
    const onProgress = jest.fn()
    const fileToUpload = factory.file(11).data
    const settings = getSettingsForTesting({
      publicKey: factory.publicKey('multipart'),
      contentType: 'application/octet-stream',
      onProgress
    })

    await uploadMultipart(fileToUpload, settings)

    assertComputableProgress(onProgress)
  })

  it('should be rejected with error code if failed', async () => {
    const fileToUpload = factory.file(11).data
    const settings = getSettingsForTesting({
      publicKey: factory.publicKey('invalid'),
      contentType: 'application/octet-stream'
    })

    try {
      await uploadMultipart(fileToUpload, settings)
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
