import { cancelError } from '../tools/errors'
import { onCancel } from '../tools/onCancel'
import { RequestOptions, RequestResponse } from './types'

const request = ({
  method,
  url,
  data,
  headers = {},
  signal,
  onProgress
}: RequestOptions): Promise<RequestResponse> =>
  new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    const requestMethod = method?.toUpperCase() || 'GET'
    let aborted = false

    xhr.open(requestMethod, url)

    if (headers) {
      Object.entries(headers).forEach((entry) => {
        const [key, value] = entry
        typeof value !== 'undefined' &&
          !Array.isArray(value) &&
          xhr.setRequestHeader(key, value)
      })
    }

    xhr.responseType = 'text'

    onCancel(signal, () => {
      aborted = true
      xhr.abort()

      reject(cancelError())
    })

    xhr.onload = (): void => {
      if (xhr.status != 200) {
        // analyze HTTP status of the response
        reject(new Error(`Error ${xhr.status}: ${xhr.statusText}`)) // e.g. 404: Not Found
      } else {
        const request = {
          method: requestMethod,
          url,
          data,
          headers: headers || undefined,
          signal,
          onProgress
        }

        // Convert the header string into an array
        // of individual headers
        const headersArray = xhr
          .getAllResponseHeaders()
          .trim()
          .split(/[\r\n]+/)

        // Create a map of header names to values
        const responseHeaders = {}

        headersArray.forEach(function (line) {
          const parts = line.split(': ')
          const header = parts.shift()
          const value = parts.join(': ')

          if (header && typeof header !== 'undefined') {
            responseHeaders[header] = value
          }
        })

        const responseData = xhr.response
        const responseStatus = xhr.status

        resolve({
          request,
          data: responseData,
          headers: responseHeaders,
          status: responseStatus
        })
      }
    }

    xhr.onerror = (): void => {
      if (aborted) return

      // only triggers if the request couldn't be made at all
      reject(new Error('Network error'))
    }

    if (onProgress && typeof onProgress === 'function') {
      xhr.upload.onprogress = (event: ProgressEvent): void => {
        if (event.lengthComputable) {
          onProgress({
            isComputable: true,
            value: event.loaded / event.total
          })
        } else {
          onProgress({ isComputable: false })
        }
      }
    }

    if (data) {
      xhr.send(data as FormData)
    } else {
      xhr.send()
    }
  })

export default request
