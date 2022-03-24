"use strict";
exports.__esModule = true;
var base_1 = require("../api/base");
var UploadcareFile_1 = require("../tools/UploadcareFile");
var isReadyPoll_1 = require("../tools/isReadyPoll");
var uploadFromObject = function (file, _a) {
    var publicKey = _a.publicKey, fileName = _a.fileName, baseURL = _a.baseURL, secureSignature = _a.secureSignature, secureExpire = _a.secureExpire, store = _a.store, signal = _a.signal, onProgress = _a.onProgress, source = _a.source, integration = _a.integration, userAgent = _a.userAgent, retryThrottledRequestMaxTimes = _a.retryThrottledRequestMaxTimes, baseCDN = _a.baseCDN;
    return (0, base_1["default"])(file, {
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
        retryThrottledRequestMaxTimes: retryThrottledRequestMaxTimes
    })
        .then(function (_a) {
        var file = _a.file;
        return (0, isReadyPoll_1.isReadyPoll)({
            file: file,
            publicKey: publicKey,
            baseURL: baseURL,
            source: source,
            integration: integration,
            userAgent: userAgent,
            retryThrottledRequestMaxTimes: retryThrottledRequestMaxTimes,
            onProgress: onProgress,
            signal: signal
        });
    })
        .then(function (fileInfo) { return new UploadcareFile_1.UploadcareFile(fileInfo, { baseCDN: baseCDN }); });
};
exports["default"] = uploadFromObject;
