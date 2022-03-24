"use strict";
exports.__esModule = true;
var defaultSettings_1 = require("../defaultSettings");
var prepareChunks_node_1 = require("./prepareChunks.node");
var multipartStart_1 = require("../api/multipartStart");
var multipartUpload_1 = require("../api/multipartUpload");
var multipartComplete_1 = require("../api/multipartComplete");
var runWithConcurrency_1 = require("../tools/runWithConcurrency");
var UploadcareFile_1 = require("../tools/UploadcareFile");
var isMultipart_1 = require("../tools/isMultipart");
var isReadyPoll_1 = require("../tools/isReadyPoll");
var retry_1 = require("../tools/retry");
var uploadPartWithRetry = function (chunk, url, _a) {
    var publicKey = _a.publicKey, onProgress = _a.onProgress, signal = _a.signal, integration = _a.integration, multipartMaxAttempts = _a.multipartMaxAttempts;
    return (0, retry_1["default"])(function (_a) {
        var attempt = _a.attempt, retry = _a.retry;
        return (0, multipartUpload_1["default"])(chunk, url, {
            publicKey: publicKey,
            onProgress: onProgress,
            signal: signal,
            integration: integration
        })["catch"](function (error) {
            if (attempt < multipartMaxAttempts) {
                return retry();
            }
            throw error;
        });
    });
};
var uploadMultipart = function (file, _a) {
    var publicKey = _a.publicKey, fileName = _a.fileName, fileSize = _a.fileSize, baseURL = _a.baseURL, secureSignature = _a.secureSignature, secureExpire = _a.secureExpire, store = _a.store, signal = _a.signal, onProgress = _a.onProgress, source = _a.source, integration = _a.integration, userAgent = _a.userAgent, retryThrottledRequestMaxTimes = _a.retryThrottledRequestMaxTimes, contentType = _a.contentType, _b = _a.multipartChunkSize, multipartChunkSize = _b === void 0 ? defaultSettings_1["default"].multipartChunkSize : _b, _c = _a.maxConcurrentRequests, maxConcurrentRequests = _c === void 0 ? defaultSettings_1["default"].maxConcurrentRequests : _c, _d = _a.multipartMaxAttempts, multipartMaxAttempts = _d === void 0 ? defaultSettings_1["default"].multipartMaxAttempts : _d, baseCDN = _a.baseCDN;
    var size = fileSize || (0, isMultipart_1.getFileSize)(file);
    var progressValues;
    var createProgressHandler = function (totalChunks, chunkIdx) {
        if (!onProgress)
            return;
        if (!progressValues) {
            progressValues = Array(totalChunks).fill(0);
        }
        var sum = function (values) {
            return values.reduce(function (sum, next) { return sum + next; }, 0);
        };
        return function (info) {
            if (!info.isComputable) {
                return;
            }
            progressValues[chunkIdx] = info.value;
            onProgress({
                isComputable: true,
                value: sum(progressValues) / totalChunks
            });
        };
    };
    return (0, multipartStart_1["default"])(size, {
        publicKey: publicKey,
        contentType: contentType,
        fileName: fileName !== null && fileName !== void 0 ? fileName : file.name,
        baseURL: baseURL,
        secureSignature: secureSignature,
        secureExpire: secureExpire,
        store: store,
        signal: signal,
        source: source,
        integration: integration,
        userAgent: userAgent,
        retryThrottledRequestMaxTimes: retryThrottledRequestMaxTimes
    })
        .then(function (_a) {
        var uuid = _a.uuid, parts = _a.parts;
        var getChunk = (0, prepareChunks_node_1.prepareChunks)(file, size, multipartChunkSize);
        return Promise.all([
            uuid,
            (0, runWithConcurrency_1["default"])(maxConcurrentRequests, parts.map(function (url, index) { return function () {
                return uploadPartWithRetry(getChunk(index), url, {
                    publicKey: publicKey,
                    onProgress: createProgressHandler(parts.length, index),
                    signal: signal,
                    integration: integration,
                    multipartMaxAttempts: multipartMaxAttempts
                });
            }; }))
        ]);
    })
        .then(function (_a) {
        var uuid = _a[0];
        return (0, multipartComplete_1["default"])(uuid, {
            publicKey: publicKey,
            baseURL: baseURL,
            source: source,
            integration: integration,
            userAgent: userAgent,
            retryThrottledRequestMaxTimes: retryThrottledRequestMaxTimes
        });
    })
        .then(function (fileInfo) {
        if (fileInfo.isReady) {
            return fileInfo;
        }
        else {
            return (0, isReadyPoll_1.isReadyPoll)({
                file: fileInfo.uuid,
                publicKey: publicKey,
                baseURL: baseURL,
                source: source,
                integration: integration,
                userAgent: userAgent,
                retryThrottledRequestMaxTimes: retryThrottledRequestMaxTimes,
                onProgress: onProgress,
                signal: signal
            });
        }
    })
        .then(function (fileInfo) { return new UploadcareFile_1.UploadcareFile(fileInfo, { baseCDN: baseCDN }); });
};
exports["default"] = uploadMultipart;
