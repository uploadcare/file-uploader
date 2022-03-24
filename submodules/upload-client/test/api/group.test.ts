import AbortController from 'abort-controller'
import * as factory from '../_fixtureFactory'
import { getSettingsForTesting } from '../_helpers'
import group from '../../src/api/group'
import { UploadClientError } from '../../src/tools/errors'

describe('API - group', () => {
  const files = factory.groupOfFiles('valid')
  const settings = getSettingsForTesting({
    publicKey: factory.publicKey('image')
  })

  it('should upload group of files', async () => {
    const data = await group(files, settings)

    expect(data).toBeTruthy()
    expect(data.id).toBeTruthy()
    expect(data.files).toBeTruthy()
  })

  it('should fail with [HTTP 400] No files[N] parameters found.', async () => {
    await expect(group([], settings)).rejects.toThrowError(
      'No files[N] parameters found.'
    )
  })

  it('should fail with [HTTP 400] This is not valid file url: http://invalid/url.', async () => {
    const files = factory.groupOfFiles('invalid')

    await expect(group(files, settings)).rejects.toThrowError(
      `This is not valid file url: ${files[0]}.`
    )
  })

  it('should fail with [HTTP 400] Some files not found.', async () => {
    const settings = getSettingsForTesting({
      publicKey: factory.publicKey('demo')
    })

    await expect(group(files, settings)).rejects.toThrowError(
      'Some files not found.'
    )
  })

  it('should be able to cancel uploading', async () => {
    const controller = new AbortController()

    const settings = getSettingsForTesting({
      publicKey: factory.publicKey('image'),
      signal: controller.signal
    })

    setTimeout(() => {
      controller.abort()
    })

    await expect(group(files, settings)).rejects.toThrowError(
      'Request canceled'
    )
  })

  it('should be rejected with error code if failed', async () => {
    const publicKey = factory.publicKey('invalid')

    try {
      await group([], { publicKey })
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
