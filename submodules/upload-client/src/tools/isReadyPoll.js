"use strict";
exports.__esModule = true;
exports.isReadyPoll = void 0;
var info_1 = require("../api/info");
var poll_1 = require("./poll");
function isReadyPoll(_a) {
    var file = _a.file, publicKey = _a.publicKey, baseURL = _a.baseURL, source = _a.source, integration = _a.integration, userAgent = _a.userAgent, retryThrottledRequestMaxTimes = _a.retryThrottledRequestMaxTimes, signal = _a.signal, onProgress = _a.onProgress;
    return (0, poll_1.poll)({
        check: function (signal) {
            return (0, info_1["default"])(file, {
                publicKey: publicKey,
                baseURL: baseURL,
                signal: signal,
                source: source,
                integration: integration,
                userAgent: userAgent,
                retryThrottledRequestMaxTimes: retryThrottledRequestMaxTimes
            }).then(function (response) {
                if (response.isReady) {
                    return response;
                }
                onProgress && onProgress({ isComputable: true, value: 1 });
                return false;
            });
        },
        signal: signal
    });
}
exports.isReadyPoll = isReadyPoll;
