"use strict";
exports.__esModule = true;
var request_node_1 = require("../request/request.node");
var getUrl_1 = require("../tools/getUrl");
var defaultSettings_1 = require("../defaultSettings");
var userAgent_1 = require("../tools/userAgent");
var camelizeKeys_1 = require("../tools/camelizeKeys");
var errors_1 = require("../tools/errors");
var retryIfThrottled_1 = require("../tools/retryIfThrottled");
/**
 * Returns a JSON dictionary holding file info.
 */
function info(uuid, _a) {
    var publicKey = _a.publicKey, _b = _a.baseURL, baseURL = _b === void 0 ? defaultSettings_1["default"].baseURL : _b, signal = _a.signal, source = _a.source, integration = _a.integration, userAgent = _a.userAgent, _c = _a.retryThrottledRequestMaxTimes, retryThrottledRequestMaxTimes = _c === void 0 ? defaultSettings_1["default"].retryThrottledRequestMaxTimes : _c;
    return (0, retryIfThrottled_1["default"])(function () {
        return (0, request_node_1["default"])({
            method: 'GET',
            headers: {
                'X-UC-User-Agent': (0, userAgent_1.getUserAgent)({ publicKey: publicKey, integration: integration, userAgent: userAgent })
            },
            url: (0, getUrl_1["default"])(baseURL, '/info/', {
                jsonerrors: 1,
                pub_key: publicKey,
                file_id: uuid,
                source: source
            }),
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
exports["default"] = info;
