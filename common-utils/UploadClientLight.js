export const UC_CLIENT_EVENT_NAME = 'uc-client-event'

export const EVENT_TYPES = {
  SUCCESS: 'success',
  ERROR: 'error',
  PROGRESS: 'progress',
}

export class UploadInfo {
  /**
   * @param {Object} init
   * @param {String} init.type
   * @param {Number} init.progress
   * @param {String} [init.uploadToken]
   * @param {String} [init.uuid]
   * @param {any} [init.error]
   */
  constructor(init) {
    this.date = Date.now()
    this.type = init.type
    /** @type {String} */
    this.uploadToken = init.uploadToken || null
    this.progress = init.progress
    this.uuid = init.uuid || null
    this.cdnUrl = init.uuid ? `https://ucarecdn.com/${init.uuid}/` : null
    this.error = init.error || null
  }
}

/**
 * @param {String} url
 * @param {String} pubkey
 * @param {(info: UploadInfo) => *} [uploadCallback]
 * @returns {Promise}
 */
export async function uploadFromUrl(url, pubkey, uploadCallback) {
  /** @param {String} token */
  function checkUpload(token) {
    return new Promise(async (resolve, reject) => {
      let getStatus = async () => {
        let resp = await (
          await window.fetch(
            `https://upload.uploadcare.com/from_url/status/?token=${token}`,
          )
        ).json()
        if (resp.status === 'progress') {
          uploadCallback?.(
            new UploadInfo({
              type: EVENT_TYPES.PROGRESS,
              uploadToken: token,
              progress: resp.progress,
            }),
          )
          getStatus()
        }
        else if (resp.status === 'waiting') {
          // TODO: needs to be throttled
          getStatus()
        }
        else if (resp.status === 'error') {
          uploadCallback?.(
            new UploadInfo({
              type: EVENT_TYPES.ERROR,
              error: resp,
              progress: 0,
            }),
          )
          reject(null)
        } else {
          let result = new UploadInfo({
            type: EVENT_TYPES.SUCCESS,
            progress: 100,
            uuid: resp.uuid,
          })
          uploadCallback?.(result)
          resolve(result)
        }
      }
      getStatus()
    })
  }

  let fileId = null
  let response = await (
    await window.fetch(
      `https://upload.uploadcare.com/from_url/?pub_key=${pubkey}&store=1&source_url=${encodeURIComponent(
        url,
      )}`,
    )
  ).json()
  if (response.token) {
    let uuid = await checkUpload(response.token)
    if (uuid) {
      fileId = uuid
    }
  }
  return fileId
}

/**
 * @param {File} file
 * @param {String} pubkey
 * @param {(info: UploadInfo) => *} [uploadCallback]
 * @returns {Promise<UploadInfo>}
 */
export async function uploadFileDirect(file, pubkey, uploadCallback) {
  let data = new FormData()
  data.append('UPLOADCARE_PUB_KEY', pubkey)
  data.append('UPLOADCARE_STORE', '1')
  data.append('file', file, file.name)
  return new Promise((resolve, reject) => {
    let xhr = new XMLHttpRequest()
    xhr.upload.onprogress = (e) => {
      uploadCallback?.(
        new UploadInfo({
          type: EVENT_TYPES.PROGRESS,
          progress: Math.round((e.loaded / e.total) * 100),
        }),
      )
    }
    xhr.onerror = (e) => {
      uploadCallback?.(
        new UploadInfo({
          type: EVENT_TYPES.ERROR,
          progress: 0,
          error: e,
        }),
      )
      reject(null)
    }
    xhr.onload = (e) => {
      let respJson
      try {
        respJson = JSON.parse(xhr.responseText)
      } catch (err) {
        uploadCallback?.(
          new UploadInfo({
            type: EVENT_TYPES.ERROR,
            progress: 0,
            error: xhr.responseText,
          }),
        )
        reject(null)
        return
      }
      let result = new UploadInfo({
        type: EVENT_TYPES.SUCCESS,
        progress: 100,
        uuid: respJson.file,
      })
      uploadCallback?.(result)
      resolve(result)
    }
    xhr.open('POST', 'https://upload.uploadcare.com/base/')
    xhr.send(data)
  })
}

/**
 * @param {String} uuid
 * @param {String} pubkey
 */
export async function getInfo(uuid, pubkey) {
  return await (
    await window.fetch(
      `https://upload.uploadcare.com/info/?pub_key=${pubkey}&file_id=${uuid}`,
    )
  ).json()
}
