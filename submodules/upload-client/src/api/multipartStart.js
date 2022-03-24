"use strict";
exports.__esModule = true;
var request_node_1 = require("../request/request.node");
var buildFormData_1 = require("../tools/buildFormData");
var getUrl_1 = require("../tools/getUrl");
var defaultSettings_1 = require("../defaultSettings");
var userAgent_1 = require("../tools/userAgent");
var camelizeKeys_1 = require("../tools/camelizeKeys");
var retryIfThrottled_1 = require("../tools/retryIfThrottled");
var errors_1 = require("../tools/errors");
/**
 * Start multipart uploading.
 */
function multipartStart(size, _a) {
    var publicKey = _a.publicKey, contentType = _a.contentType, fileName = _a.fileName, _b = _a.multipartChunkSize, multipartChunkSize = _b === void 0 ? defaultSettings_1.defaultSettings.multipartChunkSize : _b, _c = _a.baseURL, baseURL = _c === void 0 ? '' : _c, secureSignature = _a.secureSignature, secureExpire = _a.secureExpire, store = _a.store, signal = _a.signal, _d = _a.source, source = _d === void 0 ? 'local' : _d, integration = _a.integration, userAgent = _a.userAgent, _e = _a.retryThrottledRequestMaxTimes, retryThrottledRequestMaxTimes = _e === void 0 ? defaultSettings_1.defaultSettings.retryThrottledRequestMaxTimes : _e;
    return (0, retryIfThrottled_1["default"])(function () {
        return (0, request_node_1["default"])({
            method: 'POST',
            url: (0, getUrl_1["default"])(baseURL, '/multipart/start/', { jsonerrors: 1 }),
            headers: {
                'X-UC-User-Agent': (0, userAgent_1.getUserAgent)({ publicKey: publicKey, integration: integration, userAgent: userAgent })
            },
            data: (0, buildFormData_1["default"])([
                ['filename', fileName !== null && fileName !== void 0 ? fileName : defaultSettings_1.defaultFilename],
                ['size', size],
                ['content_type', contentType !== null && contentType !== void 0 ? contentType : defaultSettings_1.defaultContentType],
                ['part_size', multipartChunkSize],
                ['UPLOADCARE_STORE', store ? '' : 'auto'],
                ['UPLOADCARE_PUB_KEY', publicKey],
                ['signature', secureSignature],
                ['expire', secureExpire],
                ['source', source]
            ]),
            signal: signal
        }).then(function (_a) {
            var data = _a.data, headers = _a.headers, request = _a.request;
            var response = (0, camelizeKeys_1["default"])(JSON.parse(data));
            if ('error' in response) {
                throw new errors_1.UploadClientError(response.error.content, response.error.errorCode, request, response, headers);
            }
            else {
                // convert to array
                response.parts = Object.keys(response.parts).map(function (key) { return response.parts[key]; });
                return response;
            }
        });
    }, retryThrottledRequestMaxTimes);
}
exports["default"] = multipartStart;
