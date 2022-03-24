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
 * Complete multipart uploading.
 */
function multipartComplete(uuid, _a) {
    var publicKey = _a.publicKey, _b = _a.baseURL, baseURL = _b === void 0 ? defaultSettings_1["default"].baseURL : _b, _c = _a.source, source = _c === void 0 ? 'local' : _c, signal = _a.signal, integration = _a.integration, userAgent = _a.userAgent, _d = _a.retryThrottledRequestMaxTimes, retryThrottledRequestMaxTimes = _d === void 0 ? defaultSettings_1["default"].retryThrottledRequestMaxTimes : _d;
    return (0, retryIfThrottled_1["default"])(function () {
        return (0, request_node_1["default"])({
            method: 'POST',
            url: (0, getUrl_1["default"])(baseURL, '/multipart/complete/', { jsonerrors: 1 }),
            headers: {
                'X-UC-User-Agent': (0, userAgent_1.getUserAgent)({ publicKey: publicKey, integration: integration, userAgent: userAgent })
            },
            data: (0, buildFormData_1["default"])([
                ['uuid', uuid],
                ['UPLOADCARE_PUB_KEY', publicKey],
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
                return response;
            }
        });
    }, retryThrottledRequestMaxTimes);
}
exports["default"] = multipartComplete;
