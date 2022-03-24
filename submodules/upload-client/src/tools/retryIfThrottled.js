"use strict";
exports.__esModule = true;
var retry_1 = require("./retry");
var REQUEST_WAS_THROTTLED_CODE = 'RequestThrottledError';
var DEFAULT_RETRY_AFTER_TIMEOUT = 15000;
function getTimeoutFromThrottledRequest(error) {
    var headers = (error || {}).headers;
    return ((headers &&
        Number.parseInt(headers['x-throttle-wait-seconds']) * 1000) ||
        DEFAULT_RETRY_AFTER_TIMEOUT);
}
function retryIfThrottled(fn, retryThrottledMaxTimes) {
    return (0, retry_1["default"])(function (_a) {
        var attempt = _a.attempt, retry = _a.retry;
        return fn()["catch"](function (error) {
            if ('response' in error &&
                (error === null || error === void 0 ? void 0 : error.code) === REQUEST_WAS_THROTTLED_CODE &&
                attempt < retryThrottledMaxTimes) {
                return retry(getTimeoutFromThrottledRequest(error));
            }
            throw error;
        });
    });
}
exports["default"] = retryIfThrottled;
