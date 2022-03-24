"use strict";
exports.__esModule = true;
exports.Status = void 0;
var request_node_1 = require("../request/request.node");
var getUrl_1 = require("../tools/getUrl");
var defaultSettings_1 = require("../defaultSettings");
var userAgent_1 = require("../tools/userAgent");
var camelizeKeys_1 = require("../tools/camelizeKeys");
var errors_1 = require("../tools/errors");
var retryIfThrottled_1 = require("../tools/retryIfThrottled");
var Status;
(function (Status) {
    Status["Unknown"] = "unknown";
    Status["Waiting"] = "waiting";
    Status["Progress"] = "progress";
    Status["Error"] = "error";
    Status["Success"] = "success";
})(Status = exports.Status || (exports.Status = {}));
var isErrorResponse = function (response) {
    return 'status' in response && response.status === Status.Error;
};
/**
 * Checking upload status and working with file tokens.
 */
function fromUrlStatus(token, _a) {
    var _b = _a === void 0 ? {} : _a, publicKey = _b.publicKey, _c = _b.baseURL, baseURL = _c === void 0 ? defaultSettings_1["default"].baseURL : _c, signal = _b.signal, integration = _b.integration, userAgent = _b.userAgent, _d = _b.retryThrottledRequestMaxTimes, retryThrottledRequestMaxTimes = _d === void 0 ? defaultSettings_1["default"].retryThrottledRequestMaxTimes : _d;
    return (0, retryIfThrottled_1["default"])(function () {
        return (0, request_node_1["default"])({
            method: 'GET',
            headers: publicKey
                ? {
                    'X-UC-User-Agent': (0, userAgent_1.getUserAgent)({
                        publicKey: publicKey,
                        integration: integration,
                        userAgent: userAgent
                    })
                }
                : undefined,
            url: (0, getUrl_1["default"])(baseURL, '/from_url/status/', {
                jsonerrors: 1,
                token: token
            }),
            signal: signal
        }).then(function (_a) {
            var data = _a.data, headers = _a.headers, request = _a.request;
            var response = (0, camelizeKeys_1["default"])(JSON.parse(data));
            if ('error' in response && !isErrorResponse(response)) {
                throw new errors_1.UploadClientError(response.error.content, undefined, request, response, headers);
            }
            else {
                return response;
            }
        });
    }, retryThrottledRequestMaxTimes);
}
exports["default"] = fromUrlStatus;
