import AbortController from 'abort-controller'
import * as factory from '../_fixtureFactory'
import { uploadFile } from '../../src/uploadFile'
import {
  getSettingsForTesting,
  assertComputableProgress,
  assertUnknownProgress
} from '../_helpers'
import { UploadClientError } from '../../src/tools/errors'
import http from 'http'
import https from 'https'

jest.setTimeout(60000)

describe('uploadFrom URL', () => {
  it('should resolves when file is ready on CDN', async () => {
    const sourceUrl = factory.imageUrl('valid')
    const settings = getSettingsForTesting({
      publicKey: factory.publicKey('image')
    })

    const file = await uploadFile(sourceUrl, settings)

    expect(file.cdnUrl).toBeTruthy()
    expect(file.uuid).toBeTruthy()
  })

  it('should accept store setting', async () => {
    const sourceUrl = factory.imageUrl('valid')
    const settings = getSettingsForTesting({
      publicKey: factory.publicKey('image'),
      store: false
    })

    const file = await uploadFile(sourceUrl, settings)

    expect(file.isStored).toBeFalsy()
  })

  it('should accept checkForUrlDuplicates setting', async () => {
    const sourceUrl = factory.imageUrl('valid')
    const settings = getSettingsForTesting({
      publicKey: factory.publicKey('image'),
      checkForUrlDuplicates: true
    })

    const isHttpsProtocol = settings.baseURL.includes('https')
    const spy = jest.spyOn(isHttpsProtocol ? https : http, 'request')
    await uploadFile(sourceUrl, settings)

    const uploadRequest = spy.mock.calls[0][0]
    expect(uploadRequest['query']).toEqual(
      expect.stringContaining('check_URL_duplicates=1')
    )
    spy.mockRestore()
  })

  it('should accept saveUrlForRecurrentUploads setting', async () => {
    const sourceUrl = factory.imageUrl('valid')
    const settings = getSettingsForTesting({
      publicKey: factory.publicKey('image'),
      saveUrlForRecurrentUploads: true
    })

    const isHttpsProtocol = settings.baseURL.includes('https')
    const spy = jest.spyOn(isHttpsProtocol ? https : http, 'request')
    await uploadFile(sourceUrl, settings)

    const uploadRequest = spy.mock.calls[0][0]
    expect(uploadRequest['query']).toEqual(
      expect.stringContaining('save_URL_duplicates=1')
    )
    spy.mockRestore()
  })

  it('should be able to cancel uploading', async () => {
    const ctrl = new AbortController()
    const sourceUrl = factory.imageUrl('valid')
    const settings = getSettingsForTesting({
      publicKey: factory.publicKey('image'),
      signal: ctrl.signal
    })

    setTimeout(() => {
      ctrl.abort()
    })

    await expect(uploadFile(sourceUrl, settings)).rejects.toThrowError(
      new UploadClientError('Request canceled')
    )
  })

  it('should accept new file name setting', async () => {
    const sourceUrl = factory.imageUrl('valid')
    const settings = getSettingsForTesting({
      publicKey: factory.publicKey('image'),
      store: false,
      fileName: 'newFileName.jpg'
    })
    const file = await uploadFile(sourceUrl, settings)

    expect(file.name).toEqual('newFileName.jpg')
  })

  it('should be able to handle computable progress', async () => {
    const onProgress = jest.fn()
    const sourceUrl = factory.imageUrl('valid')
    const settings = getSettingsForTesting({
      publicKey: factory.publicKey('image'),
      onProgress
    })

    await uploadFile(sourceUrl, settings)

    assertComputableProgress(onProgress)
  })

  process.env.TEST_ENV !== 'production' &&
    it('should be able to handle non-computable unknown progress', async () => {
      const onProgress = jest.fn()
      const sourceUrl = factory.imageUrl('valid')
      const settings = getSettingsForTesting({
        publicKey: factory.publicKey('unknownProgress'),
        onProgress
      })

      await uploadFile(sourceUrl, settings)

      assertUnknownProgress(onProgress)
    })

  it('should be rejected with error code if failed', async () => {
    const sourceUrl = factory.imageUrl('valid')
    const settings = getSettingsForTesting({
      publicKey: factory.publicKey('invalid')
    })

    try {
      await uploadFile(sourceUrl, settings)
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
