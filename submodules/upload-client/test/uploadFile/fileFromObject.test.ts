import AbortController from 'abort-controller'
import * as factory from '../_fixtureFactory'
import { getSettingsForTesting, assertComputableProgress } from '../_helpers'
import { UploadClientError } from '../../src/tools/errors'
import { uploadFile } from '../../src/uploadFile'

describe('uploadFrom Object', () => {
  it('should resolves when file is ready on CDN', async () => {
    const fileToUpload = factory.image('blackSquare').data
    const settings = getSettingsForTesting({
      publicKey: factory.publicKey('image')
    })

    const file = await uploadFile(fileToUpload, settings)

    expect(file.cdnUrl).toBeTruthy()
  })

  it('should accept store setting', async () => {
    const fileToUpload = factory.image('blackSquare').data
    const settings = getSettingsForTesting({
      publicKey: factory.publicKey('image'),
      store: false
    })
    const file = await uploadFile(fileToUpload, settings)

    expect(file.isStored).toBeFalsy()
  })

  it('should be able to cancel uploading', async () => {
    const ctrl = new AbortController()
    const fileToUpload = factory.image('blackSquare').data
    const settings = getSettingsForTesting({
      publicKey: factory.publicKey('image'),
      signal: ctrl.signal
    })
    const upload = uploadFile(fileToUpload, settings)

    setTimeout(() => {
      ctrl.abort()
    })

    await expect(upload).rejects.toThrowError('Request canceled')
  })

  it('should accept new file name setting', async () => {
    const fileToUpload = factory.image('blackSquare').data
    const settings = getSettingsForTesting({
      publicKey: factory.publicKey('image'),
      store: false,
      fileName: 'newFileName.jpg'
    })
    const file = await uploadFile(fileToUpload, settings)

    expect(file.name).toEqual('newFileName.jpg')
  })

  it('should be able to handle progress', async () => {
    const onProgress = jest.fn()
    const fileToUpload = factory.image('blackSquare').data
    const settings = getSettingsForTesting({
      publicKey: factory.publicKey('image'),
      onProgress
    })

    await uploadFile(fileToUpload, settings)

    assertComputableProgress(onProgress)
  })

  it('should be rejected with error code if failed', async () => {
    const fileToUpload = factory.image('blackSquare').data
    const settings = getSettingsForTesting({
      publicKey: factory.publicKey('invalid')
    })

    try {
      await uploadFile(fileToUpload, settings)
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
