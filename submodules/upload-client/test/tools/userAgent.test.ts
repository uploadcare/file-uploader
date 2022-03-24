import version from '../../src/version'
import { getUserAgent } from '../../src/tools/userAgent'
import { CustomUserAgent } from '../../src/types'

describe('getUserAgent', () => {
  it('should generate user agent without params', () => {
    expect(getUserAgent()).toBe(
      `UploadcareUploadClient/${version} (JavaScript)`
    )
  })

  it('should generate user agent with integration', () => {
    expect(getUserAgent({ integration: 'test' })).toBe(
      `UploadcareUploadClient/${version} (JavaScript; test)`
    )
  })

  it('should generate user agent with pub-key', () => {
    expect(getUserAgent({ publicKey: 'test' })).toBe(
      `UploadcareUploadClient/${version}/test (JavaScript)`
    )
  })

  it('should generate user agent with integration and pub-key', () => {
    expect(getUserAgent({ publicKey: 'test', integration: 'test' })).toBe(
      `UploadcareUploadClient/${version}/test (JavaScript; test)`
    )
  })

  it('should be able to pass custom user agent string', () => {
    expect(getUserAgent({ userAgent: 'test' })).toBe('test')
  })

  it('should be able to pass custom user agent function', () => {
    const userAgent: CustomUserAgent = ({
      publicKey,
      libraryName,
      libraryVersion,
      languageName,
      integration
    }) => {
      expect(publicKey).toBe('test')
      expect(libraryName).toBe('UploadcareUploadClient')
      expect(libraryVersion).toBe(version)
      expect(languageName).toBe('JavaScript')
      expect(integration).toBe('integration')
      return 'test'
    }

    expect(
      getUserAgent({ publicKey: 'test', userAgent, integration: 'integration' })
    ).toBe('test')
  })
})
