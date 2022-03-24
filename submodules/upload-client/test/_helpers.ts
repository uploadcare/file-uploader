import dataUriToBuffer from 'data-uri-to-buffer'
import dataUriToBlob from 'dataurl-to-blob'
import defaultSettings from '../src/defaultSettings'
import { DefaultSettings } from '../src/types'

export const dataURItoBuffer: (uri: string) => Buffer = dataUriToBuffer as (
  uri: string
) => Buffer
export const dataURItoBlob: (uri: string) => Blob = dataUriToBlob

export enum Environment {
  Development = 'development',
  Production = 'production'
}

export const getSettingsForTesting = <T>(options: T): T & DefaultSettings => {
  const selectedEnvironment = process.env.TEST_ENV || Environment.Development

  const allEnvironments = {
    development: {
      ...defaultSettings,
      baseCDN: 'http://localhost:3000',
      baseURL: 'http://localhost:3000',
      multipartMinFileSize: 10 * 1024 * 1024,
      ...options
    },
    production: {
      ...defaultSettings,
      baseCDN: 'https://ucarecdn.com',
      baseURL: 'https://upload.uploadcare.com',
      multipartMinFileSize: 10 * 1024 * 1024,
      ...options
    }
  }

  return allEnvironments[selectedEnvironment]
}

export function assertComputableProgress(onProgress: jest.Mock): void {
  expect(onProgress).toHaveBeenCalled()
  expect(onProgress).toHaveBeenLastCalledWith({ isComputable: true, value: 1 })

  let lastProgressValue = -1
  onProgress.mock.calls.forEach(([progress]) => {
    const { isComputable, value } = progress
    expect(isComputable === true).toBeTruthy()
    expect(typeof value === 'number').toBeTruthy()
    expect(value).toBeGreaterThanOrEqual(lastProgressValue)
    lastProgressValue = value
  })
}

export function assertUnknownProgress(onProgress: jest.Mock): void {
  expect(onProgress).toHaveBeenCalled()
  expect(onProgress).toHaveBeenCalledWith({ isComputable: false })

  const calls = onProgress.mock.calls
  let isStillComputable = true
  let lastProgressValue = -1
  calls.forEach(([progress], idx) => {
    const isLastCall = idx === calls.length - 1
    const { isComputable, value } = progress
    if (isLastCall) {
      expect(isComputable === true).toBeTruthy()
      expect(typeof value === 'number').toBeTruthy()
      return
    }

    if (!isComputable) {
      isStillComputable = false
    }

    if (isStillComputable) {
      expect(isComputable === true).toBeTruthy()
      expect(typeof value === 'number').toBeTruthy()
      expect(value).toBeGreaterThanOrEqual(lastProgressValue)
      lastProgressValue = value
    } else {
      expect(isComputable === false).toBeTruthy()
    }
  })
}
