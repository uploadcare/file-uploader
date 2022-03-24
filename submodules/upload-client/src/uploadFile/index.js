"use strict";
exports.__esModule = true;
exports.uploadMultipart = exports.uploadFromUploaded = exports.uploadBase = exports.uploadFromUrl = exports.uploadFile = void 0;
var uploadBase_1 = require("./uploadBase");
exports.uploadBase = uploadBase_1["default"];
var uploadFromUrl_1 = require("./uploadFromUrl");
exports.uploadFromUrl = uploadFromUrl_1["default"];
var uploadFromUploaded_1 = require("./uploadFromUploaded");
exports.uploadFromUploaded = uploadFromUploaded_1["default"];
var defaultSettings_1 = require("../defaultSettings");
var types_1 = require("./types");
var isMultipart_1 = require("../tools/isMultipart");
var uploadMultipart_1 = require("./uploadMultipart");
exports.uploadMultipart = uploadMultipart_1["default"];
/**
 * Uploads file from provided data.
 */
function uploadFile(data, _a) {
    var publicKey = _a.publicKey, fileName = _a.fileName, _b = _a.baseURL, baseURL = _b === void 0 ? defaultSettings_1["default"].baseURL : _b, secureSignature = _a.secureSignature, secureExpire = _a.secureExpire, store = _a.store, signal = _a.signal, onProgress = _a.onProgress, source = _a.source, integration = _a.integration, userAgent = _a.userAgent, retryThrottledRequestMaxTimes = _a.retryThrottledRequestMaxTimes, contentType = _a.contentType, multipartChunkSize = _a.multipartChunkSize, multipartMaxAttempts = _a.multipartMaxAttempts, maxConcurrentRequests = _a.maxConcurrentRequests, _c = _a.baseCDN, baseCDN = _c === void 0 ? defaultSettings_1["default"].baseCDN : _c, checkForUrlDuplicates = _a.checkForUrlDuplicates, saveUrlForRecurrentUploads = _a.saveUrlForRecurrentUploads, pusherKey = _a.pusherKey;
    if ((0, types_1.isFileData)(data)) {
        var fileSize = (0, isMultipart_1.getFileSize)(data);
        if ((0, isMultipart_1.isMultipart)(fileSize)) {
            return (0, uploadMultipart_1["default"])(data, {
                publicKey: publicKey,
                contentType: contentType,
                multipartChunkSize: multipartChunkSize,
                multipartMaxAttempts: multipartMaxAttempts,
                fileName: fileName,
                baseURL: baseURL,
                secureSignature: secureSignature,
                secureExpire: secureExpire,
                store: store,
                signal: signal,
                onProgress: onProgress,
                source: source,
                integration: integration,
                userAgent: userAgent,
                maxConcurrentRequests: maxConcurrentRequests,
                retryThrottledRequestMaxTimes: retryThrottledRequestMaxTimes,
                baseCDN: baseCDN
            });
        }
        return (0, uploadBase_1["default"])(data, {
            publicKey: publicKey,
            fileName: fileName,
            baseURL: baseURL,
            secureSignature: secureSignature,
            secureExpire: secureExpire,
            store: store,
            signal: signal,
            onProgress: onProgress,
            source: source,
            integration: integration,
            userAgent: userAgent,
            retryThrottledRequestMaxTimes: retryThrottledRequestMaxTimes,
            baseCDN: baseCDN
        });
    }
    if ((0, types_1.isUrl)(data)) {
        return (0, uploadFromUrl_1["default"])(data, {
            publicKey: publicKey,
            fileName: fileName,
            baseURL: baseURL,
            baseCDN: baseCDN,
            checkForUrlDuplicates: checkForUrlDuplicates,
            saveUrlForRecurrentUploads: saveUrlForRecurrentUploads,
            secureSignature: secureSignature,
            secureExpire: secureExpire,
            store: store,
            signal: signal,
            onProgress: onProgress,
            source: source,
            integration: integration,
            userAgent: userAgent,
            retryThrottledRequestMaxTimes: retryThrottledRequestMaxTimes,
            pusherKey: pusherKey
        });
    }
    if ((0, types_1.isUuid)(data)) {
        return (0, uploadFromUploaded_1["default"])(data, {
            publicKey: publicKey,
            fileName: fileName,
            baseURL: baseURL,
            signal: signal,
            onProgress: onProgress,
            source: source,
            integration: integration,
            userAgent: userAgent,
            retryThrottledRequestMaxTimes: retryThrottledRequestMaxTimes,
            baseCDN: baseCDN
        });
    }
    throw new TypeError("File uploading from \"".concat(data, "\" is not supported"));
}
exports.uploadFile = uploadFile;
