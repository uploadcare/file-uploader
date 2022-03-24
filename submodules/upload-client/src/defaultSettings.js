"use strict";
exports.__esModule = true;
exports.defaultSettings = exports.defaultContentType = exports.defaultFilename = void 0;
/*
  Settings for future support:
  parallelDirectUploads: 10,
 */
var defaultSettings = {
    baseCDN: 'https://ucarecdn.com',
    baseURL: 'https://upload.uploadcare.com',
    maxContentLength: 50 * 1024 * 1024,
    retryThrottledRequestMaxTimes: 1,
    multipartMinFileSize: 25 * 1024 * 1024,
    multipartChunkSize: 5 * 1024 * 1024,
    multipartMinLastPartSize: 1024 * 1024,
    maxConcurrentRequests: 4,
    multipartMaxAttempts: 3,
    pollingTimeoutMilliseconds: 10000,
    pusherKey: '79ae88bd931ea68464d9'
};
exports.defaultSettings = defaultSettings;
var defaultContentType = 'application/octet-stream';
exports.defaultContentType = defaultContentType;
var defaultFilename = 'original';
exports.defaultFilename = defaultFilename;
exports["default"] = defaultSettings;
