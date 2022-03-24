import version from '../version'
import { CustomUserAgent } from '../types'

/**
 * Returns User Agent based on version and settings.
 */
export function getUserAgent({
  userAgent,
  publicKey = '',
  integration = ''
}: {
  publicKey?: string
  integration?: string
  userAgent?: CustomUserAgent
} = {}): string {
  const libraryName = 'UploadcareUploadClient'
  const libraryVersion = version
  const languageName = 'JavaScript'

  if (typeof userAgent === 'string') {
    return userAgent
  }

  if (typeof userAgent === 'function') {
    return userAgent({
      publicKey,
      libraryName,
      libraryVersion,
      languageName,
      integration
    })
  }
  const mainInfo = [libraryName, libraryVersion, publicKey]
    .filter(Boolean)
    .join('/')
  const additionInfo = [languageName, integration].filter(Boolean).join('; ')
  return `${mainInfo} (${additionInfo})`
}
