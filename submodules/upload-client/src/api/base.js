"use strict";
exports.__esModule = true;
var request_node_1 = require("../request/request.node");
var buildFormData_1 = require("../tools/buildFormData");
var getUrl_1 = require("../tools/getUrl");
var defaultSettings_1 = require("../defaultSettings");
var userAgent_1 = require("../tools/userAgent");
var camelizeKeys_1 = require("../tools/camelizeKeys");
var errors_1 = require("../tools/errors");
var retryIfThrottled_1 = require("../tools/retryIfThrottled");
/**
 * Performs file uploading request to Uploadcare Upload API.
 * Can be canceled and has progress.
 */
function base(file, _a) {
    var publicKey = _a.publicKey, fileName = _a.fileName, _b = _a.baseURL, baseURL = _b === void 0 ? defaultSettings_1.defaultSettings.baseURL : _b, secureSignature = _a.secureSignature, secureExpire = _a.secureExpire, store = _a.store, signal = _a.signal, onProgress = _a.onProgress, _c = _a.source, source = _c === void 0 ? 'local' : _c, integration = _a.integration, userAgent = _a.userAgent, _d = _a.retryThrottledRequestMaxTimes, retryThrottledRequestMaxTimes = _d === void 0 ? defaultSettings_1.defaultSettings.retryThrottledRequestMaxTimes : _d;
    return (0, retryIfThrottled_1["default"])(function () {
        var _a;
        return (0, request_node_1["default"])({
            method: 'POST',
            url: (0, getUrl_1["default"])(baseURL, '/base/', {
                jsonerrors: 1
            }),
            headers: {
                'X-UC-User-Agent': (0, userAgent_1.getUserAgent)({ publicKey: publicKey, integration: integration, userAgent: userAgent })
            },
            data: (0, buildFormData_1["default"])([
                ['file', file, (_a = fileName !== null && fileName !== void 0 ? fileName : file.name) !== null && _a !== void 0 ? _a : defaultSettings_1.defaultFilename],
                ['UPLOADCARE_PUB_KEY', publicKey],
                [
                    'UPLOADCARE_STORE',
                    typeof store === 'undefined' ? 'auto' : store ? 1 : 0
                ],
                ['signature', secureSignature],
                ['expire', secureExpire],
                ['source', source]
            ]),
            signal: signal,
            onProgress: onProgress
        }).then(function (_a) {
            var data = _a.data, headers = _a.headers, request = _a.request;
            var response = (0, camelizeKeys_1["default"])(JSON.parse(data));
            if ('error' in response) {
                throw new errors_1.UploadClientError(response.error.content, response.error.errorCode, request, response, headers);
            }
            else {
                return response;
            }
        });
    }, retryThrottledRequestMaxTimes);
}
exports["default"] = base;
