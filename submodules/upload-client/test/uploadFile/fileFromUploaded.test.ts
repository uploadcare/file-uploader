import AbortController from 'abort-controller'
import * as factory from '../_fixtureFactory'
import { uploadFile } from '../../src/uploadFile'
import { getSettingsForTesting, assertComputableProgress } from '../_helpers'
import { UploadClientError } from '../../src/tools/errors'

describe('uploadFrom Uploaded', () => {
  const uuid = factory.uuid('image')
  const settings = getSettingsForTesting({
    publicKey: factory.publicKey('image')
  })

  it('should resolves when file is ready on CDN', async () => {
    const file = await uploadFile(uuid, settings)

    expect(file.cdnUrl).toBeTruthy()
  })

  it('should be able to cancel uploading', async () => {
    const ctrl = new AbortController()
    const upload = uploadFile(uuid, {
      ...settings,
      signal: ctrl.signal
    })

    ctrl.abort()

    await expect(upload).rejects.toThrowError(
      new UploadClientError('Request canceled')
    )
  })

  it('should accept new file name setting', async () => {
    const settings = getSettingsForTesting({
      publicKey: factory.publicKey('image'),
      store: true,
      fileName: 'newFileName.jpg'
    })
    const file = await uploadFile(uuid, settings)

    expect(file.name).toEqual('newFileName.jpg')
  })

  it('should be able to handle progress', async () => {
    const onProgress = jest.fn()
    const settings = getSettingsForTesting({
      publicKey: factory.publicKey('image'),
      onProgress
    })

    await uploadFile(uuid, settings)

    assertComputableProgress(onProgress)
  })

  it('should be rejected with error code if failed', async () => {
    const settings = getSettingsForTesting({
      publicKey: factory.publicKey('invalid')
    })

    try {
      await uploadFile(uuid, settings)
    } catch (error) {
      expect((error as UploadClientError).message).toEqual(
        'pub_key is invalid.'
      )
      expect((error as UploadClientError).code).toEqual(
        'ProjectPublicKeyInvalidError'
      )
    }
  })
})
