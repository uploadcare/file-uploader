"use strict";
exports.__esModule = true;
var request_node_1 = require("../request/request.node");
/**
 * Complete multipart uploading.
 */
function multipartUpload(part, url, _a) {
    var signal = _a.signal, onProgress = _a.onProgress;
    return (0, request_node_1["default"])({
        method: 'PUT',
        url: url,
        data: part,
        // Upload request can't be non-computable because we always know exact size
        onProgress: onProgress,
        signal: signal
    })
        .then(function (result) {
        // hack for node ¯\_(ツ)_/¯
        if (onProgress)
            onProgress({
                isComputable: true,
                value: 1
            });
        return result;
    })
        .then(function (_a) {
        var status = _a.status;
        return ({ code: status });
    });
}
exports["default"] = multipartUpload;
