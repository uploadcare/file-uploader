export const UC_CLIENT_EVENT_NAME = 'uc-client-event';

export const EVENT_TYPES = {
  SUCCESS: 'success',
  ERROR: 'error',
  PROGRESS: 'progress',
};

export class UploadInfo {
  /**
   * @param {Object} init
   * @param {String} init.type
   * @param {String} init.uploadId
   * @param {Number} init.progress
   * @param {String} [init.uploadToken]
   * @param {String} [init.uuid]
   * @param {any} [init.error]
   */
  constructor(init) {
    this.date = Date.now();
    this.type = init.type;
    /** @type {String} */
    this.uploadId = init.uploadId;
    this.uploadToken = init.uploadToken || null;
    this.progress = init.progress;
    this.uuid = init.uuid || null;
    this.cdnUrl = init.uuid ? `https://ucarecdn.com/${init.uuid}/` : null;
    this.error = init.error || null;
  }
}

/** @param {UploadInfo} detail */
function fireEvent(detail) {
  window.dispatchEvent(
    new CustomEvent(UC_CLIENT_EVENT_NAME, {
      detail,
    })
  );
}

export class UploadClientLight {
  /**
   * @param {String} url
   * @param {String} pubkey
   * @param {String} uploadId
   * @returns {Promise<UploadInfo>}
   */
  static async uploadFromUrl(url, pubkey, uploadId) {
    /** @param {String} token */
    function checkUpload(token) {
      return new Promise(async (resolve, reject) => {
        let getStatus = async () => {
          let resp = await (await window.fetch(`https://upload.uploadcare.com/from_url/status/?token=${token}`)).json();
          if (resp.status === 'progress') {
            fireEvent(
              new UploadInfo({
                type: EVENT_TYPES.PROGRESS,
                uploadId,
                uploadToken: token,
                progress: resp.progress,
              })
            );
            getStatus();
          } else if (resp.status === 'error') {
            fireEvent(
              new UploadInfo({
                type: EVENT_TYPES.ERROR,
                uploadId,
                error: resp,
                progress: 0,
              })
            );
            reject(null);
          } else {
            console.log(resp);
            let result = new UploadInfo({
              type: EVENT_TYPES.SUCCESS,
              uploadId,
              progress: 100,
              uuid: resp.uuid,
            });
            fireEvent(result);
            resolve(result);
          }
        };
        getStatus();
      });
    }

    let fileId = null;
    let response = await (await window.fetch(`https://upload.uploadcare.com/from_url/?pub_key=${pubkey}&store=1&source_url=${url}`)).json();
    if (response.token) {
      let uuid = await checkUpload(response.token);
      if (uuid) {
        fileId = uuid;
      }
    }
    return fileId;
  }

  /**
   * @param {File} file
   * @param {String} pubkey
   * @param {String} uploadId
   * @returns {Promise<UploadInfo>}
   */
  static async uploadFileDirect(file, pubkey, uploadId) {
    let fileId = null;
    let data = new FormData();
    data.append('UPLOADCARE_PUB_KEY', pubkey);
    data.append('UPLOADCARE_STORE', '1');
    data.append('file', file);
    return new Promise((resolve, reject) => {
      let xhr = new XMLHttpRequest();
      xhr.upload.onprogress = (e) => {
        fireEvent(
          new UploadInfo({
            type: EVENT_TYPES.PROGRESS,
            uploadId,
            progress: Math.round((e.loaded / e.total) * 100),
          })
        );
      };
      xhr.onerror = (e) => {
        fireEvent(
          new UploadInfo({
            type: EVENT_TYPES.ERROR,
            uploadId,
            progress: 0,
            error: e,
          })
        );
        reject(fileId);
      };
      xhr.onload = (e) => {
        let respJson = JSON.parse(xhr.responseText);
        let result = new UploadInfo({
          type: EVENT_TYPES.SUCCESS,
          uploadId,
          progress: 100,
          uuid: respJson.file,
        });
        fireEvent(result);
        resolve(result);
      };
      xhr.open('POST', 'https://upload.uploadcare.com/base/');
      xhr.send(data);
    });
  }

  /**
   * @param {String} uuid
   * @param {String} pubkey
   */
  static async getInfo(uuid, pubkey) {
    return await (await window.fetch(`https://upload.uploadcare.com/info/?pub_key=${pubkey}&file_id=${uuid}`)).json();
  }
}
