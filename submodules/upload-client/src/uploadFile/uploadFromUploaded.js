"use strict";
exports.__esModule = true;
var UploadcareFile_1 = require("../tools/UploadcareFile");
var info_1 = require("../api/info");
var uploadFromUploaded = function (uuid, _a) {
    var publicKey = _a.publicKey, fileName = _a.fileName, baseURL = _a.baseURL, signal = _a.signal, onProgress = _a.onProgress, source = _a.source, integration = _a.integration, userAgent = _a.userAgent, retryThrottledRequestMaxTimes = _a.retryThrottledRequestMaxTimes, baseCDN = _a.baseCDN;
    return (0, info_1["default"])(uuid, {
        publicKey: publicKey,
        baseURL: baseURL,
        signal: signal,
        source: source,
        integration: integration,
        userAgent: userAgent,
        retryThrottledRequestMaxTimes: retryThrottledRequestMaxTimes
    })
        .then(function (fileInfo) { return new UploadcareFile_1.UploadcareFile(fileInfo, { baseCDN: baseCDN, fileName: fileName }); })
        .then(function (result) {
        // hack for node ¯\_(ツ)_/¯
        if (onProgress)
            onProgress({
                isComputable: true,
                value: 1
            });
        return result;
    });
};
exports["default"] = uploadFromUploaded;
