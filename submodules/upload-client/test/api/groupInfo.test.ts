import AbortController from 'abort-controller'
import * as factory from '../_fixtureFactory'
import { getSettingsForTesting } from '../_helpers'
import group from '../../src/api/group'
import groupInfo from '../../src/api/groupInfo'
import { UploadClientError } from '../../src/tools/errors'

describe('API - group info', () => {
  const files = factory.groupOfFiles('valid')
  const settings = getSettingsForTesting({
    publicKey: factory.publicKey('image')
  })

  it('should return info about uploaded group of files', async () => {
    const { id } = await group(files, settings)
    const data = await groupInfo(id, settings)

    expect(data).toBeTruthy()
    expect(data.id).toBeTruthy()
    expect(data.files).toBeTruthy()
  })
  it('should fail with [HTTP 404] group_id is invalid.', async () => {
    const groupId = factory.groupId('invalid')
    const upload = groupInfo(groupId, settings)

    await expect(upload).rejects.toThrowError(`group_id is invalid.`)
  })

  it('should be able to cancel uploading', async () => {
    const controller = new AbortController()

    const settingsWithCancel = getSettingsForTesting({
      publicKey: factory.publicKey('image'),
      signal: controller.signal
    })

    const { id } = await group(files, settings)

    setTimeout(() => {
      controller.abort()
    })

    await expect(groupInfo(id, settingsWithCancel)).rejects.toThrowError(
      'Request canceled'
    )
  })

  it('should be rejected with error code if failed', async () => {
    const publicKey = factory.publicKey('invalid')

    try {
      await groupInfo('id', { publicKey })
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
