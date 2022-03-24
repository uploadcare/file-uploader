export interface DefaultSettings {
  baseCDN: string
  baseURL: string
  maxContentLength: number
  retryThrottledRequestMaxTimes: number
  multipartMinFileSize: number
  multipartChunkSize: number
  multipartMinLastPartSize: number
  maxConcurrentRequests: number
  multipartMaxAttempts: number
  pollingTimeoutMilliseconds: number
  pusherKey: string
}

export interface Settings extends Partial<DefaultSettings> {
  publicKey: string
  fileName?: string
  contentType?: string
  store?: boolean
  secureSignature?: string
  secureExpire?: string
  integration?: string
  userAgent?: CustomUserAgent
  checkForUrlDuplicates?: boolean
  saveUrlForRecurrentUploads?: boolean
  source?: string
  jsonpCallback?: string
}

type CustomUserAgentOptions = {
  publicKey: string
  libraryName: string
  libraryVersion: string
  languageName: string
  integration?: string
}

type CustomUserAgentFn = (options: CustomUserAgentOptions) => string

export type CustomUserAgent = string | CustomUserAgentFn
